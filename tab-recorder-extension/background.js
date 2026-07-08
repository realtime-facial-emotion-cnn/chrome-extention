// ---------------------------------------------------------------------
// CONFIGURE THIS: the web app that should receive the finished recording.
// ---------------------------------------------------------------------
const TARGET_URL = "http://localhost:5173/";

const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";

// ---------- State helpers (persisted so the popup can rehydrate) -------

async function getState() {
  const data = await chrome.storage.local.get([
    "isRecording",
    "isProcessing",
    "recordingTabId",
    "lastError",
  ]);
  return {
    recording: !!data.isRecording,
    processing: !!data.isProcessing,
    recordingTabId: data.recordingTabId || null,
    lastError: data.lastError || null,
  };
}

async function setState(partial) {
  await chrome.storage.local.set(partial);
  const state = await getState();
  // Best-effort push to an open popup; ignored if none is listening.
  chrome.runtime.sendMessage({ type: "state-changed", state }).catch(() => {});
}

// ---------------------- Offscreen document plumbing --------------------

async function hasOffscreenDocument() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  return contexts.length > 0;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ["USER_MEDIA"],
    justification: "Recording the active tab with MediaRecorder",
  });
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

// ------------------------------ Start -----------------------------------

function getMediaStreamId(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.getMediaStreamId({ targetTabId: tabId }, (streamId) => {
      if (chrome.runtime.lastError || !streamId) {
        reject(new Error(chrome.runtime.lastError?.message || "No stream id"));
      } else {
        resolve(streamId);
      }
    });
  });
}

async function startRecording() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) throw new Error("No active tab found");

  await ensureOffscreenDocument();
  const streamId = await getMediaStreamId(tab.id);

  await chrome.runtime.sendMessage({
    type: "offscreen-start-recording",
    target: "offscreen",
    streamId,
  });

  await setState({
    isRecording: true,
    isProcessing: false,
    recordingTabId: tab.id,
    lastError: null,
  });
}

// ------------------------------- Stop ------------------------------------

async function stopRecording() {
  await setState({ isRecording: false, isProcessing: true, lastError: null });
  await chrome.runtime.sendMessage({
    type: "offscreen-stop-recording",
    target: "offscreen",
  });
  // The offscreen document will asynchronously reply with
  // 'recording-complete', handled below.
}

// Runs in the context of the newly opened target tab, delivering the
// recorded video to the page itself. Kept as a plain function so it can
// be serialized by chrome.scripting.executeScript.
function deliverRecordingToPage(base64Data, mimeType) {
  try {
    const byteChars = atob(base64Data);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);

    const payload = {
      dataUrl: `data:${mimeType};base64,${base64Data}`,
      type: mimeType,
      fileName: "recording.webm",
    };

    // Persist a fallback payload on the page so the app can detect it even if
    // the custom event fires before React has attached its listener.
    window.__pendingUploadPayload = payload;

    const marker =
      document.getElementById("meetinglens-payload-marker") ||
      document.createElement("div");
    marker.id = "meetinglens-payload-marker";
    marker.style.display = "none";
    document.body.appendChild(marker);

    window.dispatchEvent(
      new CustomEvent("tab-recorder:recording-ready", {
        detail: { blobUrl, mimeType, size: blob.size },
      }),
    );
  } catch (err) {
    console.error("Failed to deliver recording to page", err);
  }
}

async function handleRecordingComplete(base64Data, mimeType) {
  await setState({ isRecording: false, isProcessing: false, lastError: null });
  await closeOffscreenDocument();

  const tab = await chrome.tabs.create({ url: TARGET_URL });

  const onUpdated = async (tabId, changeInfo) => {
    if (tabId === tab.id && changeInfo.status === "complete") {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      try {
        // Give the page a short moment to initialize React and attach
        // listeners before we inject the recorded payload.
        await new Promise((resolve) => setTimeout(resolve, 1500));

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: "MAIN",
          func: deliverRecordingToPage,
          args: [base64Data, mimeType],
        });
      } catch (err) {
        console.error("Failed to inject recording into target page", err);
      }
    }
  };
  chrome.tabs.onUpdated.addListener(onUpdated);
}

// --------------------------- Message router -------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "offscreen") return false; // not for us
  if (message.type === "state-changed") return false; // rebroadcast, ignore

  (async () => {
    try {
      switch (message.type) {
        case "get-state": {
          sendResponse(await getState());
          break;
        }
        case "start-recording": {
          await startRecording();
          sendResponse({ ok: true });
          break;
        }
        case "stop-recording": {
          await stopRecording();
          sendResponse({ ok: true });
          break;
        }
        case "recording-complete": {
          await handleRecordingComplete(message.data, message.mimeType);
          sendResponse({ ok: true });
          break;
        }
        case "recording-error": {
          await setState({
            isRecording: false,
            isProcessing: false,
            lastError: message.error,
          });
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (err) {
      console.error(err);
      await setState({
        isRecording: false,
        isProcessing: false,
        lastError: err.message,
      });
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // keep the message channel open for the async response
});
