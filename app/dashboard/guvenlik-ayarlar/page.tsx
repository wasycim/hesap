"use client"

import { useEffect, useMemo, useState } from "react"
import { Code2, Columns3, KeyRound, Monitor, Shield, Trash2, UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface SecurityEvent {
  id: string
  user_email: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  details: Record<string, any>
  created_at: string
}

type Severity = "normal" | "medium" | "warning" | "critical"

const EVENT_LABELS: Record<string, string> = {
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
  branch_create: "Şube ekleme",
  branch_delete: "Şube silme",
  visibility_update: "Görünüm ayarı",
}

const EVENT_ICONS: Record<string, any> = {
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
}

const SEVERITY_STYLES: Record<Severity, string> = {
  normal: "border-emerald-200 bg-emerald-50 text-emerald-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  warning: "border-orange-200 bg-orange-50 text-orange-800",
  critical: "border-red-200 bg-red-50 text-red-800",
}

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

function buildKnownLoginIps(events: SecurityEvent[]) {
  const chronological = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const seen = new Map<string, Set<string>>()
  const differentIpEvents = new Set<string>()

  chronological.forEach(event => {
    if (event.event_type !== "login" || !event.ip_address) return
    const key = getUserKey(event)
    const userIps = seen.get(key) || new Set<string>()
    if (userIps.size > 0 && !userIps.has(event.ip_address)) {
      differentIpEvents.add(event.id)
    }
    userIps.add(event.ip_address)
    seen.set(key, userIps)
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
  if (isDifferentIp) return "critical"
  if (isSharedIp) return "medium"
  if (["row_delete", "column_delete", "person_delete", "kargo_cari_delete"].includes(event.event_type)) return "critical"
  if (event.event_type === "column_hide") return "medium"
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
  if (event.event_type === "user_create") return `${details.created_email || "Kullanıcı"} oluşturuldu.`
  if (event.event_type === "user_update") return `Kullanıcı yetki/şube/vardiya bilgileri güncellendi.`
  if (event.event_type === "branch_create") return `${label || "Şube"} şubesi eklendi.`
  if (event.event_type === "branch_delete") return `${label || "Şube"} şubesi silindi.`
  if (event.event_type === "visibility_update") return `Şube görünüm ayarları güncellendi.`
  return EVENT_LABELS[event.event_type] || event.event_type
}

export default function GuvenlikAyarlarPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [openDetails, setOpenDetails] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  const passwordChangeCounts = useMemo(() => buildPasswordChangeCounts(events), [events])
  const differentIpEvents = useMemo(() => buildKnownLoginIps(events), [events])
  const sharedIpEvents = useMemo(() => buildSharedLoginIpEvents(events), [events])

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
    <div className="space-y-6 p-6 lg:p-8">
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
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">İşlem</th>
                  <th className="p-3 text-left">Kullanıcı</th>
                  <th className="p-3 text-left">IP Adresi</th>
                  <th className="p-3 text-left">Zaman</th>
                  <th className="p-3 text-left">Açıklama</th>
                  <th className="p-3 text-center">Detay</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => {
                  const Icon = EVENT_ICONS[event.event_type] || Shield
                  const passwordCount = passwordChangeCounts.get(event.id) || 0
                  const isDifferentIp = differentIpEvents.has(event.id)
                  const isSharedIp = sharedIpEvents.has(event.id)
                  const severity = getSeverity(event, passwordCount, isDifferentIp, isSharedIp)
                  const detailsOpen = Boolean(openDetails[event.id])

                  return (
                    <tr key={event.id} className={cn("border-b align-top", SEVERITY_STYLES[severity])}>
                      <td className="p-3">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4" />
                          {EVENT_LABELS[event.event_type] || event.event_type}
                        </div>
                      </td>
                      <td className="p-3">{event.user_email || "-"}</td>
                      <td className="p-3">{event.ip_address || "-"}</td>
                      <td className="p-3">{formatDate(event.created_at)}</td>
                      <td className="p-3">
                        <div>{getSummary(event, passwordCount, isDifferentIp, isSharedIp)}</div>
                        {detailsOpen && (
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded border bg-white/70 p-2 text-xs text-slate-800">
                            {JSON.stringify(event.details || {}, null, 2)}
                          </pre>
                        )}
                      </td>
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
                {events.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">Henüz güvenlik kaydı yok.</td>
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
