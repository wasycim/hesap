"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Activity, CheckCircle2, Download, Mail, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useSube } from "@/contexts/sube-context"

type HealthPayload = {
  checkedAt: string
  overall: "operational" | "down"
  components: Array<{ name: string; status: "operational" | "down"; message: string }>
  latestEvents: SecurityEvent[]
  resetEvents: SecurityEvent[]
  pendingDevices: TerminalDevice[]
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

  useEffect(() => {
    if (!subeLoading && isAdmin) loadAll()
    if (!subeLoading && !isAdmin) setLoading(false)
  }, [subeLoading, isAdmin])

  async function loadAll() {
    setLoading(true)
    const [healthRes, devicesRes, digestRes] = await Promise.all([
      fetch("/api/admin/system-health", { cache: "no-store" }),
      fetch("/api/admin/terminal-devices", { cache: "no-store" }),
      fetch("/api/admin/digest-settings", { cache: "no-store" }),
    ])
    const [healthData, devicesData, digestData] = await Promise.all([
      healthRes.json().catch(() => null),
      devicesRes.json().catch(() => null),
      digestRes.json().catch(() => null),
    ])
    setHealth(healthRes.ok ? healthData : null)
    setDevices(devicesRes.ok ? devicesData.devices || [] : [])
    setDigestUsers(digestRes.ok ? digestData.users || [] : [])
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
                <Badge className={component.status === "operational" ? "bg-emerald-600" : "bg-red-600"}>
                  {component.status === "operational" ? "Çalışıyor" : "Sorun var"}
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
