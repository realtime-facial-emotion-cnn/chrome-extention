let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null;

const MIME_TYPE = 'video/webm;codecs=vp9';

async function startRecording(streamId) {
  if (mediaRecorder) return; // already recording

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
  });

  // Also play the captured audio back out, otherwise the tab goes silent
  // for the user while it's being recorded.
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(mediaStream);
  source.connect(audioContext.destination);

  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream, { mimeType: MIME_TYPE });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: MIME_TYPE });
    recordedChunks = [];

    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
    mediaRecorder = null;

    const base64Data = await blobToBase64(blob);
    chrome.runtime.sendMessage({
      type: 'recording-complete',
      data: base64Data,
      mimeType: MIME_TYPE,
    });
  };

  mediaRecorder.start();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data URL: "data:video/webm;base64,AAAA..."
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  (async () => {
    try {
      if (message.type === 'offscreen-start-recording') {
        await startRecording(message.streamId);
      } else if (message.type === 'offscreen-stop-recording') {
        stopRecording();
      }
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'recording-error', error: err.message });
    }
  })();

  return false;
});
