"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize2, Monitor, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type TerminalQrResponse = {
  qr: string
  expiresAt: string
  ttlSeconds: number
  error?: string
}

export function TerminalDynamicQr() {
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [qrImage, setQrImage] = useState("")
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const clearTimers = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
  }, [])

  const loadQr = useCallback(async () => {
    setLoading(true)
    setError("")

    const response = await fetch("/api/terminal/qr", { cache: "no-store" })
    const data = (await response.json().catch(() => ({}))) as TerminalQrResponse

    if (!response.ok) {
      setError(data.error ?? "Terminal QR olusturulamadi.")
      setLoading(false)
      return
    }

    const QRCode = await import("qrcode")
    const image = await QRCode.toDataURL(data.qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 620,
      color: {
        dark: "#020617",
        light: "#ffffff",
      },
    })

    clearTimers()
    setQrImage(image)
    setLoading(false)

    const expiresAt = new Date(data.expiresAt).getTime()
    const tick = () => setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    tick()
    countdownTimer.current = setInterval(tick, 250)
    refreshTimer.current = setTimeout(loadQr, Math.max(4000, data.ttlSeconds * 1000))
  }, [clearTimers])

  useEffect(() => {
    loadQr()
    return clearTimers
  }, [clearTimers, loadQr])

  async function fullscreen() {
    await document.documentElement.requestFullscreen?.()
  }

  return (
    <main className="grid min-h-dvh bg-slate-950 text-white">
      <div className="grid min-h-dvh grid-rows-[auto_1fr_auto]">
        <header className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-400 text-slate-950">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Mesai Terminal QR</h1>
              <p className="text-sm text-white/55">Personel kendi cihaz kamerasiyla bu QR'i okutur.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-400 text-slate-950 hover:bg-emerald-400">
              {loading ? "Hazirlaniyor" : `${remaining} sn`}
            </Badge>
            <Button type="button" variant="secondary" size="icon" aria-label="Yenile" onClick={loadQr}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button type="button" variant="secondary" size="icon" aria-label="Tam ekran" onClick={fullscreen}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <section className="grid place-items-center p-6">
          <div className="grid w-full max-w-2xl gap-5 text-center">
            <div className="mx-auto rounded-2xl border border-white/10 bg-white p-5 shadow-2xl shadow-emerald-500/10">
              {qrImage ? (
                <img src={qrImage} alt="Terminal mesai QR" className="h-[min(72dvh,620px)] w-[min(72dvh,620px)]" />
              ) : (
                <div className="grid h-[min(72dvh,620px)] w-[min(72dvh,620px)] place-items-center text-slate-500">
                  QR hazirlaniyor
                </div>
              )}
            </div>
            {error ? <p className="rounded-lg border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-100">{error}</p> : null}
            <div>
              <p className="text-3xl font-black">QR 30 saniyede bir yenilenir</p>
              <p className="mt-2 text-white/55">Personel TC ve sifre ile giris yapar, kamerasi ile bu kodu okutup giris/cikis yapar.</p>
            </div>
          </div>
        </section>

        <footer className="border-t border-white/10 px-5 py-3 text-center text-sm text-white/45">
          Sabit terminal ekrani. Kamera bu cihazda acilmaz.
        </footer>
      </div>
    </main>
  )
}
