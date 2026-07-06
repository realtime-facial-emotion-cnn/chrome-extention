let currentRecorder = null;
let isCapturing = false;
const CHUNK_SIZE = 256 * 1024;

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

async function startTabCapture() {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: true,
  });

  const recorder = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp8,opus",
    videoBitsPerSecond: 1000000,
    audioBitsPerSecond: 128000,
  });
  const chunks = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
      console.log(`[content] captured chunk`, { size: event.data.size });
    }
  };

  recorder.onstop = async () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    const arrayBuffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const totalChunks = Math.ceil(bytes.byteLength / CHUNK_SIZE);
    stream.getTracks().forEach((track) => track.stop());
    isCapturing = false;

    console.log(`[content] stopping recorder`, {
      totalChunks,
      size: bytes.byteLength,
    });

    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, bytes.byteLength);
      const chunkBytes = bytes.slice(start, end);
      const chunkBase64 = arrayBufferToBase64(
        chunkBytes.buffer.slice(
          chunkBytes.byteOffset,
          chunkBytes.byteOffset + chunkBytes.byteLength,
        ),
      );

      console.log(`[content] sending chunk`, { index, totalChunks });
      await chrome.runtime.sendMessage({
        type: "recording-chunk",
        payload: {
          index,
          totalChunks,
          data: chunkBase64,
          type: blob.type || "video/webm",
        },
      });
    }

    console.log(`[content] sending recording-complete`);
    await chrome.runtime.sendMessage({
      type: "recording-complete",
      payload: {
        totalChunks,
        type: blob.type || "video/webm",
      },
    });
  };

  recorder.start(250);
  currentRecorder = recorder;
  isCapturing = true;
  return recorder;
}

async function stopTabCapture() {
  if (!currentRecorder) return;
  isCapturing = false;
  currentRecorder.stop();
  currentRecorder = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "meeting-video-payload") {
    const payload = message.payload;
    window.__pendingUploadPayload = payload;
    window.dispatchEvent(
      new CustomEvent("meeting-video-payload", { detail: payload }),
    );
    window.postMessage(
      { type: "meeting-video-payload", payload },
      window.location.origin,
    );
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "start-recording") {
    startTabCapture()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message?.type === "stop-recording") {
    stopTabCapture()
      .then(() => sendResponse({ ok: true, isRecording: false }))
      .catch((error) => {
        sendResponse({ ok: false, error: error.message });
      });
    return true;
  }

  if (message?.type === "get-recording-status") {
    sendResponse({ ok: true, isRecording: isCapturing });
    return true;
  }
});
