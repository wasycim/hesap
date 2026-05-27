const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")

const defaultAppUrl = "https://pamukkaleturizm.info"
let mainWindow = null
let updateCheckInFlight = false

function normalizeAppUrl(value) {
  try {
    const url = new URL(value || defaultAppUrl)
    if (url.protocol !== "https:" && url.protocol !== "http:") return defaultAppUrl
    return url.toString()
  } catch {
    return defaultAppUrl
  }
}

const appUrl = normalizeAppUrl(process.env.HESAP_DESKTOP_URL)
const appOrigin = new URL(appUrl).origin
const allowedOrigins = new Set([new URL(defaultAppUrl).origin, appOrigin])

function getIconPath() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png"
  return path.join(__dirname, "..", "desktop", "build", iconFile)
}

function isAllowedUrl(value) {
  try {
    const url = new URL(value)
    return allowedOrigins.has(url.origin)
  } catch {
    return false
  }
}

function sendUpdateStatus(status, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send("desktop:update-status", {
    status,
    ...payload,
  })
}

function configurePermissions() {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    const requestUrl = details.requestingUrl || appUrl
    const allowed = isAllowedUrl(requestUrl) && ["media", "notifications"].includes(permission)
    callback(allowed)
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: "Hesap",
    icon: getIconPath(),
    backgroundColor: "#0f172a",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
    },
  })

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) return { action: "allow" }
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedUrl(url)) return
    event.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.loadURL(appUrl)
}

async function checkForUpdates({ manual = false } = {}) {
  if (updateCheckInFlight) return { status: "checking" }

  if (!app.isPackaged) {
    if (manual) {
      await dialog.showMessageBox(mainWindow, {
        type: "info",
        title: "Gelistirme modu",
        message: "Guncelleme kontrolu paketlenmis .exe surumunde calisir.",
      })
    }
    return { status: "development" }
  }

  updateCheckInFlight = true
  sendUpdateStatus("checking")

  try {
    const result = await autoUpdater.checkForUpdates()
    return { status: "checked", updateInfo: result?.updateInfo ?? null }
  } catch (error) {
    sendUpdateStatus("error", { message: error instanceof Error ? error.message : "Guncelleme kontrolu basarisiz." })
    if (manual) {
      await dialog.showMessageBox(mainWindow, {
        type: "error",
        title: "Guncelleme kontrolu basarisiz",
        message: "Guncelleme bilgisi alinamadi.",
        detail: error instanceof Error ? error.message : String(error),
      })
    }
    return { status: "error" }
  } finally {
    updateCheckInFlight = false
  }
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus("checking")
  })

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("not-available")
  })

  autoUpdater.on("update-available", async (info) => {
    sendUpdateStatus("available", { version: info.version })
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Yeni guncelleme var",
      message: "Yeni guncelleme var",
      detail: `Hesap ${info.version} surumu hazir. Simdi indirip kurmak ister misiniz?`,
      buttons: ["Guncelle", "Sonra"],
      defaultId: 0,
      cancelId: 1,
    })

    if (choice.response === 0) {
      sendUpdateStatus("downloading", { version: info.version })
      autoUpdater.downloadUpdate().catch((error) => {
        sendUpdateStatus("error", { message: error instanceof Error ? error.message : "Guncelleme indirilemedi." })
      })
    }
  })

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus("download-progress", {
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on("update-downloaded", async (info) => {
    sendUpdateStatus("downloaded", { version: info.version })
    const choice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Guncelleme indirildi",
      message: "Guncelleme hazir",
      detail: "Uygulama yeniden baslatilacak ve yeni surum otomatik kurulacak.",
      buttons: ["Yeniden baslat ve kur", "Sonra"],
      defaultId: 0,
      cancelId: 1,
    })

    if (choice.response === 0) {
      autoUpdater.quitAndInstall(false, true)
    }
  })

  autoUpdater.on("error", (error) => {
    sendUpdateStatus("error", { message: error instanceof Error ? error.message : "Guncelleme hatasi." })
  })
}

app.setAppUserModelId("info.pamukkaleturizm.hesap")

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  configurePermissions()
  configureAutoUpdater()
  createWindow()
  setTimeout(() => {
    checkForUpdates().catch(() => undefined)
  }, 2500)
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

ipcMain.handle("desktop:get-version", () => app.getVersion())
ipcMain.handle("desktop:check-for-updates", () => checkForUpdates({ manual: true }))
