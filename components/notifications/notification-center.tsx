"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type NotificationItem = {
  id: string
  title: string
  body: string
  href: string
  level: "info" | "success" | "warning" | "error"
  read_at: string | null
  created_at: string
  deletable?: boolean
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    load()
    requestDesktopNotificationPermission()
    const timer = window.setInterval(load, 30_000)

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load()
      }
    }
    window.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("focus", onVisibilityChange)

    const bridge = typeof window !== "undefined" ? (window as any).hesapDesktop : null
    const unsubscribeNavigate = bridge?.onNavigate?.((href: string) => {
      if (href) {
        window.location.assign(href)
      }
    })

    return () => {
      window.clearInterval(timer)
      window.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("focus", onVisibilityChange)
      unsubscribeNavigate?.()
    }
  }, [])

  async function load() {
    const response = await fetch("/api/notifications", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    if (response.ok) {
      const nextItems = (data.notifications || []) as NotificationItem[]
      showDesktopNotifications(nextItems)
      setItems(nextItems)
    }
  }

  async function markRead(item: NotificationItem) {
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    }).catch(() => undefined)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    setItems((current) => current.map((entry) => ({ ...entry, read_at: entry.read_at || now })))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined)
  }

  async function deleteNotification(item: NotificationItem) {
    if (!item.deletable) return
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    await fetch(`/api/notifications?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => undefined)
  }

  function handleTestNotification() {
    const testItem: NotificationItem = {
      id: `test-${Date.now()}`,
      title: "Hesap Masaüstü Bildirimi",
      body: "Masaüstü bildirimleri ve sesli uyarılar başarıyla çalışıyor!",
      href: "/dashboard/bildirimler",
      level: "success",
      read_at: null,
      created_at: new Date().toISOString(),
    }
    showDesktopNotifications([testItem], true)
  }

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items])

  useEffect(() => {
    window.hesapDesktop?.setBadgeCount?.(unreadCount).catch(() => undefined)
  }, [unreadCount])

  return (
    <div className="notification-center-floating fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 lg:right-5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="relative rounded-full bg-background/95 shadow-sm backdrop-blur">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Bildirimler</h2>
                <p className="text-xs text-muted-foreground">Geç kalma, fazla mesai ve sistem uyarıları.</p>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 ? (
                  <button type="button" onClick={markAllRead} className="rounded-md px-2 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/10">
                    Tumunu okundu yap
                  </button>
                ) : null}
                <Badge variant="outline">{unreadCount} yeni</Badge>
              </div>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Bildirim yok.</p>
            ) : items.map((item) => (
              <div key={item.id} className="border-b p-3 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <Link href={item.href || "/dashboard"} onClick={() => { markRead(item); setOpen(false) }} className="min-w-0 flex-1">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")}</p>
                  </Link>
                  {!item.read_at ? (
                    <button type="button" onClick={() => markRead(item)} className="rounded-md p-1 text-emerald-600 hover:bg-emerald-500/10" title="Okundu işaretle">
                      <CheckCheck className="h-4 w-4" />
                    </button>
                  ) : null}
                  {item.deletable ? (
                    <button type="button" onClick={() => deleteNotification(item)} className="rounded-md p-1 text-red-500 hover:bg-red-500/10" title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-2 flex items-center justify-between gap-2">
            <Link href="/dashboard/bildirimler" onClick={() => setOpen(false)} className="rounded-md px-3 py-1.5 text-center text-xs font-bold text-emerald-600 hover:bg-emerald-500/10">
              Bildirim geçmişini aç
            </Link>
            <button
              type="button"
              onClick={handleTestNotification}
              className="rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Bildirim Test Et
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function requestDesktopNotificationPermission() {
  if (isNativeRuntime()) return
  if (typeof window !== "undefined" && (window as any).hesapDesktop?.showNotification) {
    return
  }
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => undefined)
  }
}

function playNotificationChime() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = "sine"
    osc1.frequency.setValueAtTime(587.33, now)
    gain1.gain.setValueAtTime(0.12, now)
    gain1.gain.exponentialRampToValueAtTime(0.005, now + 0.16)
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(now)
    osc1.stop(now + 0.16)

    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = "sine"
    osc2.frequency.setValueAtTime(880, now + 0.09)
    gain2.gain.setValueAtTime(0.15, now + 0.09)
    gain2.gain.exponentialRampToValueAtTime(0.005, now + 0.32)
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(now + 0.09)
    osc2.stop(now + 0.32)
  } catch {}
}

function showDesktopNotifications(items: NotificationItem[], force = false) {
  if (isNativeRuntime()) return
  if (typeof window === "undefined") return

  const desktopBridge = (window as any).hesapDesktop
  const isElectron = Boolean(desktopBridge?.showNotification)

  if (!isElectron) {
    if (!("Notification" in window) || Notification.permission !== "granted") return
  }

  const notifiedKey = "hesap.desktop.notifiedNotificationIds"
  const notified = new Set<string>(safeParseStringArray(window.localStorage.getItem(notifiedKey)))
  let changed = false

  for (const item of items) {
    if (!force && (item.read_at || notified.has(item.id))) continue
    if (!force) notified.add(item.id)
    changed = true

    if (isElectron) {
      desktopBridge.showNotification({
        id: item.id,
        title: item.title || "Hesap",
        body: item.body || "Yeni bildirim var.",
        href: item.href || "/dashboard/bildirimler",
        level: item.level,
      }).catch((err: any) => console.error("Desktop notification invoke failed:", err))
    } else {
      try {
        const notification = new Notification(item.title || "Hesap bildirimi", {
          body: item.body || "Yeni bildirim var.",
          icon: "/icon.png",
          badge: "/icon.png",
          tag: `hesap-${item.id}`,
          requireInteraction: item.level === "warning" || item.level === "error",
        })

        notification.onclick = () => {
          window.focus()
          window.location.assign(item.href || "/dashboard")
          notification.close()
        }
      } catch (err) {
        console.error("HTML5 notification failed:", err)
      }
    }
  }

  if (changed) {
    playNotificationChime()
    if (!force) {
      window.localStorage.setItem(notifiedKey, JSON.stringify([...notified].slice(-200)))
    }
  }
}

function isNativeRuntime() {
  const capacitor = typeof window !== "undefined" ? (window as any).Capacitor : null
  return Boolean(capacitor?.isNativePlatform?.())
}

function safeParseStringArray(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]")
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}
