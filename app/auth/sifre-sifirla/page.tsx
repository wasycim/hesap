"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"
import { PublicAuthFooter } from "@/components/auth/public-auth-footer"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [canReset, setCanReset] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let cancelled = false

    async function prepareRecoverySession() {
      try {
        if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
          window.location.replace(`https://pamukkaleturizm.info${window.location.pathname}${window.location.search}${window.location.hash}`)
          return
        }

        const url = new URL(window.location.href)
        const code = url.searchParams.get("code")
        const tokenHash = url.searchParams.get("token_hash")
        const type = url.searchParams.get("type")
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""))
        const accessToken = hashParams.get("access_token")
        const refreshToken = hashParams.get("refresh_token")
        const hashType = hashParams.get("type")

        if (code || (tokenHash && type === "recovery")) {
          const callbackUrl = new URL("/auth/callback", window.location.origin)
          callbackUrl.searchParams.set("next", "/auth/sifre-sifirla")
          if (code) callbackUrl.searchParams.set("code", code)
          if (tokenHash) {
            callbackUrl.searchParams.set("token_hash", tokenHash)
            callbackUrl.searchParams.set("type", "recovery")
          }
          window.location.replace(callbackUrl.toString())
          return
        }

        if (accessToken || refreshToken || hashType === "recovery") {
          window.history.replaceState(null, "", "/auth/sifre-sifirla")
          setError("Bu bağlantı eski şifre sıfırlama formatında geldi. Güvenliğin için yeni bağlantı iste.")
          setCanReset(false)
          return
        }

        const recoveryResponse = await fetch("/api/auth/reset-password", { cache: "no-store" })
        const recoveryResult = await recoveryResponse.json().catch(() => ({ ok: false }))

        if (!cancelled && !recoveryResult.ok) {
          setError("Bu sayfa yalnızca e-postadaki şifre sıfırlama bağlantısı ile kullanılabilir. Yeni bağlantı iste.")
          setCanReset(false)
          return
        }

        if (!cancelled) {
          setCanReset(true)
        }
      } catch {
        if (!cancelled) {
          setError("Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı iste.")
          setCanReset(false)
        }
      } finally {
        if (!cancelled) setCheckingLink(false)
      }
    }

    prepareRecoverySession()

    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (!canReset) {
      setError("Bu sayfa yalnızca e-postadaki şifre sıfırlama bağlantısı ile kullanılabilir.")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Yeni şifre en az 6 karakter olmalı.")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Şifreler eşleşmiyor.")
      setLoading(false)
      return
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error || "Bağlantı geçersiz, süresi dolmuş veya şifre güncellenemedi.")
      setLoading(false)
      return
    }

    setDone(true)
    setLoading(false)
    await supabase.auth.signOut()
    setTimeout(() => router.push("/auth/giris"), 1200)
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <Card className="w-full rounded-2xl border bg-card shadow-2xl">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-3">
              <Link href="/auth/giris" className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Girişe dön
              </Link>
              <div>
                <CardTitle className="text-2xl">Yeni şifre belirle</CardTitle>
                <CardDescription>Bu ekran yalnızca e-postadaki güvenli şifre sıfırlama bağlantısı ile açılır.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {done && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>Şifren güncellendi. Giriş sayfasına yönlendiriliyorsun.</AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                <Label htmlFor="password">Yeni şifre</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 pl-10"
                    autoComplete="new-password"
                    disabled={!canReset || loading || done}
                    required
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="confirm-password">Yeni şifre tekrar</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 pl-10"
                    autoComplete="new-password"
                    disabled={!canReset || loading || done}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="h-11 w-full" disabled={!canReset || checkingLink || loading || done}>
                {(checkingLink || loading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {checkingLink ? "Bağlantı kontrol ediliyor" : "Yeni şifreyi kaydet"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      <PublicAuthFooter className="mx-auto -mt-2 max-w-lg pb-1" />
    </main>
  )
}
