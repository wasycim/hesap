"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, CheckCircle2, LogOut, RotateCcw, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { queueOfflineMutation } from "@/lib/offline-sync"

type ScanState = "ready" | "processing" | "success" | "error"

type ScanResponse = {
  action?: "CHECK_IN" | "CHECK_OUT"
  user?: { id: number; name: string; tcKimlik: string }
  shift?: { name: string; label: string } | null
  error?: string
}

type PersonnelTerminalScannerProps = {
  userName: string
  dashboardMode?: boolean
}

const scannerId = "personnel-terminal-qr-reader"

function getScannerDeviceId() {
  if (typeof window === "undefined") return ""
  const key = "hesap.scanner.deviceId"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  window.localStorage.setItem(key, next)
  return next
}

function playTone(type: "success" | "error") {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "sine"
  oscillator.frequency.value = type === "success" ? 880 : 220
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.2, context.currentTime + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.3)
}

export function PersonnelTerminalScanner({ userName, dashboardMode = false }: PersonnelTerminalScannerProps) {
  const router = useRouter()
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const lockedRef = useRef(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<ScanState>("ready")
  const [message, setMessage] = useState("Terminal QR'ini okutun")
  const [detail, setDetail] = useState("Kamerayi sabit /terminal ekranindaki QR koda tutun.")
  const [cameraError, setCameraError] = useState("")
  const [cameraActive, setCameraActive] = useState(false)

  const stopScanner = useCallback(async (updateState = true) => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (updateState) setCameraActive(false)

    if (!scanner) return

    try {
      await scanner.stop()
    } catch {
      // Kamera zaten durduysa devam et.
    }

    try {
      await scanner.clear()
    } catch {
      // Temizleme desteklenmiyorsa islem basarili sayilir.
    }
  }, [])

  const reset = useCallback(() => {
    lockedRef.current = false
    setState("ready")
    setMessage("Terminal QR'ini okutun")
    setDetail("Kamerayi sabit /terminal ekranindaki QR koda tutun.")
  }, [])

  const handleScan = useCallback(async (decodedText: string) => {
    if (lockedRef.current) return
    lockedRef.current = true
    setState("processing")
    setMessage("Mesai kontrol ediliyor")
    setDetail("Terminal QR dogrulaniyor.")

    const scannedAt = new Date().toISOString()
    const deviceId = getScannerDeviceId()
    const requestBody = JSON.stringify({ qr: decodedText, deviceId })
    let response: Response

    try {
      response = await fetch("/api/personel/scan-terminal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      })
    } catch (error) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        queueOfflineMutation("/api/personel/scan-terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr: decodedText, deviceId, offlineQueued: true, offlineScannedAt: scannedAt }),
        }, {
          label: "Mesai QR okutma",
        })
        setState("success")
        setMessage("ISLEM KAYDEDILDI")
        setDetail("Internet geldiginde giris/cikis otomatik senkronize edilecek. Kamera kapatildi.")
        playTone("success")
        await stopScanner()
        return
      }
      setState("error")
      setMessage("Baglanti hatasi")
      setDetail("Internet baglantisini kontrol edip tekrar deneyin.")
      playTone("error")
      resetTimerRef.current = setTimeout(reset, 2800)
      return
    }

    const payload = (await response.json().catch(() => ({}))) as ScanResponse

    if (!response.ok) {
      setState("error")
      setMessage(payload.error ?? "QR islemi basarisiz")
      setDetail("Terminaldeki guncel QR'i tekrar okutun.")
      playTone("error")
    } else {
      const checkText = payload.action === "CHECK_IN" ? "GIRIS ALINDI" : "CIKIS ALINDI"
      setState("success")
      setMessage(checkText)
      setDetail(`${payload.user?.name ?? userName} - ${payload.shift?.label ?? "Vardiya yok"} - Kamera kapatildi.`)
      playTone("success")
      await stopScanner()
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    if (!response.ok) {
      resetTimerRef.current = setTimeout(reset, 2800)
    }
  }, [reset, stopScanner, userName])

  useEffect(() => {
    let mounted = true

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode")
        if (!mounted || scannerRef.current) return

        const scanner = new Html5Qrcode(scannerId, { verbose: false })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72)
              return { width: edge, height: edge }
            },
            aspectRatio: 1,
          },
          handleScan,
          () => undefined,
        )
        if (mounted) setCameraActive(true)
      } catch {
        if (mounted) setCameraError("Kamera baslatilamadi. Tarayici kamera iznini kontrol edin.")
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      stopScanner(false)
    }
  }, [handleScan, stopScanner])

  function handleManualReset() {
    if (!cameraActive && typeof window !== "undefined") {
      window.location.reload()
      return
    }

    reset()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/auth/giris")
    router.refresh()
  }

  const isSuccess = state === "success"
  const isError = state === "error"

  return (
    <main className="min-h-dvh bg-slate-950 text-white">
      <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
        <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-400 text-slate-950">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Mesai QR Okutma</h1>
              <p className="text-xs text-white/55">{userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dashboardMode ? (
              <Button type="button" variant="secondary" size="icon" aria-label="Dashboarda don" onClick={() => router.push("/dashboard")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <Button type="button" variant="secondary" size="icon" aria-label="Sifirla" onClick={handleManualReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" size="icon" aria-label="Cikis" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid gap-0 lg:grid-cols-[1fr_380px]">
          <div className="relative min-h-[58dvh] bg-black">
            <div id={scannerId} className="h-full min-h-[58dvh] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[min(68vw,48dvh)] w-[min(68vw,48dvh)] rounded-2xl border-4 border-emerald-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            </div>
          </div>

          <aside className="flex flex-col justify-center border-l border-white/10 p-6">
            <div
              className={[
                "mb-5 grid h-20 w-20 place-items-center rounded-2xl border",
                isSuccess ? "border-emerald-300 bg-emerald-400 text-slate-950" : "",
                isError ? "border-red-300 bg-red-400 text-slate-950" : "",
                !isSuccess && !isError ? "border-white/10 bg-white/5 text-emerald-300" : "",
              ].join(" ")}
            >
              {isError ? <XCircle className="h-10 w-10" /> : <CheckCircle2 className="h-10 w-10" />}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
              {state === "processing" ? "Kontrol ediliyor" : state === "ready" ? "Hazir" : "Son islem"}
            </p>
            <h2 className="mt-3 text-4xl font-black leading-none">{message}</h2>
            <p className="mt-4 text-base text-white/65">{detail}</p>
            {cameraError ? (
              <p className="mt-5 rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{cameraError}</p>
            ) : null}
            {!cameraActive && state === "success" ? (
              <p className="mt-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                Islem tamamlandi. Guvenlik icin kamera otomatik kapatildi.
              </p>
            ) : null}
          </aside>
        </section>

        <footer className="border-t border-white/10 px-4 py-3 text-center text-xs text-white/45">
          Terminal QR 30 saniyede bir yenilenir. Guncel QR'i okutun.
        </footer>
      </div>
    </main>
  )
}
