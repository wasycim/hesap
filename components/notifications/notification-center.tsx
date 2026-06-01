"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
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
}

export function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    load()
    requestDesktopNotificationPermission()
    const timer = window.setInterval(load, 30_000)
    return () => window.clearInterval(timer)
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

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items])

  return (
    <div className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top))] z-50 lg:right-5">
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
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-2">
            <Link href="/dashboard/bildirimler" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 text-center text-xs font-bold text-emerald-600 hover:bg-emerald-500/10">
              Bildirim gecmisini ac
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function requestDesktopNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => undefined)
  }
}

function showDesktopNotifications(items: NotificationItem[]) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return

  const notifiedKey = "hesap.desktop.notifiedNotificationIds"
  const notified = new Set<string>(safeParseStringArray(window.localStorage.getItem(notifiedKey)))
  let changed = false

  for (const item of items) {
    if (item.read_at || notified.has(item.id)) continue
    notified.add(item.id)
    changed = true

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
  }

  if (changed) {
    window.localStorage.setItem(notifiedKey, JSON.stringify([...notified].slice(-200)))
  }
}

function safeParseStringArray(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]")
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []
  } catch {
    return []
  }
}
