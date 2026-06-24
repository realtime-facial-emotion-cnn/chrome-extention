let audioRecorder = null;
let videoRecorder = null;
let recordedAudioBlob = null;
let recordedVideoBlob = null;
let audioChunks = [];
let videoChunks = [];
let audioContext = null;
let analyser = null;
let animFrameId = null;

const startAudioBtn = document.getElementById("startAudioBtn");
const stopAudioBtn  = document.getElementById("stopAudioBtn");
const startVideoBtn = document.getElementById("startVideoBtn");
const stopVideoBtn  = document.getElementById("stopVideoBtn");
const insightBtn    = document.getElementById("insightBtn");
const statusBadge   = document.getElementById("statusBadge");
const visLabel      = document.getElementById("visLabel");
const trackAudio    = document.getElementById("trackAudio");
const trackVideo    = document.getElementById("trackVideo");
const loader        = document.getElementById("loader");
const loaderText    = document.getElementById("loaderText");
const errorMsg      = document.getElementById("errorMsg");
const canvas        = document.getElementById("audioVisualizer");
const ctx           = canvas.getContext("2d");

function setStatus(text, cls = "") {
  statusBadge.textContent = text;
  statusBadge.className = "status-badge " + cls;
}

function setTrack(el, ready, label) {
  el.querySelector(".track-state").textContent = label;
  el.classList.toggle("ready", ready);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add("visible");
  setTimeout(() => errorMsg.classList.remove("visible"), 6000);
}

function showLoader(text) {
  loader.classList.add("visible");
  loaderText.textContent = text;
  insightBtn.disabled = true;
}

function hideLoader() {
  loader.classList.remove("visible");
  insightBtn.disabled = false;
}

function startVisualizer(stream) {
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 64;
  audioContext.createMediaStreamSource(stream).connect(analyser);

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const W = canvas.width;
  const H = canvas.height;

  function draw() {
    animFrameId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, W, H);
    const barW = (W / bufferLength) * 0.7;
    const gap  = (W / bufferLength) * 0.3;
    dataArray.forEach((val, i) => {
      const barH = (val / 255) * H * 0.85;
      const x = i * (barW + gap);
      const y = H - barH;
      const grad = ctx.createLinearGradient(0, y, 0, H);
      grad.addColorStop(0, "#6cf0c2");
      grad.addColorStop(1, "rgba(108,240,194,0.1)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, 2);
      ctx.fill();
    });
  }
  draw();
  visLabel.textContent = "Recording audio…";
}

function stopVisualizer() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  if (audioContext) audioContext.close();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  visLabel.textContent = "No active recording";
}

// ── AUDIO ──
startAudioBtn.onclick = async () => {
  errorMsg.classList.remove("visible");
  try {
    const tabStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true   // captures tab/system audio
    });

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mergeCtx    = new AudioContext();
    const destination = mergeCtx.createMediaStreamDestination();
    mergeCtx.createMediaStreamSource(tabStream).connect(destination);
    mergeCtx.createMediaStreamSource(micStream).connect(destination);

    startVisualizer(destination.stream);

    audioRecorder = new MediaRecorder(destination.stream, { mimeType: "audio/webm" });
    audioChunks = [];

    audioRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    audioRecorder.onstop = () => {
      recordedAudioBlob = new Blob(audioChunks, { type: "audio/webm" });
      setTrack(trackAudio, true, "✓ ready");
      stopVisualizer();
      setStatus("AUDIO DONE", "");
    };

    audioRecorder.start();
    setStatus("RECORDING", "recording");
    startAudioBtn.disabled = true;
    stopAudioBtn.disabled  = false;

  } catch (err) {
    showError("Audio error: " + err.message);
    stopVisualizer();
  }
};

stopAudioBtn.onclick = () => {
  if (audioRecorder && audioRecorder.state !== "inactive") {
    audioRecorder.stop();
    startAudioBtn.disabled = false;
    stopAudioBtn.disabled  = true;
  }
};

// ── VIDEO ──
startVideoBtn.onclick = async () => {
  errorMsg.classList.remove("visible");
  try {
    const tabVideoStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    videoRecorder = new MediaRecorder(tabVideoStream, { mimeType: "video/webm" });
    videoChunks = [];

    videoRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) videoChunks.push(e.data);
    };

    videoRecorder.onstop = () => {
      recordedVideoBlob = new Blob(videoChunks, { type: "video/webm" });
      setTrack(trackVideo, true, "✓ ready");
    };

    videoRecorder.start();
    startVideoBtn.disabled = true;
    stopVideoBtn.disabled  = false;

    if (!audioRecorder || audioRecorder.state === "inactive") {
      setStatus("RECORDING", "recording");
    }
  } catch (err) {
    showError("Video error: " + err.message);
  }
};

stopVideoBtn.onclick = () => {
  if (videoRecorder && videoRecorder.state !== "inactive") {
    videoRecorder.stop();
    startVideoBtn.disabled = false;
    stopVideoBtn.disabled  = true;
  }
};

// ── GET INSIGHTS ──
insightBtn.onclick = async () => {
  errorMsg.classList.remove("visible");

  if (!recordedAudioBlob && !recordedVideoBlob) {
    showError("Please record audio and/or video first.");
    return;
  }

  setStatus("PROCESSING", "processing");

  const USE_DUMMY = true; // ← Change to false when Dimuthu's backend is ready

  if (USE_DUMMY) {
    showLoader("Using demo data…");
    await new Promise(r => setTimeout(r, 1200));
    const dummySummary = {
      audioSummary: {
        grammar_score: 0.82,
        fluency_score: 0.75,
        confidence_score: 0.69,
        strengths: "Clear articulation; Good pacing",
        improvements: "Reduce filler words; Maintain eye contact"
      },
      videoSummary: {
        emotion_observation: "Mostly neutral with moments of confidence",
        emotion_summary: {
          happy: 0.38, neutral: 0.35, surprise: 0.10,
          fear: 0.07, angry: 0.05, sad: 0.03, disgust: 0.02
        }
      }
    };
    localStorage.setItem("meetingSummary", JSON.stringify(dummySummary));
    hideLoader();
    window.location.href = chrome.runtime.getURL("popup/summary.html");
    return;
  }

  try {
    showLoader("Analyzing audio…");
    const audioResult = await handleAudio();
    showLoader("Analyzing video…");
    const videoResult = await handleVideo();
    localStorage.setItem("meetingSummary", JSON.stringify({
      audioSummary: audioResult,
      videoSummary: videoResult
    }));
    hideLoader();
    setStatus("DONE", "");
    window.location.href = chrome.runtime.getURL("popup/summary.html");
  } catch (err) {
    hideLoader();
    setStatus("ERROR", "");
    showError("Failed: " + err.message);
  }
};

async function handleAudio() {
  if (!recordedAudioBlob) return {};
  const formData = new FormData();
  formData.append("audio", recordedAudioBlob, "meeting-audio.webm");
  const res = await fetch("http://localhost:8000/analyze-audio", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Audio API failed");
  return await res.json();
}

async function handleVideo() {
  if (!recordedVideoBlob) return {};
  const formData = new FormData();
  formData.append("video", recordedVideoBlob, "meeting-video.webm");
  const res = await fetch("http://localhost:8000/analyze-video", { method: "POST", body: formData });
  if (!res.ok) throw new Error("Video API failed");
  return await res.json();
}