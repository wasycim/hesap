"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { KeyRound, Loader2, LogOut, MailCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { getOrCreateDeviceIdentity } from "@/lib/device-identity"
import { createClient } from "@/lib/supabase/client"

type Challenge = {
  challengeId: string
  maskedEmail: string
  expiresAt: string
}

export default function DeviceVerificationPage() {
  return <Suspense fallback={<FullPageLoader />}><DeviceVerificationForm /></Suspense>
}

function DeviceVerificationForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const next = safeNext(params.get("next"))

  useEffect(() => {
    void start(false)
  }, [])

  async function start(resend: boolean) {
    setBusy(resend)
    setError(null)
    const identity = await getOrCreateDeviceIdentity()
    const response = await fetch("/api/auth/device-verification/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...identity, resend }),
    })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    setBusy(false)
    if (!response.ok) {
      setError(data.error || "Cihaz doğrulaması başlatılamadı.")
      return
    }
    if (!data.challengeRequired) {
      router.replace(next)
      router.refresh()
      return
    }
    setChallenge({ challengeId: data.challengeId, maskedEmail: data.maskedEmail, expiresAt: data.expiresAt })
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!challenge) return
    setBusy(true)
    setError(null)
    const identity = await getOrCreateDeviceIdentity()
    const response = await fetch("/api/auth/device-verification/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId: challenge.challengeId, deviceId: identity.deviceId, code }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      setError(data.error || "Kod doğrulanamadı.")
      return
    }
    router.replace(next)
    router.refresh()
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    await createClient().auth.signOut().catch(() => undefined)
    window.location.href = "/auth/giris"
  }

  if (loading) return <FullPageLoader />

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 py-8 text-slate-950">
      <Card className="w-full max-w-md overflow-hidden rounded-[28px] border-0 shadow-2xl">
        <CardHeader className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-7 text-white">
          <div className="mb-4 grid h-13 w-13 place-items-center rounded-2xl bg-white/15"><MailCheck className="h-7 w-7" /></div>
          <CardTitle className="text-2xl">Yeni cihaz doğrulaması</CardTitle>
          <CardDescription className="text-emerald-50">
            {challenge ? `${challenge.maskedEmail} adresine gönderilen 6 haneli kodu girin.` : "Cihaz güvenliği hazırlanıyor."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 p-7">
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div> : null}
          <form onSubmit={verify} className="space-y-4">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="h-14 pl-12 text-center text-2xl font-black tracking-[0.3em]"
                autoFocus
              />
            </div>
            <Button className="h-12 w-full" disabled={busy || code.length !== 6 || !challenge}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Cihazı doğrula
            </Button>
          </form>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => start(true)} disabled={busy} className="gap-2"><RefreshCw className="h-4 w-4" /> Yeni kod</Button>
            <Button variant="ghost" onClick={logout} className="gap-2 text-slate-600"><LogOut className="h-4 w-4" /> Çıkış</Button>
          </div>
          {challenge ? <p className="text-center text-xs text-slate-500">Kod {new Date(challenge.expiresAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} saatine kadar geçerlidir.</p> : null}
        </CardContent>
      </Card>
    </main>
  )
}

function safeNext(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.startsWith("/auth/")) return "/dashboard"
  return value
}

function FullPageLoader() {
  return <main className="grid min-h-dvh place-items-center bg-slate-950"><Loader2 className="h-8 w-8 animate-spin text-emerald-400" /></main>
}

