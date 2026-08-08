const MAX_LINES = 3000;

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const clearBtn = document.getElementById("clearBtn");
const dataBtn = document.getElementById("dataBtn");
const autoStart = document.getElementById("autoStart");
const autoScroll = document.getElementById("autoScroll");
const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const logEl = document.getElementById("log");

const LABELS = {
  running: "Đang chạy",
  stopped: "Đã tắt",
  stopping: "Đang tắt…",
};

function applyStatus(state) {
  statusEl.className = `status status--${state}`;
  statusText.textContent = LABELS[state] ?? state;
  startBtn.disabled = state !== "stopped";
  stopBtn.disabled = state !== "running";
}

function timestamp(at) {
  return new Date(at).toLocaleTimeString("vi-VN", { hour12: false });
}

// The bot prefixes its own warnings; use that to colour the line correctly.
function classify(entry) {
  const text = entry.text;
  if (/^\[(shutdown|health)\]/.test(text)) return "app";
  if (entry.level === "error" && /warn|Warning/i.test(text)) return "warn";
  return entry.level;
}

function append(entry) {
  const atBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 40;

  const line = document.createElement("div");
  line.className = `line line--${classify(entry)}`;

  const time = document.createElement("span");
  time.className = "line__time";
  time.textContent = timestamp(entry.at);

  const text = document.createElement("span");
  text.className = "line__text";
  text.textContent = entry.text;

  line.append(time, text);
  logEl.append(line);

  while (logEl.childElementCount > MAX_LINES) logEl.firstElementChild.remove();

  if (autoScroll.checked && atBottom) logEl.scrollTop = logEl.scrollHeight;
}

startBtn.addEventListener("click", () => {
  startBtn.disabled = true;
  window.botAPI.start();
});

stopBtn.addEventListener("click", () => {
  stopBtn.disabled = true;
  window.botAPI.stop();
});

clearBtn.addEventListener("click", () => {
  logEl.replaceChildren();
});

dataBtn.addEventListener("click", () => {
  window.botAPI.openDataFolder();
});

autoStart.addEventListener("change", () => {
  window.botAPI.setAutoStart(autoStart.checked);
});

window.botAPI.onLog(append);
window.botAPI.onStatus(applyStatus);

(async () => {
  const [state, settings] = await Promise.all([
    window.botAPI.getStatus(),
    window.botAPI.getSettings(),
  ]);
  applyStatus(state);
  autoStart.checked = settings.autoStart;
})();
