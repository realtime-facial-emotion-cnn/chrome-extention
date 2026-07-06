const FRONTEND_URL = "http://localhost:5173/";

let mediaRecorder = null;
let recordedChunks = [];
let currentTabId = null;
let isRecording = false;
let pendingRecordingChunks = [];
let pendingRecordingTotalChunks = 0;
let pendingRecordingType = "video/webm";

const STATE_KEY = "popupRecordingState";
const RECORDING_FLAG_KEY = "isRecording";

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const statusBadge = document.getElementById("statusBadge");
const statusText = document.getElementById("statusText");
const errorMsg = document.getElementById("errorMsg");

function log(message, detail) {
  const output =
    detail === undefined ? message : `${message} ${JSON.stringify(detail)}`;
  console.log(`[popup] ${output}`);
}

function setStatus(message, type = "idle") {
  statusText.textContent = message;
  statusBadge.textContent =
    type === "recording"
      ? "Recording"
      : type === "processing"
        ? "Processing"
        : "Ready";
  statusBadge.className =
    `status-badge ${type === "recording" ? "recording" : type === "processing" ? "processing" : ""}`.trim();
}

function showError(message) {
  console.error(`[popup] ${message}`);
  errorMsg.textContent = message;
  errorMsg.classList.add("visible");
}

function clearError() {
  errorMsg.textContent = "";
  errorMsg.classList.remove("visible");
}

function updateButtonState() {
  startBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
}

function resetPendingRecording() {
  pendingRecordingChunks = [];
  pendingRecordingTotalChunks = 0;
  pendingRecordingType = "video/webm";
}

async function finalizePendingRecording() {
  if (!pendingRecordingTotalChunks) {
    log("No pending recording chunks to finalize");
    return false;
  }

  const receivedChunks = pendingRecordingChunks.filter(Boolean).length;
  if (receivedChunks < pendingRecordingTotalChunks) {
    log("Not all recording chunks received yet", {
      received: receivedChunks,
      total: pendingRecordingTotalChunks,
    });
    return false;
  }

  const mergedBytes = new Uint8Array(
    pendingRecordingChunks.reduce(
      (total, chunk) => total + base64ToUint8Array(chunk).byteLength,
      0,
    ),
  );
  let offset = 0;
  pendingRecordingChunks.forEach((chunk) => {
    const bytes = base64ToUint8Array(chunk);
    mergedBytes.set(bytes, offset);
    offset += bytes.byteLength;
  });

  const blob = new Blob([mergedBytes], {
    type: pendingRecordingType || "video/webm",
  });
  log("Recording assembled", { size: blob.size, type: blob.type });
  resetPendingRecording();

  isRecording = false;
  persistState();
  updateButtonState();
  setStatus("Opening your summary workspace…", "processing");
  log("Opening frontend tab");

  try {
    await injectRecordedVideoIntoFrontend(blob);
    log("Frontend handoff complete");
  } catch (error) {
    log("Frontend handoff failed", { message: error.message });
    showError(error.message || "Unable to finish recording.");
    setStatus("Ready", "idle");
  }

  return true;
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function videoBlobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return `data:${blob.type || "video/webm"};base64,${btoa(binary)}`;
}

function persistState() {
  chrome.storage.local.set({
    [STATE_KEY]: {
      isRecording,
      currentTabId,
    },
    [RECORDING_FLAG_KEY]: isRecording,
  });
}

async function restoreStateFromStorage() {
  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      isRecording = false;
      updateButtonState();
      setStatus("Ready", "idle");
      return;
    }

    currentTabId = activeTab.id;

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["popup/content.js"],
    });

    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: "get-recording-status",
    });

    if (response?.ok && response.isRecording) {
      isRecording = true;
      persistState();
      updateButtonState();
      setStatus("Recording your meeting…", "recording");
      return;
    }
  } catch (error) {
    // fall back to storage if the content script is unavailable
  }

  chrome.storage.local.get([STATE_KEY, RECORDING_FLAG_KEY], (result) => {
    const state = result[STATE_KEY] || {};
    const persistedFlag = result[RECORDING_FLAG_KEY];
    const shouldBeRecording =
      persistedFlag === true || state.isRecording === true;

    if (shouldBeRecording) {
      isRecording = true;
      currentTabId = state.currentTabId || null;
      updateButtonState();
      setStatus("Recording your meeting…", "recording");
    } else {
      isRecording = false;
      currentTabId = state.currentTabId || null;
      updateButtonState();
      setStatus("Ready", "idle");
    }
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function toBlob(payload) {
  if (!payload) return null;

  if (typeof Blob !== "undefined" && payload instanceof Blob) {
    return payload;
  }

  if (typeof payload === "string" && payload.startsWith("data:")) {
    const [header, encoded] = payload.split(",");
    if (!encoded) return null;

    const mimeMatch = header.match(/data:(.*?);/);
    const mime = mimeMatch?.[1] || "video/webm";
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mime });
  }

  if (payload?.dataUrl) {
    return toBlob(payload.dataUrl);
  }

  return null;
}

async function sendPayloadToFrontendTab(tabId, payload) {
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "meeting-video-payload",
        payload,
      });

      if (response?.ok) {
        log("Delivered upload payload to frontend tab", {
          tabId,
          attempt: attempt + 1,
        });
        return;
      }
    } catch (error) {
      log("Frontend payload delivery attempt failed", {
        tabId,
        attempt: attempt + 1,
        message: error.message,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("Unable to deliver the recording to the summary app.");
}

async function injectRecordedVideoIntoFrontend(blob) {
  const videoBlob = toBlob(blob);
  if (!videoBlob) {
    throw new Error("The recording data could not be prepared for upload.");
  }

  log("Creating frontend tab", { url: FRONTEND_URL });
  const frontendTab = await chrome.tabs.create({
    url: FRONTEND_URL,
    active: true,
  });

  if (!frontendTab?.id) {
    throw new Error("Unable to open the summary workspace.");
  }

  log("Frontend tab created", { tabId: frontendTab.id });

  const payload = {
    dataUrl: await videoBlobToDataUrl(videoBlob),
    fileName: "recording.webm",
    type: videoBlob.type || "video/webm",
  };

  log("Waiting for frontend to load", { delay: "2s" });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  try {
    await sendPayloadToFrontendTab(frontendTab.id, payload);
  } catch (error) {
    log("Frontend tab delivery failed, falling back to direct injection", {
      message: error.message,
    });

    await chrome.scripting.executeScript({
      target: { tabId: frontendTab.id },
      world: "MAIN",
      func: (payload) => {
        window.__pendingUploadPayload = payload;
        window.dispatchEvent(
          new CustomEvent("meeting-video-payload", { detail: payload }),
        );
        window.postMessage(
          { type: "meeting-video-payload", payload },
          window.location.origin,
        );
      },
      args: [payload],
    });
  }
}

async function startRecording() {
  clearError();
  startBtn.disabled = true;
  stopBtn.disabled = false;
  setStatus("Requesting screen and camera access…", "processing");

  try {
    const activeTab = await getActiveTab();
    if (!activeTab?.id) {
      throw new Error("Open a tab before recording.");
    }

    currentTabId = activeTab.id;

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["popup/content.js"],
    });

    log("Sending start-recording message");
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: "start-recording",
    });
    if (!response?.ok) {
      throw new Error(
        response?.error || "Unable to start recording from the current tab.",
      );
    }

    log("Start recording response", response);
    isRecording = true;
    persistState();
    updateButtonState();
    setStatus("Recording your meeting…", "recording");
  } catch (error) {
    log("Start recording failed", { message: error.message });
    isRecording = false;
    persistState();
    updateButtonState();
    setStatus("Ready", "idle");
    showError(error.message || "Unable to start recording.");
  }
}

function stopRecording() {
  if (!isRecording) return;

  log("Stop button clicked", { tabId: currentTabId });

  startBtn.disabled = true;
  stopBtn.disabled = true;
  setStatus("Stopping recording…", "processing");
  persistState();

  chrome.tabs.sendMessage(
    currentTabId,
    { type: "stop-recording" },
    async (response) => {
      log("Stop recording response", response);

      if (chrome.runtime.lastError) {
        log("Stop recording runtime error", {
          message: chrome.runtime.lastError.message,
        });
        showError(chrome.runtime.lastError.message);
        return;
      }

      if (!response?.ok) {
        log("Stop recording returned failure", response);
        showError(response?.error || "Unable to stop recording.");
        return;
      }

      isRecording = false;
      persistState();
      updateButtonState();
      setStatus("Finishing recording…", "processing");
    },
  );
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "recording-chunk") {
    const payload = message.payload || {};
    log("Received recording chunk", {
      index: payload.index,
      totalChunks: payload.totalChunks,
    });
    pendingRecordingChunks[payload.index] = payload.data;
    pendingRecordingTotalChunks =
      payload.totalChunks || pendingRecordingTotalChunks;
    pendingRecordingType = payload.type || pendingRecordingType;

    void finalizePendingRecording();

    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "recording-complete") {
    log("Recording completion message received");
    void finalizePendingRecording();
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

updateButtonState();
void restoreStateFromStorage();

startBtn.addEventListener("click", startRecording);
stopBtn.addEventListener("click", stopRecording);
