"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Role } from "@prisma/client"
import { Camera, CheckCircle2, Expand, LogOut, RotateCcw, ShieldCheck, XCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type ScanState = "ready" | "success" | "error" | "processing"

type TerminalScannerProps = {
  operatorName: string
  operatorRole: Role
}

type ScanResponse = {
  action?: "CHECK_IN" | "CHECK_OUT"
  user?: {
    id: number
    name: string
    tcKimlik: string
  }
  shift?: {
    name: string
    label: string
  } | null
  error?: string
}

const scannerId = "terminal-qr-reader"

function playTone(type: "success" | "error") {
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextCtor) return

  const context = new AudioContextCtor()
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = "sine"
  oscillator.frequency.value = type === "success" ? 880 : 220
  gain.gain.setValueAtTime(0.0001, context.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start()
  oscillator.stop(context.currentTime + 0.3)
}

export function TerminalScanner({ operatorName, operatorRole }: TerminalScannerProps) {
  const router = useRouter()
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null)
  const lockedRef = useRef(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [state, setState] = useState<ScanState>("ready")
  const [message, setMessage] = useState("QR kodu kameraya yaklaştırın")
  const [detail, setDetail] = useState("Kamera sürekli aktif; başarılı işlemden sonra otomatik yeni okumaya döner.")
  const [cameraError, setCameraError] = useState("")

  const reset = useCallback(() => {
    lockedRef.current = false
    setState("ready")
    setMessage("QR kodu kameraya yaklaştırın")
    setDetail("Kamera sürekli aktif; başarılı işlemden sonra otomatik yeni okumaya döner.")
  }, [])

  const handleScan = useCallback(async (decodedText: string) => {
    if (lockedRef.current) return
    lockedRef.current = true
    setState("processing")
    setMessage("İşlem kontrol ediliyor")
    setDetail("QR token doğrulanıyor ve açık mesai kaydı aranıyor.")

    const response = await fetch("/api/terminal/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qr: decodedText }),
    })

    const payload = (await response.json().catch(() => ({}))) as ScanResponse

    if (!response.ok) {
      setState("error")
      setMessage(payload.error ?? "QR işlemi başarısız")
      setDetail("Yeni okuma için ekran birazdan sıfırlanır.")
      playTone("error")
    } else {
      const checkText = payload.action === "CHECK_IN" ? "GİRİŞ ALINDI" : "ÇIKIŞ ALINDI"
      setState("success")
      setMessage(checkText)
      setDetail(`${payload.user?.name ?? "Personel"} · ${payload.shift?.label ?? "Vardiya yok"}`)
      playTone("success")
    }

    if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(reset, 2800)
  }, [reset])

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
            aspectRatio: 1.777,
          },
          handleScan,
          () => undefined,
        )
      } catch {
        setCameraError("Kamera başlatılamadı. Tarayıcı iznini ve HTTPS/localhost koşulunu kontrol edin.")
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current)
      const scanner = scannerRef.current
      scannerRef.current = null
      scanner?.stop().then(() => scanner.clear()).catch(() => undefined)
    }
  }, [handleScan])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  async function fullscreen() {
    await document.documentElement.requestFullscreen?.()
  }

  const isSuccess = state === "success"
  const isError = state === "error"

  return (
    <main className="min-h-dvh overflow-hidden bg-zinc-950 text-white">
      <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/30 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-500 text-emerald-950">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Mesai Terminali</h1>
              <p className="text-xs text-zinc-400">Operatör: {operatorName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
              <ShieldCheck className="mr-1 h-3 w-3" />
              {operatorRole}
            </Badge>
            <Button type="button" size="icon" variant="secondary" aria-label="Tam ekran" onClick={fullscreen}>
              <Expand className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="secondary" aria-label="Sıfırla" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="secondary" aria-label="Çıkış" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_420px]">
          <div className="relative min-h-[55dvh] bg-black lg:min-h-0">
            <div id={scannerId} className="h-full min-h-[55dvh] w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(transparent,rgba(0,0,0,0.18))]" />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="h-[min(64vw,54dvh)] w-[min(64vw,54dvh)] max-w-[520px] rounded-md border-4 border-emerald-300/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.22)]" />
            </div>
          </div>

          <aside className="flex min-h-[45dvh] flex-col justify-center border-l border-white/10 bg-zinc-950 px-6 py-8">
            <div
              className={[
                "mb-6 grid h-24 w-24 place-items-center rounded-md border",
                isSuccess ? "border-emerald-300 bg-emerald-400 text-emerald-950" : "",
                isError ? "border-red-300 bg-red-400 text-red-950" : "",
                !isSuccess && !isError ? "border-zinc-700 bg-zinc-900 text-emerald-300" : "",
              ].join(" ")}
            >
              {isError ? <XCircle className="h-12 w-12" /> : <CheckCircle2 className="h-12 w-12" />}
            </div>

            <p className="text-sm font-medium uppercase tracking-[0.25em] text-zinc-500">
              {state === "processing" ? "Kontrol ediliyor" : state === "ready" ? "Hazır" : "Son işlem"}
            </p>
            <h2 className="mt-3 text-5xl font-black leading-none tracking-normal md:text-6xl">{message}</h2>
            <p className="mt-5 text-lg text-zinc-300">{detail}</p>

            {cameraError ? (
              <p className="mt-6 rounded-md border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">{cameraError}</p>
            ) : null}
          </aside>
        </section>

        <footer className="border-t border-white/10 bg-black/30 px-4 py-3 text-center text-sm text-zinc-400">
          QR içinde <span className="font-mono text-zinc-200">userId</span> ve <span className="font-mono text-zinc-200">token</span> doğrulanır; açık kayıt varsa çıkış, yoksa giriş yapılır.
        </footer>
      </div>
    </main>
  )
}
