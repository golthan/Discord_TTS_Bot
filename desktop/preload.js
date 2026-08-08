const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("botAPI", {
  start: () => ipcRenderer.invoke("bot:start"),
  stop: () => ipcRenderer.invoke("bot:stop"),
  getStatus: () => ipcRenderer.invoke("bot:status"),
  getSettings: () => ipcRenderer.invoke("bot:getSettings"),
  setAutoStart: (value) => ipcRenderer.invoke("bot:setAutoStart", value),
  openDataFolder: () => ipcRenderer.invoke("bot:openDataFolder"),
  onLog: (callback) => ipcRenderer.on("bot:log", (_event, entry) => callback(entry)),
  onStatus: (callback) => ipcRenderer.on("bot:status", (_event, value) => callback(value)),
});
