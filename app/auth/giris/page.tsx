"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, FileSpreadsheet, Loader2, LockKeyhole, Mail, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center">
        <div className="grid w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl md:grid-cols-[0.95fr_1.05fr]">
          <section className="flex min-h-[360px] flex-col justify-between bg-emerald-700 p-8 text-white md:p-10">
            <div>
              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-emerald-50">Hesap Rapor Sistemi</p>
              <h1 className="mt-3 max-w-sm text-3xl font-bold leading-tight sm:text-4xl">
                Günlük işlemler için güvenli panel
              </h1>
            </div>

            <div className="grid gap-3 text-sm text-emerald-50">
              <div className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Şube bazlı yetki ve görünüm</span>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/15">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>Giriş ve işlem kayıtları</span>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center bg-zinc-50 p-5 sm:p-8 md:p-10">
            <Card className="w-full max-w-md border-zinc-200 shadow-sm">
              <CardHeader className="space-y-2">
                <CardTitle className="text-2xl font-bold">Giriş yap</CardTitle>
                <CardDescription>Hesabınızla panele devam edin.</CardDescription>
              </CardHeader>
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-5">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">E-posta</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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

                  <div className="space-y-2">
                    <Label htmlFor="password">Şifre</Label>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
                <CardFooter>
                  <Button type="submit" className="h-11 w-full bg-emerald-700 hover:bg-emerald-800" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Giriş Yap
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </section>
        </div>
      </div>
    </main>
  )
}
