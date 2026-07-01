"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { IdCard, Loader2, LockKeyhole, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"
import { logSecurityEvent } from "@/lib/audit-log"
import { PublicAuthFooter } from "@/components/auth/public-auth-footer"
import { getOrCreateDeviceIdentity, isPhoneMobileDeviceContext } from "@/lib/device-identity"

const savedAuthLoginKey = "hesap.auth.savedLogin"

export default function GirisPage() {
  const [email, setEmail] = useState("")
  const [tcKimlik, setTcKimlik] = useState("")
  const [password, setPassword] = useState("")
  const [loginMode, setLoginMode] = useState<"email" | "tc">("tc")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    window.localStorage.removeItem(savedAuthLoginKey)
  }, [])

  function getSafeNextPath() {
    if (typeof window === "undefined") return ""
    const next = new URLSearchParams(window.location.search).get("next") || ""
    if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth/")) return ""
    return next
  }

  function clearSavedLogin() {
    window.localStorage.removeItem(savedAuthLoginKey)
  }

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    let loginEmail = email.trim().toLowerCase()
    const cleanTc = tcKimlik.replace(/\D/g, "")

    if (loginMode === "tc") {
      const response = await fetch("/api/auth/tc-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tcKimlik: cleanTc }),
      })
      const result = await response.json()

      if (!response.ok) {
        await logSecurityEvent("failed_login", {
          tc_kimlik: cleanTc,
          reason: result.error || "TC ile giriş başarısız.",
        })
        setError(result.error || "TC ile giriş başarısız.")
        setLoading(false)
        return
      }

      loginEmail = String(result.email || "").trim().toLowerCase()
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    })

    if (signInError) {
      await logSecurityEvent("failed_login", {
        email: loginEmail,
        tc_kimlik: loginMode === "tc" ? cleanTc : undefined,
        reason: signInError.message === "Invalid login credentials" ? "E-posta/TC veya şifre hatalı." : signInError.message,
      })
      setError(signInError.message === "Invalid login credentials"
        ? "E-posta/TC veya şifre hatalı"
        : signInError.message)
      setLoading(false)
      return
    }

    const { data: { user: signedUser } } = await supabase.auth.getUser()
    const { data: profile } = signedUser
      ? await supabase
        .from("user_profiles")
        .select("dashboard_access, tc_kimlik")
        .eq("user_id", signedUser.id)
        .maybeSingle()
      : { data: null }

    const mesaiTc = loginMode === "tc" ? cleanTc : String(profile?.tc_kimlik || "").replace(/\D/g, "")
    let mesaiLoginOk = false

    if (mesaiTc.length === 11) {
      const mesaiResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tcKimlik: mesaiTc, password }),
      })
      mesaiLoginOk = mesaiResponse.ok
    }

    if (profile?.dashboard_access === false) {
      await supabase.auth.signOut()

      if (mesaiLoginOk) {
        clearSavedLogin()
        router.push(getSafeNextPath() || "/mesai-qr")
        router.refresh()
        return
      }

      setError("Bu kullanici sadece mesai giris cikis icin yetkili.")
      setLoading(false)
      return
    }

    const phoneMobileLogin = isPhoneMobileDeviceContext()
    const nextPath = getSafeNextPath() || (phoneMobileLogin ? "/mobile" : "/dashboard")
    if (phoneMobileLogin || nextPath.startsWith("/mobile")) {
    const identity = await getOrCreateDeviceIdentity()
    const deviceResponse = await fetch("/api/auth/device-verification/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identity),
    })
    const deviceResult = await deviceResponse.json().catch(() => ({}))
    if (!deviceResponse.ok) {
      setError(deviceResult.error || "Cihaz güvenliği doğrulanamadı.")
      setLoading(false)
      return
    }

    if (deviceResult.challengeRequired) {
      clearSavedLogin()
      router.push(`/auth/cihaz-dogrulama?next=${encodeURIComponent(nextPath)}`)
      router.refresh()
      return
    }
    }

    await logSecurityEvent("login", {
      email: loginEmail,
      login_method: loginMode,
      tc_kimlik: loginMode === "tc" ? cleanTc : undefined,
    })
    clearSavedLogin()
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("current_sube_id")
      window.localStorage.removeItem("hesap_sube_context_cache")
    }
    router.push(nextPath)
    router.refresh()
  }

  return (
    <main className="grid h-dvh grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl items-center justify-center">
        <Card className="relative grid max-h-full min-w-0 w-full overflow-hidden rounded-xl border bg-card shadow-2xl sm:rounded-2xl md:grid-cols-[0.98fr_1.02fr] md:rounded-[2rem]">
          <div className="absolute right-5 top-5 z-10">
            <ThemeToggle />
          </div>
          <CardHeader className="relative flex min-h-[180px] min-w-0 flex-col justify-between overflow-hidden border-b p-6 sm:min-h-[220px] sm:p-8 md:min-h-[390px] md:border-b-0 md:p-10">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-28 bg-gradient-to-r from-transparent via-card/60 to-card md:block" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_22%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--muted)/0.75),transparent_65%)]" />
            <div className="relative flex items-start">
              <img
                src="/iconw.png"
                alt="W logo"
                className="h-20 w-36 object-contain object-left drop-shadow-2xl transition-all duration-700 sm:h-28 sm:w-48 md:h-44 md:w-72"
              />
            </div>
            <div className="relative space-y-3">
              <CardTitle className="text-2xl font-bold md:text-3xl">Hesap Rapor Sistemi</CardTitle>
              <CardDescription className="text-base">Hesabınıza giriş yapın.</CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleLogin} className="min-w-0">
            <CardContent className="min-w-0 space-y-4 p-6 pt-16 sm:p-8 sm:pt-16 md:space-y-6 md:p-10 md:pt-20">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
                <Button type="button" variant={loginMode === "tc" ? "default" : "ghost"} onClick={() => setLoginMode("tc")} className="min-w-0 px-2 text-xs sm:text-sm">
                  TC ile giriş
                </Button>
                <Button type="button" variant={loginMode === "email" ? "default" : "ghost"} onClick={() => setLoginMode("email")} className="min-w-0 px-2 text-xs sm:text-sm">
                  E-posta ile giriş
                </Button>
              </div>

              {loginMode === "email" ? (
                <div className="space-y-3">
                  <Label htmlFor="email">E-posta</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ornek@email.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 pl-10"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Label htmlFor="tc">TC Kimlik No</Label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="tc"
                      name="username"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="11 haneli TC"
                      value={tcKimlik}
                      onChange={(event) => setTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                      className="h-11 pl-10"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="********"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 pl-10"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Link href="/auth/sifremi-unuttum" className="text-sm font-medium text-primary hover:underline">
                    Şifremi unuttum
                  </Link>
                </div>
              </div>

            </CardContent>
            <CardFooter className="px-6 pb-6 sm:px-8 sm:pb-8 md:px-10 md:pb-10">
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Giriş Yap
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
      <PublicAuthFooter className="mx-auto w-full max-w-5xl pt-3" />
    </main>
  )
}
