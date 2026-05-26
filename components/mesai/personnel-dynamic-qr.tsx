"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Moon, RefreshCw, ShieldCheck, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type QrResponse = {
  qr: string
  expiresAt: string
  ttlSeconds: number
  user: {
    name: string
    tcKimlik: string
    role: string
    shift: { name: string; label: string } | null
  }
  error?: string
}

export function PersonnelDynamicQr() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [qrImage, setQrImage] = useState("")
  const [payload, setPayload] = useState<QrResponse | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const clearTimers = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
  }, [])

  const loadQr = useCallback(async () => {
    setLoading(true)
    setError("")

    const response = await fetch("/api/personel/qr", { cache: "no-store" })
    const data = (await response.json().catch(() => ({}))) as QrResponse

    if (!response.ok) {
      setError(data.error ?? "QR oluşturulamadı.")
      setLoading(false)
      return
    }

    const QRCode = await import("qrcode")
    const image = await QRCode.toDataURL(data.qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 420,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })

    clearTimers()
    setPayload(data)
    setQrImage(image)
    setLoading(false)

    const expiresAt = new Date(data.expiresAt).getTime()
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    }
    tick()
    countdownTimer.current = setInterval(tick, 250)
    refreshTimer.current = setTimeout(loadQr, Math.max(4000, data.ttlSeconds * 1000 - 5000))
  }, [clearTimers])

  useEffect(() => {
    loadQr()
    return clearTimers
  }, [clearTimers, loadQr])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.14),transparent_32%),linear-gradient(135deg,var(--background),var(--muted))] p-4">
      <div className="absolute right-4 top-4 flex gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Tema değiştir" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Çıkış" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <Card className="w-full max-w-lg border-border/70 shadow-2xl">
        <CardHeader className="gap-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-emerald-500 text-emerald-950">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-2xl">Dinamik Mesai QR</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">Bu QR güvenlik için kısa aralıklarla otomatik yenilenir.</p>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid place-items-center rounded-md border bg-white p-4">
            {qrImage ? (
              <img src={qrImage} alt="Dinamik mesai QR kodu" className="h-[min(72vw,360px)] w-[min(72vw,360px)]" />
            ) : (
              <div className="grid h-[min(72vw,360px)] w-[min(72vw,360px)] place-items-center text-sm text-zinc-500">
                QR hazırlanıyor
              </div>
            )}
          </div>

          {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-lg font-semibold">{payload?.user.name ?? "Personel"}</p>
              <p className="text-sm text-muted-foreground">{payload?.user.shift?.label ?? "Vardiya bilgisi yok"}</p>
            </div>
            <Badge className="justify-center bg-emerald-500 text-emerald-950 hover:bg-emerald-500">
              {loading ? "Yenileniyor" : `${remaining} sn`}
            </Badge>
          </div>

          <Button type="button" variant="outline" className="gap-2" onClick={loadQr} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Şimdi yenile
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
