"use client"

import { useEffect, useMemo, useState } from "react"
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
  checkForUpdates?: () => Promise<unknown>
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
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const bridge = getDesktopBridge()
    if (!bridge) return

    setActive(true)
    document.documentElement.classList.add("desktop-app")

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

    const timer = window.setInterval(() => setClock(formatClock(new Date())), 30_000)

    return () => {
      unsubscribe?.()
      window.clearInterval(timer)
      document.documentElement.classList.remove("desktop-app")
    }
  }, [])

  const versionLabel = useMemo(() => {
    const version = context.version || "2.0.0"
    return version.startsWith("v") ? version : `v${version}`
  }, [context.version])

  async function sendWindowAction(action: "minimize" | "toggle-maximize" | "close" | "reload") {
    const bridge = getDesktopBridge()
    if (!bridge?.windowControl) return
    const result = await bridge.windowControl(action).catch(() => null)
    if (typeof result?.maximized === "boolean") setIsMaximized(result.maximized)
  }

  async function checkUpdates() {
    await getDesktopBridge()?.checkForUpdates?.().catch(() => undefined)
  }

  return (
    <div className="desktop-shell-root" data-desktop-app={active ? "true" : "false"}>
      {active ? (
        <header className="desktop-titlebar">
          <div className="desktop-titlebar-drag flex min-w-0 flex-1 items-center gap-3">
            <div className="desktop-app-mark">
              <img src="/iconw.png" alt="" className="h-7 w-7 object-contain" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-black leading-none text-slate-100">Hesap Desktop</p>
                <span className="rounded-md border border-emerald-400/25 bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-black text-emerald-200">
                  {versionLabel}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-slate-400">Wasy Systems masaustu operasyon uygulamasi</p>
            </div>
          </div>

          <div className="desktop-no-drag hidden items-center gap-2 text-xs font-semibold text-slate-300 md:flex">
            <span className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">Canli</span>
            <span className="rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1">{clock}</span>
            <button
              type="button"
              onClick={checkUpdates}
              className="desktop-tool-button"
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
