"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, IdCard, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ThemeToggle } from "@/components/theme-toggle"

export default function ForgotPasswordPage() {
  const [tcKimlik, setTcKimlik] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const cleanTc = tcKimlik.replace(/\D/g, "")
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tcKimlik: cleanTc }),
    })
    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(result.error || "Şifre sıfırlama isteği alınamadı.")
      setLoading(false)
      return
    }

    setMessage(result.message || "Eğer kayıtlı e-posta varsa şifre sıfırlama bağlantısı gönderildi.")
    setLoading(false)
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
                <CardTitle className="text-2xl">Şifremi unuttum</CardTitle>
                <CardDescription>TC kimlik numaranı gir, kayıtlı e-postana sıfırlama bağlantısı gönderelim.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {message && (
                <Alert>
                  <MailCheck className="h-4 w-4" />
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                <Label htmlFor="tc">TC Kimlik No</Label>
                <div className="relative">
                  <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="tc"
                    inputMode="numeric"
                    maxLength={11}
                    value={tcKimlik}
                    onChange={(event) => setTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="h-11 pl-10"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sıfırlama bağlantısı gönder
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </main>
  )
}
