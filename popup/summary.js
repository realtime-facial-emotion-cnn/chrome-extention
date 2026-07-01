function pct(val) {
  return Math.round((val || 0) * 100);
}

function render(data) {
  const audio = data.audioSummary || {};
  const video = data.videoSummary || {};

  document.getElementById("strengthsText").textContent =
    audio.strengths || "No data";

  document.getElementById("improvementsText").textContent =
    audio.improvements || "No data";

  document.getElementById("emotionObservation").textContent =
    video.emotion_observation || "No data";

  const container = document.getElementById("emotionBars");
  container.innerHTML = "";

  const emotions = video.emotion_summary || {};

  Object.entries(emotions).forEach(([k, v]) => {
    const row = document.createElement("div");
    row.innerHTML = `
      <div>${k}</div>
      <div>${pct(v)}%</div>
    `;
    container.appendChild(row);
  });
}

window.onload = () => {
  const data = JSON.parse(localStorage.getItem("meetingSummary"));
  if (data) render(data);
};