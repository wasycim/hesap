"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { BellRing, CheckCheck, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type NotificationItem = {
  id: string
  title: string
  body: string
  href: string
  level: "info" | "success" | "warning" | "error"
  read_at: string | null
  created_at: string
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

export default function BildirimlerPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const response = await fetch("/api/notifications", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setItems(response.ok ? data.notifications || [] : [])
    setLoading(false)
  }

  async function markAllRead() {
    const now = new Date().toISOString()
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at || now })))
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => undefined)
  }

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items])

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-normal">
            <BellRing className="h-6 w-6 text-emerald-500" />
            Bildirimler
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Okundu bilgisi, sistem uyarilari, mesai ve push bildirim gecmisi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Yenile
          </Button>
          <Button onClick={markAllRead} disabled={!unreadCount} className="gap-2">
            <CheckCheck className="h-4 w-4" />
            Tumunu okundu yap
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Toplam" value={String(items.length)} />
        <Metric label="Okunmamis" value={String(unreadCount)} />
        <Metric label="Okunmus" value={String(items.length - unreadCount)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Bildirim gecmisi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? <p className="text-sm text-muted-foreground">Yukleniyor...</p> : null}
          {!loading && items.length === 0 ? <p className="rounded-lg border p-4 text-sm text-muted-foreground">Bildirim yok.</p> : null}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{item.title}</h2>
                    <Badge variant={item.read_at ? "secondary" : "default"}>{item.read_at ? "Okundu" : "Yeni"}</Badge>
                    <Badge variant="outline">{item.level}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={item.href || "/dashboard"}>Ilgili sayfa</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </main>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )
}
