"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, LogIn, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { queueOfflineMutation } from "@/lib/offline-sync"

type ScanState = "loading" | "success" | "error" | "queued"

type ScanPayload = {
  action?: "CHECK_IN" | "CHECK_OUT"
  user?: { name?: string }
  shift?: { label?: string } | null
  error?: string
}

function getScannerDeviceId() {
  if (typeof window === "undefined") return ""
  const key = "hesap.scanner.deviceId"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  window.localStorage.setItem(key, next)
  return next
}

export function DirectTerminalQrScan() {
  const [state, setState] = useState<ScanState>("loading")
  const [message, setMessage] = useState("QR dogrulaniyor")
  const [detail, setDetail] = useState("Terminal QR mesai sistemine isleniyor.")

  const currentPath = useMemo(() => {
    if (typeof window === "undefined") return "/mesai-qr"
    return `${window.location.pathname}${window.location.search}`
  }, [])

  useEffect(() => {
    let active = true

    async function scan() {
      if (typeof window === "undefined") return

      const scannedAt = new Date().toISOString()
      const body = JSON.stringify({
        qr: window.location.href,
        deviceId: getScannerDeviceId(),
        scanSource: "native-camera-link",
      })

      try {
        const response = await fetch("/api/personel/scan-terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        })
        const payload = (await response.json().catch(() => ({}))) as ScanPayload

        if (!active) return

        if (response.status === 401) {
          window.location.href = `/auth/giris?next=${encodeURIComponent(currentPath)}`
          return
        }

        if (!response.ok) {
          setState("error")
          setMessage(payload.error || "QR islemi basarisiz")
          setDetail("Terminaldeki guncel QR'i tekrar okutun.")
          return
        }

        setState("success")
        setMessage(payload.action === "CHECK_OUT" ? "CIKIS ALINDI" : "GIRIS ALINDI")
        setDetail(`${payload.user?.name || "Personel"} - ${payload.shift?.label || "Vardiya yok"}`)
      } catch {
        if (!active) return

        if (typeof navigator !== "undefined" && !navigator.onLine) {
          queueOfflineMutation("/api/personel/scan-terminal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              qr: window.location.href,
              deviceId: getScannerDeviceId(),
              offlineQueued: true,
              offlineScannedAt: scannedAt,
              scanSource: "native-camera-link",
            }),
          }, {
            label: "Mesai QR link okutma",
          })
          setState("queued")
          setMessage("ISLEM KUYRUGA ALINDI")
          setDetail("Internet geldiginde bu giris/cikis otomatik senkronize edilecek.")
          return
        }

        setState("error")
        setMessage("Baglanti hatasi")
        setDetail("Internet baglantisini kontrol edip tekrar deneyin.")
      }
    }

    scan()
    return () => {
      active = false
    }
  }, [currentPath])

  const success = state === "success" || state === "queued"
  const Icon = state === "loading" ? Loader2 : success ? CheckCircle2 : XCircle

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-8 text-white">
      <Card className="w-full max-w-md border-white/10 bg-white/[0.04] text-white shadow-2xl shadow-black/30">
        <CardContent className="space-y-5 p-6 text-center">
          <div className={[
            "mx-auto grid h-20 w-20 place-items-center rounded-3xl border",
            state === "loading" ? "border-amber-300/50 bg-amber-300/10 text-amber-200" : "",
            success ? "border-emerald-300/50 bg-emerald-300 text-slate-950" : "",
            state === "error" ? "border-red-300/50 bg-red-400 text-slate-950" : "",
          ].join(" ")}>
            <Icon className={state === "loading" ? "h-10 w-10 animate-spin" : "h-10 w-10"} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/45">Mesai QR</p>
            <h1 className="mt-3 text-3xl font-black tracking-normal">{message}</h1>
            <p className="mt-3 text-sm leading-6 text-white/65">{detail}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/mesai-qr">
                <ArrowLeft className="h-4 w-4" />
                Kameraya don
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/dashboard/mesai">
                <LogIn className="h-4 w-4" />
                Mesai sayfasi
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
