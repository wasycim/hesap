"use client"

import { Capacitor } from "@capacitor/core"
import { Preferences } from "@capacitor/preferences"

const webDeviceKey = "hesap.deviceLicenseId"
const nativeDeviceKey = "hesap:native-device-id"

function newDeviceId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function getOrCreateDeviceIdentity() {
  const native = Capacitor.isNativePlatform()
  const platform = native
    ? Capacitor.getPlatform()
    : window.hesapDesktop
      ? "desktop"
      : /iphone|ipad|ipod/i.test(navigator.userAgent)
        ? "ios-web"
        : /android/i.test(navigator.userAgent)
          ? "android-web"
          : "web"

  if (native) {
    const stored = await Preferences.get({ key: nativeDeviceKey }).catch(() => ({ value: null }))
    const deviceId = stored.value || window.localStorage.getItem(webDeviceKey) || newDeviceId()
    await Preferences.set({ key: nativeDeviceKey, value: deviceId }).catch(() => undefined)
    window.localStorage.setItem(webDeviceKey, deviceId)
    return { deviceId, platform, label: `${platform === "ios" ? "iPhone / iPad" : "Mobil"} uygulaması` }
  }

  const deviceId = window.localStorage.getItem(webDeviceKey) || newDeviceId()
  window.localStorage.setItem(webDeviceKey, deviceId)
  return {
    deviceId,
    platform,
    label: platform === "desktop" ? "Windows uygulaması" : navigator.userAgent.slice(0, 100),
  }
}

export function isPhoneMobileDeviceContext() {
  if (typeof window === "undefined") return false
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform()
    return platform === "ios" || platform === "android"
  }

  const nativeParam = new URLSearchParams(window.location.search).get("native") || ""
  if (nativeParam === "expo-ios" || nativeParam === "expo-android") return true

  const nativeCookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("hesap-native-platform="))
    ?.split("=")[1]
  if (nativeCookie === "ios" || nativeCookie === "android") return true

  return window.localStorage.getItem("hesap.expoGo") === "true"
}
