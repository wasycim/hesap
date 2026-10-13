"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, DownloadCloud, Loader2, X } from "lucide-react"

type UpdateStatus =
  | "checking"
  | "available"
  | "downloading"
  | "download-progress"
  | "downloaded"
  | "installing"
  | "not-available"
  | "error"

type UpdatePayload = {
  status: UpdateStatus
  version?: string | null
  percent?: number
  message?: string
}

type DesktopBridge = {
  getVersion?: () => Promise<string>
  installDownloadedUpdate?: () => Promise<{ ok: boolean; error?: string; installing?: boolean }>
  getUpdateState?: () => Promise<{ downloaded: boolean; version: string | null; installing: boolean }>
  onUpdateStatus?: (callback: (payload: UpdatePayload) => void) => () => void
}

function getDesktopBridge() {
  if (typeof window === "undefined") return null
  return (window as typeof window & { hesapDesktop?: DesktopBridge }).hesapDesktop ?? null
}

function normalizePercent(value: unknown) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

export function DesktopUpdateManager() {
  const [payload, setPayload] = useState<UpdatePayload | null>(null)
  const [progress, setProgress] = useState(0)
  const [isInstalling, setIsInstalling] = useState(false)
  const [legacyUpgrade, setLegacyUpgrade] = useState<{ version: string; url: string } | null>(null)
  const [legacyDismissed, setLegacyDismissed] = useState(false)

  useEffect(() => {
    const bridge = getDesktopBridge()
    if (!bridge) return

    // Detect if client is running legacy 9.9.4 version
    bridge.getVersion?.().then((currentVersion) => {
      if (currentVersion && (currentVersion === "9.9.4" || (currentVersion.startsWith("9.9.") && currentVersion < "9.9.5"))) {
        setLegacyUpgrade({
          version: "9.9.5",
          url: "/updates/Hesap-Setup-9.9.5.exe",
        })
      }
    }).catch(() => undefined)

    if (!bridge.onUpdateStatus) return

    let hideTimer: number | null = null

    function clearHideTimer() {
      if (!hideTimer) return
      window.clearTimeout(hideTimer)
      hideTimer = null
    }

    const unsubscribe = bridge.onUpdateStatus((next) => {
      if (!next?.status) return
      clearHideTimer()

      // Suppress technical GitHub 404 / private repository errors completely
      if (next.status === "error") {
        const errorMsg = String(next.message || "").toLowerCase()
        if (
          errorMsg.includes("404") ||
          errorMsg.includes("releases.atom") ||
          errorMsg.includes("authentication token") ||
          errorMsg.includes("github.com")
        ) {
          console.warn("Private GitHub repository updater feed notice suppressed:", next.message)
          return
        }
      }

      if (next.status === "download-progress") {
        setProgress(normalizePercent(next.percent))
      }

      if (next.status === "downloaded") {
        setProgress(100)
      }

      if (next.status === "installing") {
        setIsInstalling(true)
      }

      setPayload((current) => ({
        ...current,
        ...next,
        version: next.version ?? current?.version ?? null,
      }))

      if (next.status === "not-available") {
        hideTimer = window.setTimeout(() => setPayload(null), 3000)
      }
    })

    bridge.getUpdateState?.().then((state) => {
      if (state?.installing) {
        setIsInstalling(true)
        setPayload({ status: "installing", version: state.version })
        return
      }

      if (state?.downloaded) {
        setProgress(100)
        setPayload({ status: "downloaded", version: state.version })
      }
    }).catch(() => undefined)

    return () => {
      clearHideTimer()
      unsubscribe?.()
    }
  }, [])

  const content = useMemo(() => {
    if (!payload) return null

    if (payload.status === "available" || payload.status === "downloading") {
      return {
        icon: <DownloadCloud className="size-5 text-amber-300" />,
        title: "Yeni güncelleme indiriliyor",
        body: payload.version ? `Hesap ${payload.version} hazırlanıyor.` : "Yeni sürüm hazırlanıyor.",
        tone: "border-amber-400/30 bg-amber-950/90 text-amber-50",
      }
    }

    if (payload.status === "download-progress") {
      return {
        icon: <Loader2 className="size-5 animate-spin text-sky-300" />,
        title: "Güncelleme indiriliyor",
        body: `%${progress} tamamlandı.`,
        tone: "border-sky-400/30 bg-slate-950/95 text-slate-50",
      }
    }

    if (payload.status === "downloaded") {
      return {
        icon: <CheckCircle2 className="size-5 text-emerald-300" />,
        title: "Güncelleme hazır",
        body: payload.version ? `Hesap ${payload.version} indirildi. Kurulumu hemen başlatabilirsiniz.` : "Yeni sürüm indirildi.",
        tone: "border-emerald-400/30 bg-emerald-950/95 text-emerald-50",
      }
    }

    if (payload.status === "installing") {
      return {
        icon: <Loader2 className="size-5 animate-spin text-emerald-300" />,
        title: "Güncelleme kuruluyor",
        body: "Uygulama kapatılıp yeni sürümle yeniden açılacak.",
        tone: "border-emerald-400/30 bg-slate-950/95 text-slate-50",
      }
    }

    if (payload.status === "error") {
      return {
        icon: <AlertTriangle className="size-5 text-red-300" />,
        title: "Güncelleme kontrolü",
        body: "Güncelleme sunucusuna şu an ulaşılamıyor, birazdan tekrar denenecek.",
        tone: "border-red-400/30 bg-red-950/95 text-red-50",
      }
    }

    if (payload.status === "not-available") {
      return {
        icon: <CheckCircle2 className="size-5 text-emerald-300" />,
        title: "Uygulama güncel",
        body: "Kullanılan sürüm en son sürümdür.",
        tone: "border-emerald-400/30 bg-slate-950/95 text-slate-50",
      }
    }

    return null
  }, [payload, progress])

  async function installUpdate() {
    const bridge = getDesktopBridge()
    if (!bridge?.installDownloadedUpdate) return

    setIsInstalling(true)
    setPayload((current) => current ? { ...current, status: "installing" } : { status: "installing" })

    const result = await bridge.installDownloadedUpdate().catch((error) => ({
      ok: false,
      error: error instanceof Error ? error.message : "Kurulum başlatılamadı.",
    }))

    if (!result?.ok) {
      setIsInstalling(false)
      setPayload({
        status: "error",
        message: result?.error || "Kurulum başlatılamadı.",
      })
    }
  }

  // Active updater card
  if (payload && content) {
    const showProgress = payload.status === "download-progress" || payload.status === "downloaded"
    const showInstallButton = payload.status === "downloaded"

    return (
      <div className="fixed bottom-5 right-5 z-[80] w-[min(92vw,420px)] animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className={`rounded-2xl border p-4 shadow-2xl shadow-black/30 backdrop-blur ${content.tone}`}>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">{content.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">{content.title}</div>
              <div className="mt-1 text-sm leading-6 opacity-85">{content.body}</div>
            </div>
            {payload.status !== "installing" ? (
              <button
                type="button"
                onClick={() => setPayload(null)}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-current opacity-75 transition hover:bg-white/10 hover:opacity-100"
                aria-label="Güncelleme panelini kapat"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {showProgress ? (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-current transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {showInstallButton ? (
            <button
              type="button"
              onClick={installUpdate}
              disabled={isInstalling}
              className="mt-4 h-11 w-full rounded-xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-70 shadow-lg shadow-white/10"
            >
              {isInstalling ? "Kurulum başlatılıyor..." : "Şimdi kur ve yeniden başlat"}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  // Legacy (9.9.4) upgrade prompt card (when GitHub autoUpdater was pointing to old repo)
  if (legacyUpgrade && !legacyDismissed) {
    return (
      <div className="fixed bottom-5 right-5 z-[80] w-[min(92vw,420px)] animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="rounded-2xl border border-sky-400/30 bg-slate-950/95 p-4 text-slate-50 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 text-sky-400">
              <DownloadCloud className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black">Yeni Sürüm Hazır (v{legacyUpgrade.version})</div>
              <div className="mt-1 text-sm leading-5 text-slate-300">
                Yeni sunucu altyapısı ve otomatik güncelleme desteği hazırlandı.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLegacyDismissed(true)}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
              aria-label="Kapat"
            >
              <X className="size-4" />
            </button>
          </div>

          <a
            href={legacyUpgrade.url}
            download
            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-400 shadow-lg shadow-sky-500/20"
          >
            Hesap v{legacyUpgrade.version} İndir ve Kur
          </a>
        </div>
      </div>
    )
  }

  return null
}
