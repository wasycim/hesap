"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Activity, BellRing, CheckCircle2, Download, Mail, RefreshCw, Send, ShieldCheck, SlidersHorizontal, Smartphone, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useSube } from "@/contexts/sube-context"

type HealthPayload = {
  checkedAt: string
  overall: "operational" | "degraded" | "down"
  components: Array<{ name: string; status: "operational" | "degraded" | "down"; message: string }>
  latestEvents: SecurityEvent[]
  resetEvents: SecurityEvent[]
  pendingDevices: TerminalDevice[]
  pushSummary?: {
    provider: string
    configured: boolean
    missing: string[]
    registeredDevices: number
    latestDeliveries: Array<{
      id: string
      status: "sent" | "failed" | "skipped"
      title: string | null
      error: string | null
      created_at: string
    }>
    latestDevices: Array<{
      id: string
      user_id: string
      device_id: string | null
      platform: string | null
      enabled: boolean
      has_push_token: boolean
      last_seen_at: string | null
      updated_at: string | null
      created_at: string
    }>
  }
  digestSummary?: {
    configured: boolean
    latestEvents: SecurityEvent[]
  }
}

type TerminalDevice = {
  id: string
  device_key: string
  label: string
  approved: boolean
  last_seen_at: string | null
  last_ip: string | null
  user_agent: string | null
  created_at: string
}

type SecurityEvent = {
  id: string
  user_email: string | null
  event_type: string
  details: Record<string, unknown> | null
  created_at: string
}

type DigestUser = {
  user_id: string
  email: string
  display_name: string | null
  daily_enabled: boolean
  weekly_enabled: boolean
}

type NotificationUser = {
  user_id: string
  email: string | null
  display_name: string | null
  sube_id: string | null
  branch_name: string | null
  is_admin: boolean
  dashboard_access: boolean
}

type NotificationHistory = {
  id: string
  target_name: string
  branch_name: string | null
  title: string
  level: string
  read_at: string | null
  push_status: string | null
  push_error: string | null
  created_at: string
}

type AttendanceRule = {
  sube_id: string
  sube_ad: string
  sube_kod: string
  active: boolean
  late_enabled: boolean
  late_threshold_minutes: number
  overtime_enabled: boolean
  overtime_threshold_minutes: number
  send_to_personnel: boolean
  send_to_admins: boolean
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
}

export default function SistemSagligiPage() {
  const { isAdmin, loading: subeLoading } = useSube()
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [devices, setDevices] = useState<TerminalDevice[]>([])
  const [digestUsers, setDigestUsers] = useState<DigestUser[]>([])
  const [loading, setLoading] = useState(true)
  const [backupBusy, setBackupBusy] = useState(false)
  const [testBusy, setTestBusy] = useState<"push" | "digest" | null>(null)
  const [notificationUsers, setNotificationUsers] = useState<NotificationUser[]>([])
  const [notificationBranches, setNotificationBranches] = useState<Array<{ id: string; ad: string; kod: string }>>([])
  const [notificationHistory, setNotificationHistory] = useState<NotificationHistory[]>([])
  const [attendanceRules, setAttendanceRules] = useState<AttendanceRule[]>([])
  const [manualTargetType, setManualTargetType] = useState("admins")
  const [manualTargetUserId, setManualTargetUserId] = useState("")
  const [manualTargetSubeId, setManualTargetSubeId] = useState("")
  const [manualTitle, setManualTitle] = useState("Hesap bildirimi")
  const [manualBody, setManualBody] = useState("")
  const [manualHref, setManualHref] = useState("/dashboard/bildirimler")
  const [manualLevel, setManualLevel] = useState("info")
  const [manualBusy, setManualBusy] = useState(false)
  const [ruleBusy, setRuleBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!subeLoading && isAdmin) loadAll()
    if (!subeLoading && !isAdmin) setLoading(false)
  }, [subeLoading, isAdmin])

  async function loadAll() {
    setLoading(true)
    const [healthRes, devicesRes, digestRes, notificationsRes, rulesRes] = await Promise.all([
      fetch("/api/admin/system-health", { cache: "no-store" }),
      fetch("/api/admin/terminal-devices", { cache: "no-store" }),
      fetch("/api/admin/digest-settings", { cache: "no-store" }),
      fetch("/api/admin/notifications", { cache: "no-store" }),
      fetch("/api/admin/attendance-rules", { cache: "no-store" }),
    ])
    const [healthData, devicesData, digestData, notificationsData, rulesData] = await Promise.all([
      healthRes.json().catch(() => null),
      devicesRes.json().catch(() => null),
      digestRes.json().catch(() => null),
      notificationsRes.json().catch(() => null),
      rulesRes.json().catch(() => null),
    ])
    setHealth(healthRes.ok ? healthData : null)
    setDevices(devicesRes.ok ? devicesData.devices || [] : [])
    setDigestUsers(digestRes.ok ? digestData.users || [] : [])
    setNotificationUsers(notificationsRes.ok ? notificationsData.users || [] : [])
    setNotificationBranches(notificationsRes.ok ? notificationsData.branches || [] : [])
    setNotificationHistory(notificationsRes.ok ? notificationsData.history || [] : [])
    setAttendanceRules(rulesRes.ok ? rulesData.rules || [] : [])
    setLoading(false)
  }

  async function updateDevice(device: TerminalDevice, approved: boolean) {
    const response = await fetch("/api/admin/terminal-devices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: device.id, label: device.label, approved }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      toast.error(result.error || "Terminal cihazı güncellenemedi.")
      return
    }
    toast.success(approved ? "Terminal onaylandı." : "Terminal onayı kaldırıldı.")
    loadAll()
  }

  async function deleteDevice(device: TerminalDevice) {
    const response = await fetch("/api/admin/terminal-devices", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: device.id }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      toast.error(result.error || "Terminal cihazı silinemedi.")
      return
    }
    toast.success("Terminal cihazı silindi.")
    loadAll()
  }

  async function downloadBackup() {
    setBackupBusy(true)
    const response = await fetch("/api/admin/backup", { cache: "no-store" })
    const data = await response.json().catch(() => null)
    setBackupBusy(false)

    if (!response.ok || !data) {
      toast.error(data?.error || "Yedek indirilemedi.")
      return
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `hesap-yedek-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Yedek dosyası indirildi.")
  }

  async function restoreBackup(file: File | null) {
    if (!file) return
    setBackupBusy(true)
    const text = await file.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      setBackupBusy(false)
      toast.error("Yedek dosyası JSON formatında değil.")
      return
    }
    const response = await fetch("/api/admin/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    setBackupBusy(false)

    if (!response.ok) {
      toast.error(result.error || "Yedek geri yüklenemedi.")
      return
    }

    toast.success("Yedek geri yüklendi.")
    loadAll()
  }

  async function saveDigest(user: DigestUser, patch: Partial<DigestUser>) {
    const next = { ...user, ...patch }
    setDigestUsers((items) => items.map((item) => item.user_id === user.user_id ? next : item))
    const response = await fetch("/api/admin/digest-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: next.user_id,
        email: next.email,
        dailyEnabled: next.daily_enabled,
        weeklyEnabled: next.weekly_enabled,
      }),
    })
    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      toast.error(result.error || "Özet mail ayarı kaydedilemedi.")
      loadAll()
      return
    }
    toast.success("Özet mail ayarı kaydedildi.")
  }

  async function sendPushTest() {
    setTestBusy("push")
    const response = await fetch("/api/admin/push-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Hesap push testi",
        body: "Gerçek push bildirim altyapısı test edildi.",
        href: "/dashboard/mesai-takip",
        level: "success",
      }),
    })
    const result = await response.json().catch(() => ({}))
    setTestBusy(null)

    if (response.ok && result.sent > 0) {
      toast.success(`${result.sent} cihaza push gönderildi.`)
      loadAll()
      return
    }

    toast.warning(result.error || "Push testi gönderilemedi. FCM ayarlarını ve cihaz tokenlarını kontrol edin.")
    loadAll()
  }

  async function sendDigestTest() {
    setTestBusy("digest")
    const response = await fetch("/api/admin/digest-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const result = await response.json().catch(() => ({}))
    setTestBusy(null)

    if (response.ok && result.sent) {
      toast.success("Otomatik rapor test maili gönderildi.")
      loadAll()
      return
    }

    toast.warning(result.error || "Rapor mail testi gönderilemedi. SMTP ayarlarını kontrol edin.")
    loadAll()
  }

  async function sendManualNotification() {
    if (!manualTitle.trim() || !manualBody.trim()) {
      toast.error("Bildirim basligi ve mesaji zorunlu.")
      return
    }

    setManualBusy(true)
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: manualTargetType,
        userId: manualTargetUserId,
        subeId: manualTargetSubeId,
        title: manualTitle,
        body: manualBody,
        href: manualHref,
        level: manualLevel,
        sendPush: true,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setManualBusy(false)

    if (!response.ok) {
      toast.error(result.error || "Bildirim gonderilemedi.")
      return
    }

    toast.success(`${result.recipients || 0} kullaniciya bildirim olusturuldu.`)
    setManualBody("")
    loadAll()
  }

  function patchAttendanceRule(subeId: string, patch: Partial<AttendanceRule>) {
    setAttendanceRules((items) => items.map((item) => item.sube_id === subeId ? { ...item, ...patch } : item))
  }

  async function saveAttendanceRule(rule: AttendanceRule) {
    setRuleBusy(rule.sube_id)
    const response = await fetch("/api/admin/attendance-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subeId: rule.sube_id,
        active: rule.active,
        lateEnabled: rule.late_enabled,
        lateThresholdMinutes: rule.late_threshold_minutes,
        overtimeEnabled: rule.overtime_enabled,
        overtimeThresholdMinutes: rule.overtime_threshold_minutes,
        sendToPersonnel: rule.send_to_personnel,
        sendToAdmins: rule.send_to_admins,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setRuleBusy(null)

    if (!response.ok) {
      toast.error(result.error || "Uyari kurali kaydedilemedi.")
      loadAll()
      return
    }

    toast.success(`${rule.sube_ad} uyari kurali kaydedildi.`)
    loadAll()
  }

  const approvedDevices = useMemo(() => devices.filter((device) => device.approved), [devices])
  const pendingDevices = useMemo(() => devices.filter((device) => !device.approved), [devices])

  if (!subeLoading && !isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Bu sayfa yalnızca yöneticiler tarafından görüntülenebilir.</div>
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Sistem Sağlığı</h1>
          <p className="mt-1 text-sm text-muted-foreground">Cihaz eşleştirme, yedekleme, bildirim ve kritik kontroller.</p>
        </div>
        <Button onClick={loadAll} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Yenile
        </Button>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Canlı Durum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(health?.components || []).map((component) => (
              <div key={component.name} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{component.name}</p>
                  <p className="text-xs text-muted-foreground">{component.message}</p>
                </div>
                <Badge className={
                  component.status === "operational"
                    ? "bg-emerald-600"
                    : component.status === "degraded"
                      ? "bg-amber-500 text-amber-950"
                      : "bg-red-600"
                }>
                  {component.status === "operational" ? "Çalışıyor" : component.status === "degraded" ? "Eksik ayar" : "Sorun var"}
                </Badge>
              </div>
            ))}
            <a className="text-sm font-semibold text-emerald-600 hover:underline" href="/status" target="_blank">Public status sayfasını aç</a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Şifre Sıfırlama Geçmişi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(health?.resetEvents || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt yok.</p>
            ) : health?.resetEvents.map((event) => (
              <div key={event.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{event.user_email || "E-posta yok"}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(event.created_at)}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Durum: {String(event.details?.status || "-")} · TC: {String(event.details?.tc_kimlik || "-")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Push Bildirim Testi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Kendi hesabına kayıtlı mobil cihaza gerçek FCM push bildirimi gönderir. FCM ayarları eksikse test sonucu panelde açıkça görünür.
            </p>
            <div className="grid gap-2 rounded-xl border p-3 text-sm sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Sağlayıcı</p>
                <p className="font-semibold uppercase">{health?.pushSummary?.provider || "fcm"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kayıtlı cihaz</p>
                <p className="font-semibold">{health?.pushSummary?.registeredDevices ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Durum</p>
                <p className="font-semibold">{health?.pushSummary?.configured ? "Hazır" : "Eksik ayar"}</p>
              </div>
            </div>
            <Button onClick={sendPushTest} disabled={testBusy === "push"} className="gap-2">
              <Send className={testBusy === "push" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              Test push gönder
            </Button>
            {(health?.pushSummary?.latestDevices || []).length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone className="h-4 w-4" /> Son kayitli cihazlar</p>
                {(health?.pushSummary?.latestDevices || []).slice(0, 5).map((device) => (
                  <div key={device.id} className="grid gap-2 rounded-lg border p-3 text-xs sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{device.platform || "bilinmeyen"} / {device.device_id || "cihaz id yok"}</p>
                      <p className="text-muted-foreground">Son gorulme: {formatDate(device.last_seen_at || device.updated_at || device.created_at)}</p>
                    </div>
                    <Badge variant={device.enabled ? "default" : "secondary"}>{device.enabled ? "Aktif" : "Kapali"}</Badge>
                    <Badge variant={device.has_push_token ? "default" : "destructive"}>{device.has_push_token ? "Token var" : "Token yok"}</Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Otomatik Rapor Testi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Günlük/haftalık yönetici özet mail altyapısını aynı SMTP ayarlarıyla test eder.
            </p>
            <div className="rounded-xl border p-3 text-sm">
              <p className="text-xs text-muted-foreground">SMTP durumu</p>
              <p className="font-semibold">{health?.digestSummary?.configured ? "Hazır" : "SMTP ayarları eksik"}</p>
            </div>
            <Button onClick={sendDigestTest} disabled={testBusy === "digest"} variant="outline" className="gap-2">
              <Mail className={testBusy === "digest" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              Test rapor maili gönder
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Manuel Bildirim Gönder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Hedef</span>
                <Select value={manualTargetType} onValueChange={setManualTargetType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admins">Yöneticiler</SelectItem>
                    <SelectItem value="branch">Şube</SelectItem>
                    <SelectItem value="user">Tek kullanıcı</SelectItem>
                    <SelectItem value="all">Tüm kullanıcılar</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {manualTargetType === "user" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Kullanıcı</span>
                  <Select value={manualTargetUserId} onValueChange={setManualTargetUserId}>
                    <SelectTrigger><SelectValue placeholder="Kullanıcı seç" /></SelectTrigger>
                    <SelectContent>
                      {notificationUsers.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>{user.display_name || user.email || user.user_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              {manualTargetType === "branch" ? (
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium">Şube</span>
                  <Select value={manualTargetSubeId} onValueChange={setManualTargetSubeId}>
                    <SelectTrigger><SelectValue placeholder="Şube seç" /></SelectTrigger>
                    <SelectContent>
                      {notificationBranches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.ad}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              ) : null}
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Seviye</span>
                <Select value={manualLevel} onValueChange={setManualLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Bilgi</SelectItem>
                    <SelectItem value="success">Başarılı</SelectItem>
                    <SelectItem value="warning">Uyarı</SelectItem>
                    <SelectItem value="error">Kritik</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="grid gap-1.5 text-sm">
                <span className="font-medium">Link</span>
                <Input value={manualHref} onChange={(event) => setManualHref(event.target.value)} />
              </label>
            </div>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Başlık</span>
              <Input value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium">Mesaj</span>
              <Textarea value={manualBody} onChange={(event) => setManualBody(event.target.value)} rows={4} placeholder="Gönderilecek bildirimi yaz..." />
            </label>
            <Button onClick={sendManualNotification} disabled={manualBusy} className="gap-2">
              <Send className={manualBusy ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              Bildirim gönder
            </Button>
            <div className="space-y-2 pt-2">
              <p className="text-sm font-semibold">Son bildirimler</p>
              {notificationHistory.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <Badge variant={item.read_at ? "secondary" : "default"}>{item.read_at ? "Okundu" : "Yeni"}</Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{item.target_name} / {item.push_status || "pending"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Şube Bazlı Mesai Uyarı Kuralları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Geç kalma ve fazla mesai push uyarıları şube bazlı eşiklerle çalışır. Fazla mesai varsayılan 45 dk ve üzeri için bildirilir.</p>
            {attendanceRules.map((rule) => (
              <div key={rule.sube_id} className="rounded-xl border p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{rule.sube_ad}</p>
                    <p className="text-xs text-muted-foreground">Kod: {rule.sube_kod || "-"}</p>
                  </div>
                  <Switch checked={rule.active} onCheckedChange={(checked) => patchAttendanceRule(rule.sube_id, { active: checked })} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    Geç kalma eşiği (dk)
                    <Input type="number" min={0} value={rule.late_threshold_minutes} onChange={(event) => patchAttendanceRule(rule.sube_id, { late_threshold_minutes: Number(event.target.value) || 0 })} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                    Fazla mesai eşiği (dk)
                    <Input type="number" min={0} value={rule.overtime_threshold_minutes} onChange={(event) => patchAttendanceRule(rule.sube_id, { overtime_threshold_minutes: Number(event.target.value) || 0 })} />
                  </label>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2">Geç uyarısı <Switch checked={rule.late_enabled} onCheckedChange={(checked) => patchAttendanceRule(rule.sube_id, { late_enabled: checked })} /></label>
                  <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2">Fazla mesai <Switch checked={rule.overtime_enabled} onCheckedChange={(checked) => patchAttendanceRule(rule.sube_id, { overtime_enabled: checked })} /></label>
                  <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2">Personele gönder <Switch checked={rule.send_to_personnel} onCheckedChange={(checked) => patchAttendanceRule(rule.sube_id, { send_to_personnel: checked })} /></label>
                  <label className="flex items-center justify-between gap-2 rounded-lg bg-muted/45 px-3 py-2">Yöneticilere de gönder <Switch checked={rule.send_to_admins} onCheckedChange={(checked) => patchAttendanceRule(rule.sube_id, { send_to_admins: checked })} /></label>
                </div>
                <Button size="sm" variant="outline" className="mt-3" disabled={ruleBusy === rule.sube_id} onClick={() => saveAttendanceRule(rule)}>
                  {ruleBusy === rule.sube_id ? "Kaydediliyor" : "Kural kaydet"}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Terminal Cihazları</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              /terminal sayfası yalnızca burada onaylanan cihazlarda QR üretir. Bekleyen cihazlar ilk açılışta otomatik oluşur.
            </p>
            {[...pendingDevices, ...approvedDevices].map((device) => (
              <div key={device.id} className="rounded-xl border p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{device.label}</p>
                    <p className="text-xs text-muted-foreground">{device.device_key.slice(0, 12)}... · {device.last_ip || "IP yok"}</p>
                    <p className="text-xs text-muted-foreground">Son görülme: {formatDate(device.last_seen_at || device.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={device.approved ? "secondary" : "default"} onClick={() => updateDevice(device, !device.approved)}>
                      {device.approved ? "Onayı kaldır" : "Onayla"}
                    </Button>
                    <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteDevice(device)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {devices.length === 0 ? <p className="text-sm text-muted-foreground">Henüz terminal cihazı yok.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Yedekleme ve Geri Yükleme</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Şube, personel, vardiya, terminal ve yönetim ayarlarını JSON olarak indirir. Geri yükleme mevcut kayıtları silmez, aynı ID'li kayıtları günceller.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={downloadBackup} disabled={backupBusy} className="gap-2">
                <Download className="h-4 w-4" />
                Yedek indir
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 text-sm font-medium hover:bg-muted">
                <Upload className="h-4 w-4" />
                Geri yükle
                <input type="file" accept="application/json" className="hidden" onChange={(event) => restoreBackup(event.target.files?.[0] || null)} />
              </label>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Yönetici Özet Mailleri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="p-3">Yönetici</th>
                  <th className="p-3">E-posta</th>
                  <th className="p-3">Günlük</th>
                  <th className="p-3">Haftalık</th>
                  <th className="p-3">Kaydet</th>
                </tr>
              </thead>
              <tbody>
                {digestUsers.map((user) => (
                  <tr key={user.user_id} className="border-t">
                    <td className="p-3 font-semibold">{user.display_name || user.email || user.user_id}</td>
                    <td className="p-3">
                      <Input
                        value={user.email}
                        onChange={(event) => setDigestUsers((items) => items.map((item) => item.user_id === user.user_id ? { ...item, email: event.target.value } : item))}
                      />
                    </td>
                    <td className="p-3"><Switch checked={user.daily_enabled} onCheckedChange={(checked) => saveDigest(user, { daily_enabled: checked })} /></td>
                    <td className="p-3"><Switch checked={user.weekly_enabled} onCheckedChange={(checked) => saveDigest(user, { weekly_enabled: checked })} /></td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" onClick={() => saveDigest(user, {})}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Kaydet
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
