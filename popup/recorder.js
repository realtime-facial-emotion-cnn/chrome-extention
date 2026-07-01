let audioRecorder, videoRecorder;
let recordedAudioBlob, recordedVideoBlob;
let audioChunks = [], videoChunks = [];

const insightBtn = document.getElementById("insightBtn");

const USE_DUMMY = false; // 👈 set true only for demo

// ───────────────── AUDIO ─────────────────
async function handleAudio() {
  const formData = new FormData();
  formData.append("file", recordedAudioBlob, "audio.webm");

  const res = await fetch("http://localhost:8000/api/audio/transcribe", {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error("Audio API failed");
  return await res.json();
}

// ───────────────── VIDEO ─────────────────
async function handleVideo() {
  const formData = new FormData();
  formData.append("file", recordedVideoBlob, "video.webm");

  const res = await fetch("http://localhost:8000/api/video/emotion", {
    method: "POST",
    body: formData
  });

  if (!res.ok) throw new Error("Video API failed");
  return await res.json();
}

// ───────────────── INSIGHTS ─────────────────
insightBtn.onclick = async () => {
  if (!recordedAudioBlob && !recordedVideoBlob) {
    alert("Record audio/video first");
    return;
  }

  if (USE_DUMMY) {
    const dummy = {
      audioSummary: {
        grammar_score: 0.82,
        fluency_score: 0.75,
        confidence_score: 0.69,
        strengths: "Good communication",
        improvements: "Reduce filler words"
      },
      videoSummary: {
        emotion_observation: "Mostly neutral",
        emotion_summary: {
          happy: 0.4,
          neutral: 0.3,
          sad: 0.1,
          angry: 0.2
        }
      }
    };

    localStorage.setItem("meetingSummary", JSON.stringify(dummy));
    window.location.href = chrome.runtime.getURL("popup/summary.html");
    return;
  }

  try {
    const audio = await handleAudio();
    const video = await handleVideo();

    const finalData = {
      audioSummary: {
        transcript: audio.transcript
      },
      videoSummary: video.emotion_summary
    };

    localStorage.setItem("meetingSummary", JSON.stringify(finalData));

    window.location.href = chrome.runtime.getURL("popup/summary.html");

  } catch (err) {
    alert("Error: " + err.message);
  }
};