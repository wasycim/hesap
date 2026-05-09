"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Code2, Columns3, KeyRound, Monitor, Shield, Trash2, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface SecurityEvent {
  id: string
  user_display_name?: string | null
  branch_name?: string | null
  user_email: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  details: Record<string, any>
  created_at: string
}

type Severity = "normal" | "medium" | "warning" | "critical"
type EventFilter = "all" | "login" | "different_login" | "delete" | "hide"
type SeverityFilter = "all" | Severity

const EVENT_LABELS: Record<string, string> = {
  failed_login: "Hatalı giriş",
  login: "Giriş",
  row_delete: "Satır silme",
  column_delete: "Sütun silme",
  column_hide: "Sütun gizleme",
  person_delete: "Personel silme",
  kargo_cari_delete: "Kargo cari silme",
  ortak_delete: "Ortak silme",
  password_change: "Şifre değişikliği",
  user_create: "Kullanıcı oluşturma",
  user_update: "Kullanıcı güncelleme",
  user_delete: "Kullanıcı silme",
  branch_create: "Şube ekleme",
  branch_delete: "Şube silme",
  branch_delete_failed: "Şube silme hatası",
  visibility_update: "Görünüm ayarı",
}

const EVENT_ICONS: Record<string, any> = {
  failed_login: AlertTriangle,
  login: Monitor,
  row_delete: Trash2,
  column_delete: Columns3,
  column_hide: Columns3,
  person_delete: Trash2,
  kargo_cari_delete: Trash2,
  ortak_delete: Trash2,
  password_change: KeyRound,
  user_create: UserPlus,
  user_update: UserPlus,
  user_delete: UserPlus,
  branch_delete_failed: AlertTriangle,
}

const SEVERITY_STYLES: Record<Severity, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-100",
  medium: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-100",
  warning: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/15 dark:text-orange-100",
  critical: "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-100",
}

const EVENT_FILTERS: Array<{ key: EventFilter; label: string }> = [
  { key: "all", label: "Tümü" },
  { key: "login", label: "Girişler" },
  { key: "different_login", label: "Farklı Girişler" },
  { key: "delete", label: "Silme İşlemleri" },
  { key: "hide", label: "Gizleme İşlemleri" },
]

const SEVERITY_FILTERS: Array<{ key: SeverityFilter; label: string }> = [
  { key: "all", label: "Tüm Dereceler" },
  { key: "critical", label: "Yüksek" },
  { key: "warning", label: "Orta" },
  { key: "medium", label: "Düşük" },
  { key: "normal", label: "Normal" },
]

function formatDate(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getUserKey(event: SecurityEvent) {
  return event.user_email || event.details?.email || event.user_agent || "unknown"
}

function getUserDisplay(event: SecurityEvent) {
  return event.user_display_name || event.details?.display_name || event.user_email || event.details?.email || "-"
}

function getBranchDisplay(event: SecurityEvent) {
  return event.branch_name || event.details?.sube_ad || event.details?.branch_name || "-"
}

function buildPasswordChangeCounts(events: SecurityEvent[]) {
  const chronological = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const counts = new Map<string, number>()
  const eventCounts = new Map<string, number>()

  chronological.forEach(event => {
    if (event.event_type !== "password_change") return
    const key = getUserKey(event)
    const nextCount = (counts.get(key) || 0) + 1
    counts.set(key, nextCount)
    eventCounts.set(event.id, nextCount)
  })

  return eventCounts
}

function buildTrustedLoginIps(events: SecurityEvent[]) {
  const chronological = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const ipRanges = new Map<string, Map<string, { first: number; last: number }>>()

  chronological.forEach(event => {
    if (event.event_type !== "login" || !event.ip_address) return
    const key = getUserKey(event)
    const userIps = ipRanges.get(key) || new Map<string, { first: number; last: number }>()
    const time = new Date(event.created_at).getTime()
    const range = userIps.get(event.ip_address)
    if (range) {
      range.last = time
    } else {
      userIps.set(event.ip_address, { first: time, last: time })
    }
    ipRanges.set(key, userIps)
  })

  const trusted = new Map<string, Set<string>>()
  const threeDays = 3 * 24 * 60 * 60 * 1000

  ipRanges.forEach((ips, userKey) => {
    ips.forEach((range, ip) => {
      if (range.last - range.first >= threeDays) {
        const trustedIps = trusted.get(userKey) || new Set<string>()
        trustedIps.add(ip)
        trusted.set(userKey, trustedIps)
      }
    })
  })

  return trusted
}

function buildDifferentLoginIpEvents(events: SecurityEvent[]) {
  const differentIpEvents = new Set<string>()
  const ipsByUser = new Map<string, Set<string>>()

  events.forEach(event => {
    if (event.event_type !== "login" || !event.ip_address) return
    const userKey = getUserKey(event)
    const ips = ipsByUser.get(userKey) || new Set<string>()
    ips.add(event.ip_address)
    ipsByUser.set(userKey, ips)
  })

  events.forEach(event => {
    if (event.event_type !== "login" || !event.ip_address) return
    if ((ipsByUser.get(getUserKey(event))?.size || 0) > 1) differentIpEvents.add(event.id)
  })

  return differentIpEvents
}

function buildSharedLoginIpEvents(events: SecurityEvent[]) {
  const chronological = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const usersByIp = new Map<string, Set<string>>()
  const sharedIpEvents = new Set<string>()

  chronological.forEach(event => {
    if (event.event_type !== "login" || !event.ip_address) return
    const userKey = getUserKey(event)
    const users = usersByIp.get(event.ip_address) || new Set<string>()
    if (users.size > 0 && !users.has(userKey)) {
      sharedIpEvents.add(event.id)
    }
    users.add(userKey)
    usersByIp.set(event.ip_address, users)
  })

  return sharedIpEvents
}

function getSeverity(event: SecurityEvent, passwordChangeCount: number, isDifferentIp: boolean, isSharedIp: boolean): Severity {
  if (event.event_type === "failed_login") return "warning"
  if (isDifferentIp) return "critical"
  if (isSharedIp) return "medium"
  if (event.event_type === "branch_delete_failed") return "critical"
  if (event.event_type.endsWith("_delete")) return "critical"
  if (event.event_type === "user_create" && event.details?.is_admin) return "critical"
  if (event.event_type === "user_update" && event.details?.is_admin) return "critical"
  if (event.event_type === "column_hide") return "warning"
  if (event.event_type === "visibility_update") return "warning"
  if (event.event_type === "password_change") {
    if (passwordChangeCount >= 3) return "critical"
    if (passwordChangeCount === 2) return "warning"
    return "normal"
  }
  return "normal"
}

function getSummary(event: SecurityEvent, passwordChangeCount: number, isDifferentIp: boolean, isSharedIp: boolean) {
  const details = event.details || {}
  const label = details.label || details.ad || details.name
  if (event.event_type === "failed_login") return `${details.email || event.user_email || "Bilinmeyen kullanıcı"} için hatalı şifre denemesi yapıldı.`

  if (event.event_type === "column_hide") return `${label || "Bir sütun"} gizlendi.`
  if (event.event_type === "column_delete") return `${label || "Bir sütun"} sütunu silindi.`
  if (event.event_type === "row_delete") return `${details.table || "Tablo"} satırı silindi${details.tarih ? ` (${details.tarih})` : ""}.`
  if (event.event_type === "person_delete") return `${label || "Personel"} personeli silindi.`
  if (event.event_type === "kargo_cari_delete") return `${label || "Kargo cari firması"} silindi.`
  if (event.event_type === "ortak_delete") return `${label || "Ortak"} silindi.`
  if (event.event_type === "password_change") return `Şifre ${passwordChangeCount}. kez değiştirildi.`
  if (event.event_type === "login" && isDifferentIp) return `Kullanıcı farklı bir IP adresinden giriş yaptı: ${event.ip_address || "-"}`
  if (event.event_type === "login" && isSharedIp) return `Aynı IP adresinden farklı bir hesaba giriş yapıldı: ${event.ip_address || "-"}`
  if (event.event_type === "login") return `Kullanıcı giriş yaptı.`
  if (event.event_type === "user_create" && details.is_admin) return `${details.created_email || "Kullanıcı"} yönetici hesabı olarak oluşturuldu.`
  if (event.event_type === "user_create") return `${details.created_email || "Kullanıcı"} oluşturuldu.`
  if (event.event_type === "user_update" && details.is_admin) return `Kullanıcı yönetici yetkisine geçirildi.`
  if (event.event_type === "user_update") return `Kullanıcı yetki/şube/vardiya bilgileri güncellendi.`
  if (event.event_type === "user_delete") return `${details.deleted_email || "Kullanıcı"} silindi.`
  if (event.event_type === "branch_create") return `${label || "Şube"} şubesi eklendi.`
  if (event.event_type === "branch_delete") return `${label || "Şube"} şubesi silindi.`
  if (event.event_type === "branch_delete_failed") return `${label || "Şube"} şubesi silinemedi: ${details.reason || "hata oluştu."}`
  if (event.event_type === "visibility_update") return `Şube görünüm ayarları güncellendi.`
  return EVENT_LABELS[event.event_type] || event.event_type
}

export default function GuvenlikAyarlarPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [eventFilter, setEventFilter] = useState<EventFilter>("all")
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  const passwordChangeCounts = useMemo(() => buildPasswordChangeCounts(events), [events])
  const differentIpEvents = useMemo(() => buildDifferentLoginIpEvents(events), [events])
  const sharedIpEvents = useMemo(() => buildSharedLoginIpEvents(events), [events])
  const eventsWithSeverity = useMemo(() => events.map(event => {
    const passwordCount = passwordChangeCounts.get(event.id) || 0
    const isDifferentIp = differentIpEvents.has(event.id)
    const isSharedIp = sharedIpEvents.has(event.id)
    const severity = getSeverity(event, passwordCount, isDifferentIp, isSharedIp)

    return { event, passwordCount, isDifferentIp, isSharedIp, severity }
  }), [events, passwordChangeCounts, differentIpEvents, sharedIpEvents])
  const branchOptions = useMemo(() => (
    Array.from(new Set(events.map(getBranchDisplay).filter(branch => branch !== "-"))).sort((a, b) => a.localeCompare(b, "tr"))
  ), [events])

  const filteredEvents = useMemo(() => eventsWithSeverity.filter(item => {
    if (branchFilter !== "all" && getBranchDisplay(item.event) !== branchFilter) return false
    if (severityFilter !== "all" && item.severity !== severityFilter) return false
    if (eventFilter === "login") return item.event.event_type === "login" || item.event.event_type === "failed_login"
    if (eventFilter === "different_login") return item.event.event_type === "login" && item.isDifferentIp
    if (eventFilter === "delete") return item.event.event_type.endsWith("_delete") || item.event.event_type === "branch_delete_failed"
    if (eventFilter === "hide") return item.event.event_type === "column_hide" || item.event.event_type === "visibility_update"
    return true
  }), [eventsWithSeverity, eventFilter, severityFilter, branchFilter])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(Boolean(profile?.is_admin))
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }

    const response = await fetch("/api/security-events")
    const result = await response.json()
    setEvents(result.events || [])
    setLoading(false)
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Erişim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  const loginEvents = events.filter(event => event.event_type === "login")
  const passwordEvents = events.filter(event => event.event_type === "password_change")

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Güvenlik Ayarları</h1>
        <p className="text-sm text-muted-foreground">Girişler, silme işlemleri ve hesap güvenliği kayıtları.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Shield className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Toplam kayıt</p>
              <p className="text-2xl font-bold">{events.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <Monitor className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-muted-foreground">Giriş kaydı</p>
              <p className="text-2xl font-bold">{loginEvents.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-5">
            <KeyRound className="h-8 w-8 text-amber-600" />
            <div>
              <p className="text-sm text-muted-foreground">Şifre değişimi</p>
              <p className="text-2xl font-bold">{passwordEvents.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>İşlem Kayıtları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap gap-2">
              {EVENT_FILTERS.map(filter => (
                <Button
                  key={filter.key}
                  type="button"
                  size="sm"
                  variant={eventFilter === filter.key ? "default" : "outline"}
                  onClick={() => setEventFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_FILTERS.map(filter => (
                <Button
                  key={filter.key}
                  type="button"
                  size="sm"
                  variant={severityFilter === filter.key ? "default" : "outline"}
                  onClick={() => setSeverityFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{filteredEvents.length} kayıt gösteriliyor.</p>
          </div>
            <div className="max-w-xs">
              <Select value={branchFilter} onValueChange={setBranchFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Şube seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Şubeler</SelectItem>
                  {branchOptions.map(branch => (
                    <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <div className="mobile-scroll overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[1080px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">İşlem</th>
                  <th className="p-3 text-left">Kullanıcı</th>
                  <th className="p-3 text-left">IP Adresi</th>
                  <th className="p-3 text-left">Zaman</th>
                  <th className="p-3 text-left">Açıklama</th>
                  <th className="p-3 text-left">Şube</th>
                  <th className="p-3 text-center">Detay</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(({ event, passwordCount, isDifferentIp, isSharedIp, severity }) => {
                  const Icon = EVENT_ICONS[event.event_type] || Shield
                  const detailsOpen = Boolean(openDetails[event.id])

                  return (
                    <tr key={event.id} className={cn("border-b align-top", SEVERITY_STYLES[severity])}>
                      <td className="p-3">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4" />
                          {EVENT_LABELS[event.event_type] || event.event_type}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{getUserDisplay(event)}</div>
                        {event.user_display_name && event.user_email && (
                          <div className="text-xs opacity-70">{event.user_email}</div>
                        )}
                      </td>
                      <td className="p-3">{event.ip_address || "-"}</td>
                      <td className="p-3">{formatDate(event.created_at)}</td>
                      <td className="p-3">
                        <div>{getSummary(event, passwordCount, isDifferentIp, isSharedIp)}</div>
                        {detailsOpen && (
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded border bg-white/70 p-2 text-xs text-slate-800 dark:bg-black/30 dark:text-slate-100">
                            {JSON.stringify(event.details || {}, null, 2)}
                          </pre>
                        )}
                      </td>
                      <td className="p-3 font-medium">{getBranchDisplay(event)}</td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setOpenDetails(prev => ({ ...prev, [event.id]: !prev[event.id] }))}
                          title="Ham detayı göster"
                        >
                          <Code2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {filteredEvents.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">Bu filtrede güvenlik kaydı yok.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
