"use client"

import QRCode from "qrcode"
import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock3, IdCard, KeyRound, LockKeyhole, LogOut, QrCode, RotateCcw, ShieldCheck, Smartphone } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createMesaiQrToken, mesaiDemoEmployees, type MesaiEmployee } from "@/lib/mesai-demo"

type RegisteredDevice = {
  deviceId: string
  employeeId: string
  tcKimlik: string
  pin: string
  registeredAt: string
}

const deviceStorageKey = "mesai-personel-device"

function makeDeviceId() {
  return crypto.randomUUID()
}

function maskTc(value: string) {
  return `${value.slice(0, 3)}******${value.slice(-2)}`
}

export default function MesaiGirisPage() {
  const [registeredDevice, setRegisteredDevice] = useState<RegisteredDevice | null>(null)
  const [tcKimlik, setTcKimlik] = useState("")
  const [password, setPassword] = useState("")
  const [newPin, setNewPin] = useState("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [qrImage, setQrImage] = useState("")
  const [qrToken, setQrToken] = useState("")
  const [secondsLeft, setSecondsLeft] = useState(10)

  useEffect(() => {
    const saved = window.localStorage.getItem(deviceStorageKey)
    if (saved) {
      setRegisteredDevice(JSON.parse(saved) as RegisteredDevice)
    }
  }, [])

  const employee = useMemo<MesaiEmployee | null>(() => {
    if (!registeredDevice) return null
    return mesaiDemoEmployees.find((item) => item.id === registeredDevice.employeeId) || null
  }, [registeredDevice])

  useEffect(() => {
    if (!isLoggedIn || !employee) return

    let mounted = true

    const refreshQr = async () => {
      const token = createMesaiQrToken(employee.id)
      const image = await QRCode.toDataURL(token, {
        width: 320,
        margin: 2,
        errorCorrectionLevel: "M",
        color: {
          dark: "#111827",
          light: "#ffffff",
        },
      })

      if (!mounted) return
      setQrToken(token)
      setQrImage(image)
      setSecondsLeft(10)
    }

    refreshQr()
    const qrInterval = window.setInterval(refreshQr, 10_000)
    const countdownInterval = window.setInterval(() => {
      setSecondsLeft((current) => current <= 1 ? 10 : current - 1)
    }, 1_000)

    return () => {
      mounted = false
      window.clearInterval(qrInterval)
      window.clearInterval(countdownInterval)
    }
  }, [employee, isLoggedIn])

  function registerDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    const cleanTc = tcKimlik.replace(/\D/g, "")
    const foundEmployee = mesaiDemoEmployees.find((item) => item.tcKimlik === cleanTc && item.password === password)

    if (!foundEmployee) {
      setError("TC veya ÅŸifre hatalÄ±.")
      return
    }

    if (!/^\d{6}$/.test(newPin)) {
      setError("PIN tam 6 haneli olmalÄ±.")
      return
    }

    const nextDevice: RegisteredDevice = {
      deviceId: makeDeviceId(),
      employeeId: foundEmployee.id,
      tcKimlik: foundEmployee.tcKimlik,
      pin: newPin,
      registeredAt: new Date().toISOString(),
    }

    window.localStorage.setItem(deviceStorageKey, JSON.stringify(nextDevice))
    setRegisteredDevice(nextDevice)
    setIsLoggedIn(true)
    setPassword("")
    setNewPin("")
  }

  function loginWithPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")

    if (!registeredDevice) return

    if (pin !== registeredDevice.pin) {
      setError("PIN hatalÄ±.")
      return
    }

    setIsLoggedIn(true)
    setPin("")
  }

  function logout() {
    setIsLoggedIn(false)
    setQrImage("")
    setQrToken("")
  }

  function resetDevice() {
    window.localStorage.removeItem(deviceStorageKey)
    setRegisteredDevice(null)
    setIsLoggedIn(false)
    setQrImage("")
    setQrToken("")
    setPin("")
    setError("")
  }

  if (isLoggedIn && employee && registeredDevice) {
    return (
      <main className="min-h-dvh bg-slate-950 px-4 py-6 text-white sm:px-6">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-md flex-col justify-center gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Mesai QR</p>
              <h1 className="text-2xl font-bold">{employee.name}</h1>
            </div>
            <Badge className="bg-emerald-500 text-white">
              <CheckCircle2 className="h-3 w-3" />
              Aktif
            </Badge>
          </div>

          <Card className="border-slate-800 bg-white text-slate-950 shadow-2xl">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2">
                <div>
                  <p className="text-xs text-slate-500">Cihaz</p>
                  <p className="text-sm font-semibold">{registeredDevice.deviceId.slice(0, 8).toUpperCase()}</p>
                </div>
                <Smartphone className="h-5 w-5 text-slate-500" />
              </div>

              <div className="flex aspect-square items-center justify-center rounded-lg border bg-white p-4">
                {qrImage ? (
                  <img src={qrImage} alt="Mesai QR kodu" className="h-full w-full object-contain" />
                ) : (
                  <QrCode className="h-16 w-16 animate-pulse text-slate-300" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs text-slate-500">Yenilenme</p>
                  <p className="flex items-center gap-1 text-lg font-bold">
                    <Clock3 className="h-4 w-4" />
                    {secondsLeft} sn
                  </p>
                </div>
                <div className="rounded-lg bg-slate-100 p-3">
                  <p className="text-xs text-slate-500">GÃ¶rev</p>
                  <p className="truncate text-lg font-bold">{employee.role}</p>
                </div>
              </div>

              <p className="text-center text-sm text-slate-500">
                Bu QR kodu terminal ekranındaki kameraya gösterin.
              </p>
              <input value={qrToken} readOnly className="sr-only" aria-label="GÃ¼ncel mesai QR token" />
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2 p-5 pt-0">
              <Button variant="outline" onClick={logout} className="gap-2">
                <LogOut className="h-4 w-4" />
                Kilitle
              </Button>
              <Button variant="destructive" onClick={resetDevice} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                SÄ±fÄ±rla
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(135deg,#08111f,#10233a_48%,#0b1726)] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md items-center justify-center">
        <Card className="w-full border-white/10 bg-white/95 text-slate-950 shadow-2xl">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-950 text-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Personel Mesai GiriÅŸi</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                {registeredDevice ? `${maskTc(registeredDevice.tcKimlik)} bu cihaza kayÄ±tlÄ±.` : "Ä°lk giriÅŸte cihazÄ±nÄ±zÄ± kaydedin."}
              </p>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {registeredDevice ? (
              <form onSubmit={loginWithPin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pin">6 Haneli PIN</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="pin"
                      inputMode="numeric"
                      maxLength={6}
                      value={pin}
                      onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-12 pl-10 text-center text-lg tracking-[0.35em]"
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="h-11 w-full" disabled={pin.length !== 6}>
                  PIN ile GiriÅŸ Yap
                </Button>
              </form>
            ) : (
              <form onSubmit={registerDevice} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tc">TC Kimlik No</Label>
                  <div className="relative">
                    <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="tc"
                      inputMode="numeric"
                      maxLength={11}
                      value={tcKimlik}
                      onChange={(event) => setTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                      className="h-11 pl-10"
                      placeholder="11 haneli TC"
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Åifre</Label>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="h-11 pl-10"
                      placeholder="Hesap ÅŸifresi"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-pin">6 Haneli PIN Belirle</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="new-pin"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(event) => setNewPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-11 pl-10"
                      placeholder="000000"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="h-11 w-full">
                  CihazÄ± Kaydet ve QR AÃ§
                </Button>
              </form>
            )}
          </CardContent>

          <CardFooter className="block space-y-2 text-xs text-slate-500">
            <p>Local test hesaplarÄ±: 10000000146 / 10000000154 / 10000000162</p>
            <p>Demo ÅŸifre: 123456</p>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

