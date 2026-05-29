"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, LockKeyhole } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

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

    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError("Bağlantı geçersiz, süresi dolmuş veya şifre güncellenemedi.")
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
                <CardDescription>E-postadaki bağlantıdan geldiysen yeni şifreni kaydedebilirsin.</CardDescription>
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
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="h-11 w-full" disabled={loading || done}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yeni şifreyi kaydet
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
