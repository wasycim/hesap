const { app, BrowserWindow, Menu, dialog, ipcMain, session, shell, Tray, Notification, nativeImage } = require("electron")
const { autoUpdater } = require("electron-updater")
const path = require("path")
const fs = require("fs")

const defaultAppUrl = "https://pamukkaleturizm.info"
let mainWindow = null
let tray = null
let isQuitting = false
let hasShownTrayHint = false
let updateCheckInFlight = false
let updateInstallInProgress = false
let downloadedUpdateInfo = null

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
const appShellUrl = `${appOrigin}/dashboard?desktopApp=1`
const appOfflineShellUrl = `${appOrigin}/dashboard?desktopApp=1&desktopOffline=1`
const allowedOrigins = new Set([new URL(defaultAppUrl).origin, appOrigin])
let isShowingOfflinePage = false

function sanitizeFileName(value) {
  return String(value || "Hesap-Rapor")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Hesap-Rapor"
}

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

function isInternalBlankWindow(value) {
  return !value || value === "about:blank" || value.startsWith("about:blank")
}

function getPopupWindowOptions() {
  return {
    width: 1100,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: "Hesap PDF",
    parent: mainWindow || undefined,
    modal: false,
    icon: getIconPath(),
    backgroundColor: "#f8fafc",
    show: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      spellcheck: false,
    },
  }
}

function getOfflinePageUrl() {
  const html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>&#304;nternet ba&#287;lant&#305;s&#305; yok</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #070b14;
      color: #f8fafc;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(14, 165, 233, 0.24), transparent 34rem),
        radial-gradient(circle at bottom right, rgba(245, 158, 11, 0.2), transparent 30rem),
        linear-gradient(135deg, #070b14 0%, #111827 52%, #0f172a 100%);
    }

    main {
      width: min(92vw, 520px);
      padding: 40px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.78);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
      text-align: center;
      backdrop-filter: blur(18px);
    }

    .mark {
      width: 76px;
      height: 76px;
      margin: 0 auto 24px;
      display: grid;
      place-items: center;
      border-radius: 24px;
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(248, 250, 252, 0.14);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 40px rgba(0, 0, 0, 0.28);
    }

    .mark svg {
      width: 42px;
      height: 42px;
      color: #f59e0b;
    }

    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 38px);
      line-height: 1.08;
      letter-spacing: 0;
    }

    p {
      margin: 16px auto 0;
      max-width: 34rem;
      color: #cbd5e1;
      font-size: 16px;
      line-height: 1.65;
    }

    button {
      margin-top: 28px;
      min-height: 48px;
      padding: 0 24px;
      border: 0;
      border-radius: 14px;
      color: #111827;
      background: #f59e0b;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 14px 32px rgba(245, 158, 11, 0.28);
    }

    button:hover {
      background: #fbbf24;
    }

    small {
      display: block;
      margin-top: 18px;
      color: #94a3b8;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M7.5 7.5a6.5 6.5 0 0 1 10.4 7.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M16.5 16.5A6.5 6.5 0 0 1 6.1 8.9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        <path d="M15.8 7.4h2.8V4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M8.2 16.6H5.4v2.8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>
    <h1>&#304;nternet ba&#287;lant&#305;s&#305; yok</h1>
    <p>L&#252;tfen internet ba&#287;lant&#305;n&#305;z&#305; kontrol edin. Ba&#287;lant&#305; geri geldi&#287;inde uygulamay&#305; tekrar y&#252;klemek i&#231;in a&#351;a&#287;&#305;daki butona t&#305;klay&#305;n.</p>
    <button type="button" id="reload">Yeniden y&#252;kle</button>
    <small>Hesap uygulamas&#305; ba&#287;lant&#305; geri geldi&#287;inde kald&#305;&#287;&#305; yerden devam eder.</small>
  </main>
  <script>
    document.getElementById("reload").addEventListener("click", function () {
      window.location.href = ${JSON.stringify(appShellUrl)}
    })
  </script>
</body>
</html>`

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function showOfflinePage() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (!isShowingOfflinePage) {
    isShowingOfflinePage = true
    mainWindow.loadURL(appOfflineShellUrl).catch(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      mainWindow.loadURL(getOfflinePageUrl()).catch(() => undefined)
    })
    return
  }

  mainWindow.loadURL(getOfflinePageUrl()).catch(() => undefined)
}

function sendUpdateStatus(status, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send("desktop:update-status", {
    status,
    ...payload,
  })
}

function sendWindowState() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send("desktop:window-state", {
    isMaximized: mainWindow.isMaximized(),
    isFullScreen: mainWindow.isFullScreen(),
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
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    title: "Hesap",
    icon: getIconPath(),
    backgroundColor: "#0f172a",
    frame: false,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
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

  mainWindow.on("maximize", () => sendWindowState())
  mainWindow.on("unmaximize", () => sendWindowState())
  mainWindow.on("enter-full-screen", () => sendWindowState())
  mainWindow.on("leave-full-screen", () => sendWindowState())

  mainWindow.on("close", (event) => {
    if (isQuitting || updateInstallInProgress || process.platform === "darwin") return
    event.preventDefault()
    mainWindow.hide()

    if (!hasShownTrayHint && Notification.isSupported()) {
      hasShownTrayHint = true
      new Notification({
        title: "Hesap arka planda calisiyor",
        body: "Bildirimleri alabilmek icin uygulama sistem tepsisinde acik kalacak.",
        icon: getIconPath(),
      }).show()
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalBlankWindow(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: getPopupWindowOptions(),
      }
    }
    if (isAllowedUrl(url)) return { action: "allow" }
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedUrl(url) || isInternalBlankWindow(url)) return
    event.preventDefault()
    shell.openExternal(url)
  })

  mainWindow.webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (!isMainFrame || isInPlace) return
    if (isAllowedUrl(url) && !String(url).includes("desktopOffline=1")) isShowingOfflinePage = false
  })

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || !isAllowedUrl(validatedURL)) return
    showOfflinePage()
  })

  mainWindow.loadURL(appShellUrl).catch(() => {
    showOfflinePage()
  })
}

function createTray() {
  if (tray) return
  tray = new Tray(getIconPath())
  tray.setToolTip("Hesap")
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "Hesap'i ac",
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) createWindow()
        mainWindow.show()
        mainWindow.focus()
      },
    },
    {
      label: "Guncellemeyi kontrol et",
      click: () => checkForUpdates({ manual: true }).catch(() => undefined),
    },
    { type: "separator" },
    {
      label: "Tamamen kapat",
      click: () => {
        quitApplication()
      },
    },
  ]))
  tray.on("double-click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    mainWindow.show()
    mainWindow.focus()
  })
}

function setAppBadge(count) {
  const normalized = Number.isFinite(Number(count)) ? Math.max(0, Math.min(99, Math.round(Number(count)))) : 0
  if (process.platform === "darwin" || process.platform === "linux") {
    app.setBadgeCount(normalized)
  }
  if (process.platform === "win32" && mainWindow && !mainWindow.isDestroyed()) {
    if (normalized > 0) {
      const label = normalized > 9 ? "9+" : String(normalized)
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="30" fill="#ef4444"/><text x="32" y="41" text-anchor="middle" font-family="Arial" font-size="${label.length > 1 ? 28 : 34}" font-weight="900" fill="white">${label}</text></svg>`
      mainWindow.setOverlayIcon(nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), `${normalized} yeni bildirim`)
    } else {
      mainWindow.setOverlayIcon(null, "")
    }
  }
  if (tray) {
    tray.setToolTip(normalized > 0 ? `Hesap - ${normalized} yeni bildirim` : "Hesap")
  }
}

function configureStartup() {
  if (process.platform !== "win32" || !app.isPackaged) return
  const openAtLogin = readStartupPreference()
  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: false,
    path: app.getPath("exe"),
  })
}

function prepareForRealQuit() {
  isQuitting = true
  if (tray) {
    tray.destroy()
    tray = null
  }
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.removeAllListeners("close")
  }
}

function quitApplication() {
  prepareForRealQuit()
  app.quit()
}

function installDownloadedUpdate() {
  if (updateInstallInProgress) {
    return { ok: true, installing: true }
  }

  if (!downloadedUpdateInfo) {
    return { ok: false, error: "Indirilmis guncelleme bulunamadi." }
  }

  updateInstallInProgress = true
  sendUpdateStatus("installing", {
    version: downloadedUpdateInfo?.version,
    message: "Uygulama kapatiliyor ve guncelleme kuruluyor.",
  })
  prepareForRealQuit()

  setTimeout(() => {
    autoUpdater.quitAndInstall(true, true)
  }, 250)

  return { ok: true }
}

function startupPreferencePath() {
  return path.join(app.getPath("userData"), "startup-preference.json")
}

function readStartupPreference() {
  try {
    const raw = fs.readFileSync(startupPreferencePath(), "utf8")
    const parsed = JSON.parse(raw)
    return parsed?.openAtLogin === true
  } catch {
    return false
  }
}

function writeStartupPreference(openAtLogin) {
  const enabled = Boolean(openAtLogin)
  fs.mkdirSync(app.getPath("userData"), { recursive: true })
  fs.writeFileSync(startupPreferencePath(), JSON.stringify({ openAtLogin: enabled }, null, 2))
  if (process.platform === "win32" && app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: false,
      path: app.getPath("exe"),
    })
  }
  return enabled
}

async function checkForUpdates({ manual = false } = {}) {
  if (updateCheckInFlight) return { status: "checking" }

  if (downloadedUpdateInfo) {
    sendUpdateStatus("downloaded", { version: downloadedUpdateInfo.version })
    return { status: "downloaded", updateInfo: downloadedUpdateInfo }
  }

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
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false

  autoUpdater.on("checking-for-update", () => {
    sendUpdateStatus("checking")
  })

  autoUpdater.on("update-not-available", () => {
    sendUpdateStatus("not-available")
  })

  autoUpdater.on("update-available", (info) => {
    sendUpdateStatus("available", { version: info.version })
    sendUpdateStatus("downloading", { version: info.version })
  })

  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus("download-progress", {
      percent: Math.round(progress.percent || 0),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on("update-downloaded", async (info) => {
    downloadedUpdateInfo = info
    sendUpdateStatus("downloaded", {
      version: info.version,
      message: "Guncelleme indirildi. Kurulumu uygulama icinden baslatabilirsiniz.",
    })
  })

  autoUpdater.on("before-quit-for-update", () => {
    updateInstallInProgress = true
    prepareForRealQuit()
  })

  autoUpdater.on("error", (error) => {
    sendUpdateStatus("error", { message: error instanceof Error ? error.message : "Guncelleme hatasi." })
  })
}

app.setAppUserModelId("wasy.system.hesap")

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  configureStartup()
  configurePermissions()
  configureAutoUpdater()
  createTray()
  createWindow()
  setTimeout(() => {
    checkForUpdates().catch(() => undefined)
  }, 2500)
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show()
})

app.on("window-all-closed", () => {
  if (process.platform === "darwin") return
})

app.on("before-quit", () => {
  prepareForRealQuit()
})

ipcMain.handle("desktop:get-version", () => app.getVersion())
ipcMain.handle("desktop:get-context", () => ({
  version: app.getVersion(),
  platform: process.platform,
  appName: "Hesap",
  desktopMode: true,
  isPackaged: app.isPackaged,
  isMaximized: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isMaximized()),
}))
ipcMain.handle("desktop:window-control", (_event, action) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { ok: false }

  if (action === "minimize") {
    mainWindow.minimize()
    return { ok: true }
  }

  if (action === "toggle-maximize") {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
    sendWindowState()
    return { ok: true, maximized: mainWindow.isMaximized() }
  }

  if (action === "close") {
    mainWindow.close()
    return { ok: true }
  }

  if (action === "reload") {
    isShowingOfflinePage = false
    mainWindow.loadURL(appShellUrl).catch(() => showOfflinePage())
    return { ok: true }
  }

  return { ok: false }
})
ipcMain.handle("desktop:check-for-updates", () => checkForUpdates({ manual: true }))
ipcMain.handle("desktop:install-downloaded-update", () => installDownloadedUpdate())
ipcMain.handle("desktop:get-update-state", () => ({
  downloaded: Boolean(downloadedUpdateInfo),
  version: downloadedUpdateInfo?.version || null,
  installing: updateInstallInProgress,
}))
ipcMain.handle("desktop:set-badge-count", (_event, count) => {
  setAppBadge(count)
  return { ok: true }
})
ipcMain.handle("desktop:get-startup-enabled", () => ({ enabled: readStartupPreference() }))
ipcMain.handle("desktop:set-startup-enabled", (_event, enabled) => ({ enabled: writeStartupPreference(enabled) }))
ipcMain.handle("desktop:save-pdf-report", async (_event, payload = {}) => {
  const title = sanitizeFileName(payload.title)
  const html = typeof payload.html === "string" ? payload.html : ""
  const orientation = payload.orientation === "portrait" ? "portrait" : "landscape"

  if (!html.trim()) {
    return { ok: false, error: "PDF icerigi bos." }
  }

  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: "PDF kaydet",
    defaultPath: `${title}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  })

  if (canceled || !filePath) {
    return { ok: false, canceled: true }
  }

  const pdfWindow = new BrowserWindow({
    show: false,
    width: orientation === "landscape" ? 1400 : 900,
    height: orientation === "landscape" ? 900 : 1200,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  })

  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdfData = await pdfWindow.webContents.printToPDF({
      landscape: orientation === "landscape",
      printBackground: true,
      pageSize: "A4",
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    })
    fs.writeFileSync(filePath, pdfData)
    return { ok: true, filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "PDF kaydedilemedi." }
  } finally {
    if (!pdfWindow.isDestroyed()) pdfWindow.close()
  }
})
