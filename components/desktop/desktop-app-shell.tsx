"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Maximize2, Minus, RefreshCcw, Square, X } from "lucide-react"

type DesktopContext = {
  version?: string
  platform?: string
  appName?: string
  desktopMode?: boolean
  isPackaged?: boolean
  isMaximized?: boolean
}

type DesktopBridge = {
  getContext?: () => Promise<DesktopContext>
  getVersion?: () => Promise<string>
  windowControl?: (action: "minimize" | "toggle-maximize" | "close" | "reload") => Promise<{ ok: boolean; maximized?: boolean }>
  checkForUpdates?: () => Promise<{ status?: string } | unknown>
  onUpdateStatus?: (callback: (payload: { status?: string; version?: string; message?: string }) => void) => () => void
  onWindowState?: (callback: (payload: { isMaximized?: boolean; isFullScreen?: boolean }) => void) => () => void
}

function getDesktopBridge() {
  if (typeof window === "undefined") return null
  return (window as typeof window & { hesapDesktop?: DesktopBridge }).hesapDesktop ?? null
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(date)
}

export function DesktopAppShell({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [context, setContext] = useState<DesktopContext>({})
  const [isMaximized, setIsMaximized] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [updateNotice, setUpdateNotice] = useState<string | null>(null)
  const [clock, setClock] = useState(() => formatClock(new Date()))
  const noticeTimerRef = useRef<number | null>(null)

  function showUpdateNotice(message: string | null, timeout = 3500) {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = null
    }

    setUpdateNotice(message)

    if (message && timeout > 0) {
      noticeTimerRef.current = window.setTimeout(() => {
        setUpdateNotice(null)
        noticeTimerRef.current = null
      }, timeout)
    }
  }

  useEffect(() => {
    const bridge = getDesktopBridge()
    if (!bridge) return

    setActive(true)
    document.documentElement.classList.add("desktop-app")
    setIsOnline(window.navigator.onLine)

    bridge.getContext?.().then((next) => {
      setContext(next || {})
      setIsMaximized(Boolean(next?.isMaximized))
    }).catch(() => undefined)

    bridge.getVersion?.().then((version) => {
      setContext((current) => ({ ...current, version }))
    }).catch(() => undefined)

    const unsubscribe = bridge.onWindowState?.((payload) => {
      setIsMaximized(Boolean(payload?.isMaximized))
    })

    const unsubscribeUpdates = bridge.onUpdateStatus?.((payload) => {
      if (!payload?.status) return

      if (payload.status === "checking") {
        setIsCheckingUpdate(true)
        showUpdateNotice("Guncellemeler kontrol ediliyor.", 0)
        return
      }

      if (payload.status === "not-available") {
        setIsCheckingUpdate(false)
        showUpdateNotice("Uygulama guncel.")
        return
      }

      if (payload.status === "available" || payload.status === "downloading" || payload.status === "download-progress") {
        setIsCheckingUpdate(payload.status !== "download-progress")
        showUpdateNotice("Guncelleme indiriliyor.", 0)
        return
      }

      if (payload.status === "downloaded") {
        setIsCheckingUpdate(false)
        showUpdateNotice(payload.version ? `Guncelleme hazir: v${payload.version}` : "Guncelleme hazir.")
        return
      }

      if (payload.status === "error") {
        setIsCheckingUpdate(false)
        showUpdateNotice(payload.message || "Guncelleme kontrol edilemedi.")
      }
    })

    const updateNetworkState = () => setIsOnline(window.navigator.onLine)
    window.addEventListener("online", updateNetworkState)
    window.addEventListener("offline", updateNetworkState)

    const timer = window.setInterval(() => setClock(formatClock(new Date())), 30_000)

    return () => {
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current)
      unsubscribe?.()
      unsubscribeUpdates?.()
      window.removeEventListener("online", updateNetworkState)
      window.removeEventListener("offline", updateNetworkState)
      window.clearInterval(timer)
      document.documentElement.classList.remove("desktop-app")
    }
  }, [])

  const versionLabel = useMemo(() => {
    const version = context.version || "2.0.3"
    return version.startsWith("v") ? version : `v${version}`
  }, [context.version])

  async function sendWindowAction(action: "minimize" | "toggle-maximize" | "close" | "reload") {
    const bridge = getDesktopBridge()
    if (!bridge?.windowControl) return
    const result = await bridge.windowControl(action).catch(() => null)
    if (typeof result?.maximized === "boolean") setIsMaximized(result.maximized)
  }

  async function checkUpdates() {
    if (isCheckingUpdate) return

    setIsCheckingUpdate(true)
    showUpdateNotice("Guncellemeler kontrol ediliyor.", 0)

    const result = await getDesktopBridge()?.checkForUpdates?.().catch(() => null)

    if (!result || typeof result !== "object" || !("status" in result)) {
      window.setTimeout(() => setIsCheckingUpdate(false), 1200)
      return
    }

    if (result.status === "development") {
      setIsCheckingUpdate(false)
      showUpdateNotice("Guncelleme kontrolu paketli EXE surumunde calisir.")
    }
  }

  return (
    <div className="desktop-shell-root" data-desktop-app={active ? "true" : "false"}>
      {active ? (
        <header className="desktop-titlebar">
          <div className="desktop-titlebar-drag flex min-w-0 flex-1 items-center gap-3">
            <div className="desktop-app-mark">
              <img src="/iconw.png" alt="" className="h-10 w-10 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black leading-none text-slate-100">Hesap Desktop</p>
                <span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-200">
                  {versionLabel}
                </span>
                <span className={isOnline ? "desktop-status-chip desktop-status-online" : "desktop-status-chip desktop-status-offline"}>
                  {isOnline ? "Online" : "Cevrimdisi Mod"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">Wasy Systems masaustu hesap uygulamasi</p>
            </div>
          </div>

          <div className="desktop-no-drag hidden items-center gap-2 text-xs font-semibold text-slate-300 md:flex">
            {updateNotice ? (
              <span className="desktop-update-notice" aria-live="polite">{updateNotice}</span>
            ) : null}
            <span className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">{clock}</span>
            <button
              type="button"
              onClick={checkUpdates}
              className={`desktop-tool-button${isCheckingUpdate ? " is-checking" : ""}`}
              title="Guncellemeyi kontrol et"
              aria-label="Guncellemeyi kontrol et"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="desktop-no-drag ml-2 flex items-center">
            <button
              type="button"
              onClick={() => sendWindowAction("minimize")}
              className="desktop-window-button"
              aria-label="Kucult"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => sendWindowAction("toggle-maximize")}
              className="desktop-window-button"
              aria-label={isMaximized ? "Geri al" : "Buyut"}
            >
              {isMaximized ? <Square className="h-3.5 w-3.5" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => sendWindowAction("close")}
              className="desktop-window-button desktop-window-close"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      ) : null}

      <div className="desktop-shell-content">{children}</div>
    </div>
  )
}
