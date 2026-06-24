const EMOTION_COLORS = {
  happy: "#6cf0c2", neutral: "#7ecef4", surprise: "#f0d96c",
  fear: "#c46cf0", angry: "#f06c6c", sad: "#7090f0", disgust: "#a0f06c"
};

function pct(val) { return Math.round((val || 0) * 100); }

function setArc(id, value) {
  const arc = document.getElementById(id);
  if (arc) arc.style.strokeDashoffset = 157 - (value * 157);
}

function render(data) {
  const audio = data.audioSummary || {};
  const video = data.videoSummary || {};

  const grammar    = audio.grammar_score    || 0;
  const fluency    = audio.fluency_score    || 0;
  const confidence = audio.confidence_score || 0;

  document.getElementById("grammarNum").textContent    = pct(grammar)    + "%";
  document.getElementById("fluencyNum").textContent    = pct(fluency)    + "%";
  document.getElementById("confidenceNum").textContent = pct(confidence) + "%";

  setTimeout(() => {
    setArc("grammarArc",    grammar);
    setArc("fluencyArc",    fluency);
    setArc("confidenceArc", confidence);
  }, 100);

  document.getElementById("strengthsText").textContent    = audio.strengths    || "No data";
  document.getElementById("improvementsText").textContent = audio.improvements || "No data";
  document.getElementById("emotionObservation").textContent = video.emotion_observation || "No facial data recorded.";

  const container = document.getElementById("emotionBars");
  container.innerHTML = "";

  const sorted = Object.entries(video.emotion_summary || {}).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([emotion, value]) => {
    const color = EMOTION_COLORS[emotion] || "#aaa";
    const row = document.createElement("div");
    row.className = "emotion-row";
    row.innerHTML = `
      <span class="emotion-name">${emotion}</span>
      <div class="emotion-bar-wrap">
        <div class="emotion-bar-fill" style="background:${color}" data-pct="${pct(value)}"></div>
      </div>
      <span class="emotion-pct">${pct(value)}%</span>
    `;
    container.appendChild(row);
  });

  setTimeout(() => {
    document.querySelectorAll(".emotion-bar-fill").forEach(bar => {
      bar.style.width = bar.dataset.pct + "%";
    });
  }, 100);
}

window.addEventListener("DOMContentLoaded", () => {
  const raw = localStorage.getItem("meetingSummary");
  if (!raw) {
    render({
      audioSummary: { grammar_score: 0.82, fluency_score: 0.75, confidence_score: 0.69, strengths: "Clear articulation; Good pacing", improvements: "Reduce filler words; Maintain eye contact" },
      videoSummary: { emotion_observation: "Mostly neutral with occasional confidence peaks", emotion_summary: { happy: 0.38, neutral: 0.35, surprise: 0.10, fear: 0.07, angry: 0.05, sad: 0.03, disgust: 0.02 } }
    });
    return;
  }
  try { render(JSON.parse(raw)); }
  catch (e) { document.querySelector(".page").innerHTML = "<p style='color:#f06c9b;padding:20px;font-family:monospace'>Error reading summary data.</p>"; }
});