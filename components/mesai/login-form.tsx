"use client"

import { FormEvent, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { LockKeyhole, LogIn, Moon, Sun, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const savedLoginKey = "hesap.savedLogin"

export function LoginForm() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [tcKimlik, setTcKimlik] = useState("")
  const [password, setPassword] = useState("")
  const [rememberCredentials, setRememberCredentials] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedLoginKey)
      if (!raw) return
      const saved = JSON.parse(raw) as { tcKimlik?: string; password?: string; remember?: boolean }
      if (saved.remember) {
        setTcKimlik(String(saved.tcKimlik || "").replace(/\D/g, "").slice(0, 11))
        setPassword(String(saved.password || ""))
        setRememberCredentials(true)
      }
    } catch {
      window.localStorage.removeItem(savedLoginKey)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setLoading(true)

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tcKimlik, password }),
    })

    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      setError(payload.error ?? "Giriş yapılamadı.")
      return
    }

    if (rememberCredentials) {
      window.localStorage.setItem(savedLoginKey, JSON.stringify({ tcKimlik, password, remember: true }))
    } else {
      window.localStorage.removeItem(savedLoginKey)
    }

    router.replace(payload.user?.role === "ADMIN" ? "/personel-mesai" : "/mesai-qr")
    router.refresh()
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_34%),linear-gradient(135deg,var(--background),var(--muted))] p-4">
      <div className="absolute right-4 top-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Tema değiştir"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <Card className="w-full max-w-md border-border/70 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Personel mesai girişi</CardTitle>
          <CardDescription>TC kimlik ve şifre ile terminal ya da yönetim paneline bağlanın.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="tcKimlik">TC Kimlik</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tcKimlik"
                  name="username"
                  value={tcKimlik}
                  onChange={(event) => setTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                  className="pl-9"
                  inputMode="numeric"
                  autoComplete="username"
                  placeholder="11 haneli TC"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Şifre</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9"
                  type="password"
                  autoComplete="current-password"
                  placeholder="********"
                  required
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
              <Checkbox
                checked={rememberCredentials}
                onCheckedChange={(checked) => setRememberCredentials(checked === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-semibold">Bu cihazda TC ve şifreyi hatırla</span>
                <span className="block text-xs text-muted-foreground">
                  EXE veya tarayıcı bu cihazda açıldığında giriş alanları otomatik dolar.
                </span>
              </span>
            </label>

            {error ? <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}

            <Button className="w-full gap-2" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Giriş yapılıyor" : "Giriş yap"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
