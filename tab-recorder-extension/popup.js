const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const dotEl = document.getElementById('statusDot');

function renderState(state) {
  if (state.recording) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
    dotEl.classList.add('live');
    statusEl.textContent = 'Recording…';
  } else if (state.processing) {
    startBtn.style.display = 'none';
    stopBtn.style.display = 'none';
    dotEl.classList.remove('live');
    statusEl.textContent = 'Finishing up…';
  } else {
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
    dotEl.classList.remove('live');
    statusEl.textContent = state.lastError ? `Error: ${state.lastError}` : 'Idle';
  }
}

// Ask the background service worker for the current, persisted state
// every time the popup opens. This is what makes the popup "remember"
// that a recording is in progress even after the permission dialog
// closed it.
chrome.runtime.sendMessage({ type: 'get-state' }, (state) => {
  if (state) renderState(state);
});

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  statusEl.textContent = 'Starting…';
  chrome.runtime.sendMessage({ type: 'start-recording' }, (res) => {
    startBtn.disabled = false;
    if (res && res.ok) {
      renderState({ recording: true });
    } else {
      statusEl.textContent = `Error: ${res && res.error ? res.error : 'unknown'}`;
    }
  });
});

stopBtn.addEventListener('click', () => {
  stopBtn.disabled = true;
  statusEl.textContent = 'Stopping…';
  chrome.runtime.sendMessage({ type: 'stop-recording' }, (res) => {
    stopBtn.disabled = false;
    if (res && res.ok) {
      renderState({ recording: false });
    } else {
      statusEl.textContent = `Error: ${res && res.error ? res.error : 'unknown'}`;
    }
  });
});

// Keep the popup in sync if state changes while it happens to be open
// (e.g. recording finishes processing in the background).
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'state-changed') {
    renderState(msg.state);
  }
});
