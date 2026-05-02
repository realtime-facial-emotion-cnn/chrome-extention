/**
 * summary.js
 *
 * Load order:
 *  1. Try localStorage.meetingSummary (set by popup.js after analysis)
 *  2. If empty, call POST /api/session/summary (when backend is running)
 *  3. If backend unreachable, fall back to DUMMY_DATA and show warning badge
 *
 * UPDATE LATER:
 *  - When popup.js stores data → this page reads it automatically (no change needed here)
 *  - When backend is running at localhost:8000 → the API_URL below handles it
 *  - If you move the backend to a different port/host, update API_URL
 */

const API_URL = "http://localhost:8000/api/session/summary";

// ─── Dummy data (fallback when nothing else is available) ────────────────────
const DUMMY_DATA = {
  grammar_score:      0.85,
  fluency_score:      0.78,
  confidence_score:   0.72,
  emotion_observation:"Mostly confident, with occasional nervous energy. Good overall composure.",
  strengths:          "Good eye contact; Clear pauses at key points; Structured answers",
  improvements:       "Reduce filler words (um, uh); Speak slightly slower; Add more examples",
  emotion_summary: {
    happy:    0.45,
    neutral:  0.30,
    fear:     0.08,
    angry:    0.05,
    surprise: 0.07,
    sad:      0.03,
    disgust:  0.02,
  }
};

// ─── Emotion bar colours ─────────────────────────────────────────────────────
const EMOTION_COLORS = {
  happy:    "#3ecfb2",
  neutral:  "#6c63ff",
  fear:     "#f5a623",
  angry:    "#ff6b6b",
  surprise: "#a78bfa",
  sad:      "#60a5fa",
  disgust:  "#fb923c",
};

// ─── Main entry ──────────────────────────────────────────────────────────────
async function loadData() {
  showState("loading");

  try {
    // 1. Check localStorage first
    const stored = localStorage.getItem("meetingSummary");
    if (stored) {
      const parsed = JSON.parse(stored);
      renderAll(parsed);
      return;
    }

    // 2. Try calling the backend API
    //    The popup should have stored transcript + emotion in localStorage too
    //    UPDATE LATER: grab transcript/emotion from localStorage and send them
    const transcript    = localStorage.getItem("transcript")     || DUMMY_DATA.emotion_observation;
    const emotionRaw    = localStorage.getItem("emotionSummary") || JSON.stringify(DUMMY_DATA.emotion_summary);
    const emotionSummary = JSON.parse(emotionRaw);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, emotion_summary: emotionSummary }),
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    // Attach emotion_summary so we can render bars
    data.emotion_summary = emotionSummary;
    renderAll(data);

  } catch (err) {
    // 3. Backend unreachable → use dummy data + show warning badge
    console.warn("[MeetingIQ] Backend unavailable, using dummy data:", err.message);
    document.getElementById("dummy-badge").style.display = "inline-block";
    renderAll(DUMMY_DATA);
  }
}

// ─── Re-run button ───────────────────────────────────────────────────────────
document.getElementById("rerun-btn").addEventListener("click", () => {
  localStorage.removeItem("meetingSummary"); // force fresh API call
  document.getElementById("dummy-badge").style.display = "none";
  loadData();
});

// ─── State helpers ───────────────────────────────────────────────────────────
function showState(state) {
  document.getElementById("loading-state").style.display  = state === "loading" ? "flex" : "none";
  document.getElementById("error-state").style.display    = state === "error"   ? "flex" : "none";
  document.getElementById("main-content").style.display   = state === "ready"   ? "block": "none";
}

// ─── Render everything ───────────────────────────────────────────────────────
function renderAll(data) {
  renderScore("grammar",    data.grammar_score);
  renderScore("fluency",    data.fluency_score);
  renderScore("confidence", data.confidence_score);

  document.getElementById("emotion-observation").textContent = data.emotion_observation || "–";

  const emotions = data.emotion_summary || {};
  renderEmotionBars(emotions);

  renderList("strengths-list",    data.strengths    || "");
  renderList("improvements-list", data.improvements || "");

  showState("ready");
}

// ── Score ring animation ─────────────────────────────────────────────────────
function renderScore(id, value) {
  const pct    = Math.max(0, Math.min(1, value || 0));
  const pctInt = Math.round(pct * 100);

  // Text
  document.getElementById(`val-${id}`).textContent = `${pctInt}%`;

  // Ring dashoffset  (circumference = 2πr = 2 * π * 32 ≈ 201)
  const circumference = 2 * Math.PI * 32;
  const offset = circumference - pct * circumference;
  const ring = document.getElementById(`ring-${id}`);
  // Trigger animation on next frame so CSS transition fires
  requestAnimationFrame(() => {
    ring.style.strokeDashoffset = offset;
  });

  // Colour class
  const card = document.getElementById(`card-${id}`);
  card.classList.remove("score-high", "score-mid", "score-low");
  if      (pct >= 0.75) card.classList.add("score-high");
  else if (pct >= 0.5)  card.classList.add("score-mid");
  else                  card.classList.add("score-low");
}

// ── Emotion bars ─────────────────────────────────────────────────────────────
function renderEmotionBars(emotions) {
  const container = document.getElementById("emotion-bars");
  container.innerHTML = "";

  // Sort by value descending
  const sorted = Object.entries(emotions).sort((a, b) => b[1] - a[1]);

  sorted.forEach(([label, value], i) => {
    const pct   = Math.round(value * 100);
    const color = EMOTION_COLORS[label] || "#6c63ff";

    const row = document.createElement("div");
    row.className = "emotion-row";
    row.innerHTML = `
      <span class="emotion-row-label">${label}</span>
      <div class="emotion-bar-track">
        <div class="emotion-bar-fill" data-pct="${pct}" style="background:${color}"></div>
      </div>
      <span class="emotion-row-pct">${pct}%</span>
    `;
    container.appendChild(row);
  });

  // Animate bars in after paint
  requestAnimationFrame(() => {
    container.querySelectorAll(".emotion-bar-fill").forEach((bar, i) => {
      setTimeout(() => {
        bar.style.width = bar.dataset.pct + "%";
      }, i * 80);
    });
  });
}

// ── Feedback lists ────────────────────────────────────────────────────────────
function renderList(elementId, text) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = "";
  const items = text.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = item;
    li.style.animationDelay = `${i * 80}ms`;
    ul.appendChild(li);
  });
}

// ─── Boot ────────────────────────────────────────────────────────────────────
loadData();