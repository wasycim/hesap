const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("hesapDesktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
  getContext: () => ipcRenderer.invoke("desktop:get-context"),
  windowControl: (action) => ipcRenderer.invoke("desktop:window-control", action),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  installDownloadedUpdate: () => ipcRenderer.invoke("desktop:install-downloaded-update"),
  getUpdateState: () => ipcRenderer.invoke("desktop:get-update-state"),
  savePdfReport: (payload) => ipcRenderer.invoke("desktop:save-pdf-report", payload),
  setBadgeCount: (count) => ipcRenderer.invoke("desktop:set-badge-count", count),
  getStartupEnabled: () => ipcRenderer.invoke("desktop:get-startup-enabled"),
  setStartupEnabled: (enabled) => ipcRenderer.invoke("desktop:set-startup-enabled", enabled),
  showNotification: (payload) => ipcRenderer.invoke("desktop:show-notification", payload),
  onNavigate: (callback) => {
    if (typeof callback !== "function") return () => undefined

    const listener = (_event, href) => callback(href)
    ipcRenderer.on("desktop:navigate", listener)
    return () => ipcRenderer.removeListener("desktop:navigate", listener)
  },
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => undefined

    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("desktop:update-status", listener)
    return () => ipcRenderer.removeListener("desktop:update-status", listener)
  },
  onWindowState: (callback) => {
    if (typeof callback !== "function") return () => undefined

    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("desktop:window-state", listener)
    return () => ipcRenderer.removeListener("desktop:window-state", listener)
  },
})
