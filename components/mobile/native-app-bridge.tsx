"use client"

import { useEffect, useMemo, useState } from "react"
import { App as CapacitorApp } from "@capacitor/app"
import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"
import { Network } from "@capacitor/network"
import { Preferences } from "@capacitor/preferences"
import { PushNotifications } from "@capacitor/push-notifications"
import { SplashScreen } from "@capacitor/splash-screen"
import { StatusBar, Style } from "@capacitor/status-bar"
import { BarChart3, CalendarDays, Camera, Home, LogOut, WalletCards } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const nativeNavItems = [
  { label: "Panel", href: "/dashboard", icon: Home },
  { label: "Mesai", href: "/dashboard/mesai", icon: Camera },
  { label: "Takip", href: "/dashboard/mesai-takip", icon: BarChart3 },
  { label: "Vardiya", href: "/dashboard/vardiya", icon: CalendarDays },
  { label: "Maaş", href: "/dashboard/maaslar", icon: WalletCards },
]

type PushState = "idle" | "granted" | "denied" | "unavailable"
let pushListenersReady = false
let pushRegistrationPromise: Promise<void> | null = null

const visibleNativeNavItems = [
  ...nativeNavItems.filter((item) => item.href !== "/dashboard/maaslar"),
  { label: "Cikis", href: "/auth/giris", icon: LogOut, action: "logout" as const },
]

function isNativeApp() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform()
}

export function NativeAppBridge() {
  const supabase = createClient()
  const [native, setNative] = useState(false)
  const [, setOnline] = useState(true)
  const [pushState, setPushState] = useState<PushState>("idle")
  const [currentPath, setCurrentPath] = useState("/")
  const [nativePlatform, setNativePlatform] = useState("")

  useEffect(() => {
    if (!isNativeApp()) return

    let active = true
    setNative(true)
    setCurrentPath(window.location.pathname)
    const platform = Capacitor.getPlatform()
    setNativePlatform(platform)
    document.cookie = `hesap-native-platform=${platform}; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`
    document.documentElement.classList.add("native-app", `native-${platform}`)
    document.body.classList.add("native-app-body")

    async function bootNativeShell() {
      const status = await Network.getStatus()
      if (!active) return
      setOnline(status.connected)

      await SplashScreen.hide().catch(() => undefined)
      await StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)
      await StatusBar.setBackgroundColor({ color: "#0f172a" }).catch(() => undefined)

      await Preferences.set({ key: "hesap:last-opened-at", value: new Date().toISOString() }).catch(() => undefined)
      await unlockWithPlatformBiometric().catch(() => undefined)
      await registerPushNotifications(setPushState)
      await retryRegistration()

      const path = window.location.pathname
      if (platform === "ios" && !path.startsWith("/mobile") && !path.startsWith("/auth/") && path !== "/maintenance") {
        window.location.replace("/mobile")
      }
    }

    async function retryRegistration() {
      const storedToken = await Preferences.get({ key: "hesap:push-token" }).catch(() => ({ value: null }))
      await registerNativeDevice(storedToken.value || undefined)
    }

    const networkListener = Network.addListener("networkStatusChange", (status) => {
      setOnline(status.connected)
    })

    const appListener = CapacitorApp.addListener("appStateChange", async ({ isActive }) => {
      if (isActive) {
        setCurrentPath(window.location.pathname)
        await Preferences.set({ key: "hesap:last-resumed-at", value: new Date().toISOString() }).catch(() => undefined)
        await retryRegistration()
      }
    })

    const visibilityListener = () => {
      if (document.visibilityState === "visible") {
        retryRegistration().catch(() => undefined)
      }
    }
    document.addEventListener("visibilitychange", visibilityListener)
    const pushSyncListener = () => {
      registerPushNotifications(setPushState)
        .then(() => retryRegistration())
        .then(() => window.dispatchEvent(new CustomEvent("hesap:native-push-sync-result", { detail: { ok: true } })))
        .catch((error) => {
          window.dispatchEvent(new CustomEvent("hesap:native-push-sync-result", {
            detail: { ok: false, error: error instanceof Error ? error.message : String(error) },
          }))
        })
    }
    window.addEventListener("hesap:sync-native-push", pushSyncListener)
    const retryTimer = window.setInterval(() => {
      retryRegistration().catch(() => undefined)
    }, 300_000)

    bootNativeShell()

    return () => {
      active = false
      window.clearInterval(retryTimer)
      document.documentElement.classList.remove("native-app", `native-${platform}`)
      document.body.classList.remove("native-app-body")
      document.removeEventListener("visibilitychange", visibilityListener)
      window.removeEventListener("hesap:sync-native-push", pushSyncListener)
      networkListener.then((listener) => listener.remove()).catch(() => undefined)
      appListener.then((listener) => listener.remove()).catch(() => undefined)
    }
  }, [])

  const activePath = useMemo(() => currentPath.split("?")[0], [currentPath])

  if (!native || nativePlatform === "ios") return null

  async function goTo(item: (typeof visibleNativeNavItems)[number]) {
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
    if ("action" in item && item.action === "logout") {
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
      await supabase.auth.signOut().catch(() => undefined)
      window.location.href = "/auth/giris"
      return
    }

    setCurrentPath(item.href)
    window.location.href = item.href
  }

  return (
    <>
      {pushState === "denied" && (
        <div className="fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+10px)] z-[9999] rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 shadow-lg dark:bg-amber-950 dark:text-amber-100">
          Bildirim izni kapalı. Mesai ve rapor hatırlatmaları için cihaz ayarlarından bildirimleri açabilirsiniz.
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-[9998] border-t bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.14)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {visibleNativeNavItems.map((item) => {
            const Icon = item.icon
            const active = activePath === item.href || (item.href !== "/dashboard" && activePath.startsWith(item.href))
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => goTo(item)}
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
  if (pushRegistrationPromise) return pushRegistrationPromise
  pushRegistrationPromise = registerPushNotificationsInternal(setPushState).finally(() => {
    pushRegistrationPromise = null
  })
  return pushRegistrationPromise
}

async function registerPushNotificationsInternal(setPushState: (state: PushState) => void) {
  if (!Capacitor.isPluginAvailable("PushNotifications")) {
    setPushState("unavailable")
    return
  }

  let permission = await PushNotifications.checkPermissions().catch(() => ({ receive: "denied" as const }))
  if (permission.receive === "prompt" || permission.receive === "prompt-with-rationale") {
    permission = await PushNotifications.requestPermissions().catch(() => ({ receive: "denied" as const }))
  }
  if (permission.receive !== "granted") {
    setPushState("denied")
    return
  }

  setPushState("granted")
  if (!pushListenersReady) {
    pushListenersReady = true
    await PushNotifications.addListener("registration", async (token) => {
      await Preferences.set({ key: "hesap:push-token", value: token.value }).catch(() => undefined)
      await Preferences.remove({ key: "hesap:push-registration-error" }).catch(() => undefined)
      await registerNativeDevice(token.value)
    })

    await PushNotifications.addListener("registrationError", async (error) => {
      await Preferences.set({ key: "hesap:push-registration-error", value: JSON.stringify(error) }).catch(() => undefined)
      await registerNativeDevice(undefined, error)
    })

    await PushNotifications.addListener("pushNotificationReceived", (notification) => {
      window.dispatchEvent(new CustomEvent("hesap:native-push-received", { detail: notification }))
    })

    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const target = String(event.notification.data?.href || "/dashboard/bildirimler")
      if (target.startsWith("/")) window.location.href = target
    })
  }

  if (Capacitor.getPlatform() === "android") {
    await PushNotifications.createChannel({
      id: "hesap_alerts",
      name: "Hesap Bildirimleri",
      description: "Mesai, vardiya, rapor ve güvenlik uyarıları",
      importance: 5,
      visibility: 1,
      sound: "default",
    }).catch(() => undefined)
  }
  await PushNotifications.register().catch(() => undefined)
}

async function registerNativeDevice(pushToken?: string, pushRegistrationError?: unknown) {
  const platform = Capacitor.getPlatform()
  const token = pushToken || (await Preferences.get({ key: "hesap:push-token" }).catch(() => ({ value: null }))).value || undefined
  const storedRegistrationError = pushRegistrationError
    ? JSON.stringify(pushRegistrationError)
    : (await Preferences.get({ key: "hesap:push-registration-error" }).catch(() => ({ value: null }))).value || undefined
  const stored = await Preferences.get({ key: "hesap:native-device-id" }).catch(() => ({ value: null }))
  const deviceId = stored.value || (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
  if (!stored.value) {
    await Preferences.set({ key: "hesap:native-device-id", value: deviceId }).catch(() => undefined)
  }

  const response = await fetch("/api/mobile/register-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, platform, pushToken: token, pushRegistrationError: storedRegistrationError }),
  }).catch((error) => {
    Preferences.set({
      key: "hesap:native-device-register-error",
      value: JSON.stringify({ message: error instanceof Error ? error.message : String(error), at: new Date().toISOString() }),
    }).catch(() => undefined)
    return null
  })

  if (!response) return
  const result = await response.json().catch(() => ({}))
  await Preferences.set({
    key: "hesap:native-device-register-result",
    value: JSON.stringify({
      ok: response.ok,
      status: response.status,
      pushTokenSaved: Boolean(result?.pushTokenSaved),
      at: new Date().toISOString(),
    }),
  }).catch(() => undefined)
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlToArrayBuffer(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes.buffer
}

async function unlockWithPlatformBiometric() {
  if (!Capacitor.isNativePlatform()) return
  if (typeof PublicKeyCredential === "undefined") return
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
  if (!available) return

  const enabled = await Preferences.get({ key: "hesap:biometric-enabled" }).catch(() => ({ value: null }))
  const credential = await Preferences.get({ key: "hesap:biometric-credential-id" }).catch(() => ({ value: null }))
  if (enabled.value === "false") return

  if (!credential.value) {
    const created = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { name: "Hesap" },
        user: {
          id: randomBytes(16),
          name: "hesap",
          displayName: "Hesap kullanicisi",
        },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60_000,
        attestation: "none",
      },
    }).catch(() => null) as PublicKeyCredential | null
    if (created?.rawId) {
      await Preferences.set({ key: "hesap:biometric-enabled", value: "true" }).catch(() => undefined)
      await Preferences.set({ key: "hesap:biometric-credential-id", value: arrayBufferToBase64Url(created.rawId) }).catch(() => undefined)
    }
    return
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: base64UrlToArrayBuffer(credential.value), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
    },
  }).catch(() => null)

  if (!assertion) {
    window.location.href = "/auth/giris"
  }
}

