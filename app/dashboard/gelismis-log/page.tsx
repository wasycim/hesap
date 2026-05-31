"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Download, FileSearch, RefreshCw, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useSube } from "@/contexts/sube-context"
import { openPdfReport } from "@/lib/pdf-report"

type SecurityEvent = {
  id: string
  user_id: string | null
  user_email: string | null
  user_display_name?: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  branch_name?: string | null
  is_trusted_ip?: boolean
  trusted_ip_owners?: Array<{ user_id: string; email: string | null; display_name: string }>
  details: Record<string, unknown> | null
  created_at: string
}

type Payload = {
  events: SecurityEvent[]
  page: number
  total: number
  totalPages: number
  hasMore: boolean
}

const EVENT_TYPES = [
  "all",
  "login",
  "failed_login",
  "password_reset_request",
  "password_change",
  "user_create",
  "user_update",
  "user_delete",
  "terminal_device_approved",
  "terminal_device_revoked",
  "backup_export",
  "backup_restore",
  "digest_settings_update",
  "admin_digest_sent",
  "admin_digest_test_sent",
  "attendance_push_alerts_sent",
  "push_test_sent",
  "row_delete",
  "column_delete",
  "branch_create",
  "branch_delete",
]

const EVENT_LABELS: Record<string, string> = {
  all: "Tüm olaylar",
  login: "Giriş",
  failed_login: "Hatalı giriş",
  password_reset_request: "Şifre sıfırlama isteği",
  password_change: "Şifre değişimi",
  user_create: "Kullanıcı oluşturma",
  user_update: "Kullanıcı güncelleme",
  user_delete: "Kullanıcı silme",
  terminal_device_approved: "Terminal onayı",
  terminal_device_revoked: "Terminal iptali",
  backup_export: "Yedek indirme",
  backup_restore: "Yedek geri yükleme",
  digest_settings_update: "Rapor ayarı",
  admin_digest_sent: "Otomatik rapor",
  admin_digest_test_sent: "Rapor testi",
  attendance_push_alerts_sent: "Mesai push uyarıları",
  push_test_sent: "Push testi",
  row_delete: "Satır silme",
  column_delete: "Sütun silme",
  branch_create: "Şube oluşturma",
  branch_delete: "Şube silme",
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function eventLabel(value: string) {
  return EVENT_LABELS[value] || value
}

function summarizeDetails(details: Record<string, unknown> | null) {
  if (!details) return "-"
  const text = JSON.stringify(details)
  return text.length > 160 ? `${text.slice(0, 160)}...` : text
}

export default function GelismisLogPage() {
  const { isAdmin, loading: subeLoading } = useSube()
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [eventType, setEventType] = useState("all")
  const [query, setQuery] = useState("")
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())

  useEffect(() => {
    if (!subeLoading && isAdmin) loadEvents(1)
    if (!subeLoading && !isAdmin) setLoading(false)
  }, [subeLoading, isAdmin, eventType, from, to])

  async function loadEvents(nextPage = page) {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(nextPage),
      limit: "100",
      eventType,
      from,
      to,
    })
    if (query.trim()) params.set("query", query.trim())

    const response = await fetch(`/api/security-events?${params.toString()}`, { cache: "no-store" })
    const data = await response.json().catch(() => null)
    setLoading(false)

    if (!response.ok || !data) {
      toast.error(data?.error || "Gelişmiş log kayıtları yüklenemedi.")
      return
    }

    setPayload(data)
    setPage(nextPage)
  }

  const events = payload?.events || []
  const metrics = useMemo(() => {
    const suspicious = events.filter((event) => event.ip_address && event.is_trusted_ip === false).length
    const failed = events.filter((event) => event.event_type === "failed_login").length
    const admins = events.filter((event) => event.event_type.includes("admin") || event.event_type.includes("backup")).length
    return [
      { label: "Kayıt", value: String(payload?.total || events.length) },
      { label: "Hatalı giriş", value: String(failed) },
      { label: "IP uyarısı", value: String(suspicious) },
      { label: "Yönetim olayı", value: String(admins) },
    ]
  }, [events, payload?.total])

  function exportPdf() {
    openPdfReport({
      title: "Gelişmiş Log Raporu",
      subtitle: `${from} - ${to} aralığı`,
      orientation: "landscape",
      metrics,
      tables: [
        {
          title: "Denetim kayıtları",
          headers: ["Tarih", "Olay", "Kullanıcı", "Şube", "IP", "Güven", "Detay"],
          rows: events.map((event) => [
            formatDate(event.created_at),
            eventLabel(event.event_type),
            event.user_display_name || event.user_email || "-",
            event.branch_name || "-",
            event.ip_address || "-",
            event.is_trusted_ip ? "Güvenilir" : event.ip_address ? "Kontrol" : "-",
            summarizeDetails(event.details),
          ]),
        },
      ],
    })
  }

  if (!subeLoading && !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Bu sayfa yalnızca yöneticiler tarafından görüntülenebilir.</div>
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-normal">
            <FileSearch className="h-6 w-6 text-rose-500" />
            Gelişmiş Log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kim, ne zaman, hangi cihazdan işlem yaptı detaylı olarak burada izlenir.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => loadEvents(1)} disabled={loading} variant="outline" className="gap-2">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Yenile
          </Button>
          <Button onClick={exportPdf} className="gap-2">
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Başlangıç</span>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Bitiş</span>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Olay tipi</span>
            <select
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{eventLabel(type)}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Arama</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadEvents(1)} className="pl-9" placeholder="E-posta, IP veya olay" />
            </div>
          </label>
          <div className="flex items-end">
            <Button onClick={() => loadEvents(1)} disabled={loading} className="w-full">Uygula</Button>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Denetim Kayıtları</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[1060px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="p-3">Tarih</th>
                  <th className="p-3">Olay</th>
                  <th className="p-3">Kullanıcı</th>
                  <th className="p-3">Şube</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Cihaz</th>
                  <th className="p-3">Detay</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-t align-top">
                    <td className="whitespace-nowrap p-3">{formatDate(event.created_at)}</td>
                    <td className="p-3">
                      <Badge variant="outline">{eventLabel(event.event_type)}</Badge>
                    </td>
                    <td className="p-3">
                      <p className="font-semibold">{event.user_display_name || event.user_email || "-"}</p>
                      {event.user_email ? <p className="text-xs text-muted-foreground">{event.user_email}</p> : null}
                    </td>
                    <td className="p-3">{event.branch_name || "-"}</td>
                    <td className="p-3">
                      <p>{event.ip_address || "-"}</p>
                      {event.ip_address ? (
                        <Badge className={event.is_trusted_ip ? "mt-1 bg-emerald-600" : "mt-1 bg-amber-500 text-amber-950"}>
                          {event.is_trusted_ip ? "Güvenilir" : "Kontrol et"}
                        </Badge>
                      ) : null}
                    </td>
                    <td className="max-w-[220px] p-3 text-xs text-muted-foreground">
                      <span className="line-clamp-3">{event.user_agent || "-"}</span>
                    </td>
                    <td className="max-w-[360px] p-3 text-xs text-muted-foreground">
                      <span className="line-clamp-4">{summarizeDetails(event.details)}</span>
                    </td>
                  </tr>
                ))}
                {!events.length ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">Kayıt bulunamadı.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Sayfa {payload?.page || 1} / {payload?.totalPages || 1}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1 || loading} onClick={() => loadEvents(page - 1)}>Önceki</Button>
              <Button variant="outline" disabled={!payload?.hasMore || loading} onClick={() => loadEvents(page + 1)}>Sonraki</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
