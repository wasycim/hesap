"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, LockKeyhole, Mail } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"
import { logSecurityEvent } from "@/lib/audit-log"

export default function GirisPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      await logSecurityEvent("failed_login", {
        email: email.trim().toLowerCase(),
        reason: error.message === "Invalid login credentials" ? "E-posta veya şifre hatalı." : error.message,
      })
      setError(error.message === "Invalid login credentials"
        ? "E-posta veya şifre hatalı"
        : error.message)
      setLoading(false)
      return
    }

    await logSecurityEvent("login", { email: email.trim().toLowerCase() })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <Card className="relative grid w-full overflow-hidden rounded-[2rem] border bg-card shadow-2xl md:grid-cols-[0.98fr_1.02fr]">
          <div className="absolute right-5 top-5 z-10">
            <ThemeToggle />
          </div>
          <CardHeader className="relative flex min-h-[390px] flex-col justify-between overflow-hidden border-b p-8 md:border-b-0 md:p-10">
            <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-28 bg-gradient-to-r from-transparent via-card/60 to-card md:block" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_32%_22%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,hsl(var(--muted)/0.75),transparent_65%)]" />
            <div className="relative flex items-start">
              <img
                src="/iconw.png"
                alt="W logo"
                className="h-36 w-56 object-contain object-left drop-shadow-2xl transition-all duration-700 dark:hidden sm:h-44 sm:w-72"
              />
              <img
                src="/iconw2.png"
                alt="W logo"
                className="hidden h-36 w-56 object-contain object-left drop-shadow-2xl transition-all duration-700 dark:block sm:h-44 sm:w-72"
              />
            </div>
            <div className="relative space-y-3">
              <CardTitle className="text-3xl font-bold">Hesap Rapor Sistemi</CardTitle>
              <CardDescription className="text-base">Hesabınıza giriş yapın.</CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6 p-8 pt-20 md:p-10 md:pt-20">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <Label htmlFor="email">E-posta</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="ornek@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="px-8 pb-8 md:px-10 md:pb-10">
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Giriş Yap
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
