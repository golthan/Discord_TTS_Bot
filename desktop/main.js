const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const path = require("path");

const STOP_GRACE_MS = 8000;

let win = null;
let botProcess = null;
let stopRequested = false;
let stopTimer = null;
let quitting = false;

// ── Paths ─────────────────────────────────────────────────────
// The ffmpeg binary is kept outside the asar archive because an executable
// inside an archive cannot be spawned.
function unpacked(p) {
  return p.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
}

// Deliberately NOT unpacked: the bot must load from inside the archive so that
// `require("discord.js")` resolves against app.asar/node_modules. Pointing at
// the unpacked copy breaks module resolution.
function botEntry() {
  return path.join(app.getAppPath(), "dist", "index.js");
}

function ffmpegPath() {
  try {
    return unpacked(require("ffmpeg-static"));
  } catch {
    return null;
  }
}

// The bot resolves data/ and tts_cache/ against its working directory, which
// must stay writable — Program Files is not.
function workDir() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ── Configuration ─────────────────────────────────────────────
const REQUIRED_KEYS = ["DISCORD_TOKEN", "CLIENT_ID"];

// A portable build extracts itself to a temp folder, so process.execPath is not
// where the user put the .exe — electron-builder exposes the real folder here.
function exeDir() {
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
}

// Two supported layouts, in priority order:
//   1. token baked in at build time  → `npm run dist` (private build)
//   2. .env sitting next to the .exe → `npm run dist:share` (safe to hand out)
function envSources() {
  const sources = [
    { label: "cấu hình nhúng sẵn", file: path.join(__dirname, "embedded-env.json"), json: true },
    { label: ".env cạnh file .exe", file: path.join(exeDir(), ".env") },
  ];

  if (!app.isPackaged) {
    sources.push({ label: ".env trong thư mục dự án", file: path.join(__dirname, "..", ".env") });
  }

  return sources;
}

function loadEnv() {
  for (const source of envSources()) {
    if (!fs.existsSync(source.file)) continue;

    let values;
    try {
      const raw = fs.readFileSync(source.file, "utf8");
      values = source.json ? JSON.parse(raw) : require("dotenv").parse(raw);
    } catch (err) {
      return { error: `Không đọc được ${source.file}: ${err.message}` };
    }

    const missing = REQUIRED_KEYS.filter((key) => !values[key]);
    if (missing.length > 0) {
      return { error: `${source.file} thiếu: ${missing.join(", ")}` };
    }

    return { values, label: source.label };
  }

  return {
    error: [
      "Không tìm thấy cấu hình.",
      `Hãy tạo file tên .env đặt cùng thư mục với file .exe (${exeDir()}),`,
      "nội dung gồm 2 dòng:",
      "    DISCORD_TOKEN=<token cua bot>",
      "    CLIENT_ID=<id ung dung>",
    ].join(" "),
  };
}

// ── Settings ──────────────────────────────────────────────────
function settingsFile() {
  return path.join(app.getPath("userData"), "desktop-settings.json");
}

function readSettings() {
  try {
    return { autoStart: true, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch {
    return { autoStart: true };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), "utf8");
}

// ── Renderer messaging ────────────────────────────────────────
function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

function log(level, text) {
  send("bot:log", { level, text, at: Date.now() });
}

function status() {
  if (stopRequested) return "stopping";
  return botProcess ? "running" : "stopped";
}

function pushStatus() {
  send("bot:status", status());
}

// Streams arrive in arbitrary chunks, so hold partial lines until a newline.
function pipeLines(stream, level) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) log(level, line);
    }
  });
  stream.on("end", () => {
    if (buffer.trim()) log(level, buffer);
    buffer = "";
  });
}

// ── Bot lifecycle ─────────────────────────────────────────────
function startBot() {
  if (botProcess) return { ok: true };

  const env = loadEnv();
  if (env.error) {
    log("error", env.error);
    return { ok: false, error: "missing-env" };
  }
  log("info", `Đọc cấu hình từ: ${env.label}`);

  const entry = botEntry();
  if (!fs.existsSync(entry)) {
    log("error", `Không tìm thấy ${entry}. Hãy chạy: npm run build`);
    return { ok: false, error: "missing-build" };
  }

  const ffmpeg = ffmpegPath();
  if (!ffmpeg || !fs.existsSync(ffmpeg)) {
    log("warn", "Không tìm thấy ffmpeg đi kèm — bot sẽ thử dùng ffmpeg trong PATH của máy.");
  }

  stopRequested = false;
  log("info", "Đang khởi động bot…");

  botProcess = fork(entry, [], {
    cwd: workDir(),
    silent: true,
    env: {
      ...process.env,
      ...env.values,
      // Runs the Electron binary as a plain Node.js runtime for the child.
      ELECTRON_RUN_AS_NODE: "1",
      ...(ffmpeg && fs.existsSync(ffmpeg) ? { FFMPEG_BIN: ffmpeg } : {}),
    },
  });

  pipeLines(botProcess.stdout, "info");
  pipeLines(botProcess.stderr, "error");

  botProcess.on("error", (err) => {
    log("error", `Không thể khởi động tiến trình bot: ${err.message}`);
  });

  botProcess.on("exit", (code, signal) => {
    clearTimeout(stopTimer);
    botProcess = null;

    if (stopRequested) {
      log("info", "Bot đã dừng.");
    } else if (code === 0) {
      log("info", "Bot đã thoát.");
    } else {
      log("error", `Bot dừng đột ngột (mã ${code ?? signal}). Xem log phía trên để biết nguyên nhân.`);
    }

    stopRequested = false;
    pushStatus();

    // Window close is waiting on this shutdown.
    if (quitting) app.quit();
  });

  pushStatus();
  return { ok: true };
}

function stopBot() {
  if (!botProcess || stopRequested) return { ok: true };

  stopRequested = true;
  pushStatus();
  log("info", "Đang dừng bot…");

  // Ask the bot to leave voice channels first; kill only if it hangs.
  botProcess.send("shutdown");
  stopTimer = setTimeout(() => {
    if (botProcess) {
      log("warn", "Bot không phản hồi, buộc phải tắt.");
      botProcess.kill();
    }
  }, STOP_GRACE_MS);

  return { ok: true };
}

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 940,
    height: 680,
    minWidth: 640,
    minHeight: 460,
    backgroundColor: "#0f1115",
    title: "Discord TTS Bot",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Keep external links out of the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── App wiring ────────────────────────────────────────────────
// A second instance would join the same voice channel and double every message.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  ipcMain.handle("bot:start", () => startBot());
  ipcMain.handle("bot:stop", () => stopBot());
  ipcMain.handle("bot:status", () => status());
  ipcMain.handle("bot:getSettings", () => readSettings());
  ipcMain.handle("bot:setAutoStart", (_e, value) => {
    const settings = { ...readSettings(), autoStart: Boolean(value) };
    writeSettings(settings);
    return settings;
  });
  ipcMain.handle("bot:openDataFolder", () => shell.openPath(workDir()));

  app.whenReady().then(() => {
    createWindow();

    win.webContents.once("did-finish-load", () => {
      log("info", `Thư mục dữ liệu: ${workDir()}`);
      if (readSettings().autoStart) startBot();
      else log("info", 'Tự động khởi động đang tắt. Bấm "Bật bot" để chạy.');
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Give the bot a moment to disconnect cleanly instead of killing it outright.
  // The child's exit handler re-triggers quit as soon as it is actually gone.
  app.on("before-quit", (event) => {
    if (!botProcess || quitting) return;
    event.preventDefault();
    quitting = true;
    stopBot();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
