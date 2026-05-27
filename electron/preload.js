const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("hesapDesktop", {
  getVersion: () => ipcRenderer.invoke("desktop:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:check-for-updates"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return () => undefined

    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on("desktop:update-status", listener)
    return () => ipcRenderer.removeListener("desktop:update-status", listener)
  },
})
