"use client"

import { useEffect } from "react"

declare global {
  interface Window {
    hesapDesktop?: {
      getVersion?: () => Promise<string>
      setBadgeCount?: (count: number) => Promise<{ ok: boolean }>
      getStartupEnabled?: () => Promise<{ enabled: boolean }>
      setStartupEnabled?: (enabled: boolean) => Promise<{ enabled: boolean }>
    }
  }
}

function getOrCreateDeviceId() {
  const key = "hesap.deviceLicenseId"
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  window.localStorage.setItem(key, next)
  return next
}

function platformLabel() {
  if (typeof window !== "undefined" && window.hesapDesktop) return "desktop"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("android")) return "android"
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios"
  return "web"
}

export function DeviceLicenseRegistration() {
  useEffect(() => {
    let alive = true
    async function register() {
      const platform = platformLabel()
      const response = await fetch("/api/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getOrCreateDeviceId(),
          platform,
          label: platform === "desktop" ? "Windows uygulamasi" : navigator.userAgent.slice(0, 80),
        }),
      }).catch(() => null)

      if (!alive || !response) return
      if (response.status === 403) {
        window.location.href = "/device-blocked"
      }
    }

    register()
    const timer = window.setInterval(register, 5 * 60_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  return null
}
