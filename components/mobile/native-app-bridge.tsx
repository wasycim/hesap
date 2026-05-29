"use client"

import { useEffect, useMemo, useState } from "react"
import { App as CapacitorApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { LocalNotifications } from "@capacitor/local-notifications"
import { Network } from "@capacitor/network"
import { Preferences } from "@capacitor/preferences"
import { PushNotifications } from "@capacitor/push-notifications"
import { SplashScreen } from "@capacitor/splash-screen"
import { StatusBar, Style } from "@capacitor/status-bar"
import { BarChart3, CalendarDays, Camera, Home, RefreshCw, WalletCards } from "lucide-react"

const nativeNavItems = [
  { label: "Panel", href: "/dashboard", icon: Home },
  { label: "Mesai", href: "/dashboard/mesai", icon: Camera },
  { label: "Takip", href: "/dashboard/mesai-takip", icon: BarChart3 },
  { label: "Vardiya", href: "/dashboard/vardiya", icon: CalendarDays },
  { label: "Maaş", href: "/dashboard/maaslar", icon: WalletCards },
]

type PushState = "idle" | "granted" | "denied" | "unavailable"

function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform()
}

export function NativeAppBridge() {
  const [native, setNative] = useState(false)
  const [online, setOnline] = useState(true)
  const [pushState, setPushState] = useState<PushState>("idle")
  const [currentPath, setCurrentPath] = useState("/")

  useEffect(() => {
    if (!isNativeApp()) return

    let active = true
    setNative(true)
    setCurrentPath(window.location.pathname)

    async function bootNativeShell() {
      const status = await Network.getStatus()
      if (!active) return
      setOnline(status.connected)

      await SplashScreen.hide().catch(() => undefined)
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => undefined)
      await StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => undefined)

      await Preferences.set({ key: "hesap:last-opened-at", value: new Date().toISOString() }).catch(() => undefined)
      await registerPushNotifications(setPushState)
      await scheduleNativeReminder()
    }

    const networkListener = Network.addListener("networkStatusChange", (status) => {
      setOnline(status.connected)
    })

    const appListener = CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        setCurrentPath(window.location.pathname)
        await Preferences.set({ key: "hesap:last-resumed-at", value: new Date().toISOString() }).catch(() => undefined)
      }
    })

    bootNativeShell()

    return () => {
      active = false
      networkListener.then((listener) => listener.remove()).catch(() => undefined)
      appListener.then((listener) => listener.remove()).catch(() => undefined)
    }
  }, [])

  const activePath = useMemo(() => currentPath.split("?")[0], [currentPath])

  if (!native) return null

  function goTo(href: string) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
    setCurrentPath(href)
    window.location.href = href
  }

  function reload() {
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => undefined)
    window.location.reload()
  }

  return (
    <>
      {!online && (
        <div className="fixed inset-0 z-[10000] grid place-items-center bg-slate-950 px-6 text-white">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/10">
              <RefreshCw className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-2xl font-bold">İnternet bağlantısı yok</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Hesap verileri güvenli şekilde sunucudan alınır. Bağlantınızı kontrol edip tekrar deneyin.
            </p>
            <button
              type="button"
              onClick={reload}
              className="mt-6 h-11 w-full rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-950/40"
            >
              Yeniden yükle
            </button>
          </div>
        </div>
      )}

      {pushState === "denied" && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+10px)] z-[9999] rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg dark:bg-amber-950 dark:text-amber-100">
          Bildirim izni kapalı. Mesai ve rapor hatırlatmaları için cihaz ayarlarından bildirimleri açabilirsiniz.
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[9998] border-t bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.14)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {nativeNavItems.map((item) => {
            const Icon = item.icon
            const active = activePath === item.href || (item.href !== "/dashboard" && activePath.startsWith(item.href))
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => goTo(item.href)}
                className={`grid min-h-12 place-items-center rounded-xl px-1 text-[10px] font-semibold transition ${
                  active ? "bg-emerald-500 text-white shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Icon className="mb-0.5 h-4 w-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <style jsx global>{`
        body {
          padding-bottom: calc(env(safe-area-inset-bottom) + 72px);
        }
      `}</style>
    </>
  )
}

async function registerPushNotifications(setPushState: (state: PushState) => void) {
  if (!Capacitor.isPluginAvailable("PushNotifications")) {
    setPushState("unavailable")
    return
  }

  const permission = await PushNotifications.requestPermissions().catch(() => ({ receive: "denied" as const }))
  if (permission.receive !== "granted") {
    setPushState("denied")
    return
  }

  setPushState("granted")
  await PushNotifications.register().catch(() => undefined)

  await PushNotifications.addListener("registration", async (token) => {
    await Preferences.set({ key: "hesap:push-token", value: token.value }).catch(() => undefined)
  })

  await PushNotifications.addListener("registrationError", async (error) => {
    await Preferences.set({ key: "hesap:push-registration-error", value: JSON.stringify(error) }).catch(() => undefined)
  })

  await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
    const target = String(event.notification.data?.href || "/dashboard/mesai-takip")
    if (target.startsWith("/")) window.location.href = target
  })
}

async function scheduleNativeReminder() {
  if (!Capacitor.isPluginAvailable("LocalNotifications")) return

  const permission = await LocalNotifications.requestPermissions().catch(() => ({ display: "denied" as const }))
  if (permission.display !== "granted") return

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 20260529,
        title: "Hesap hazır",
        body: "Mesai takip ve raporlarınızı uygulamadan kontrol edebilirsiniz.",
        schedule: { at: new Date(Date.now() + 5000) },
        smallIcon: "ic_stat_hesap",
      },
    ],
  }).catch(() => undefined)
}
