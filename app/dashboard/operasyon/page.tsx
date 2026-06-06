"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, Coffee, FileText, Megaphone, ShieldAlert, Trash2, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const tables = [
  "app_settings",
  "dashboard_permission_overrides",
  "notification_rule_definitions",
  "overtime_approvals",
  "pdf_archives",
  "app_announcements",
  "holidays",
  "offline_conflicts",
  "error_reports",
  "app_store_metadata",
  "backup_snapshots",
]

const permissionOptions = [
  "dashboard",
  "gelir",
  "gider",
  "vardiya",
  "mesai",
  "mesai_takip",
  "corbalar",
  "kargo_cari",
  "on_dort_no",
  "maaslar",
  "bildirim_gonder",
  "sube_ciro_raporlari",
  "sutun_ayarlar",
  "gorunum_ayarlar",
  "ayarlar",
  "guvenlik_ayarlar",
  "gelismis_log",
  "sistem_sagligi",
  "admin_ayarlar",
  "lisanslar",
  "operasyon",
  "log_backup",
  "cay",
  "bildirimler",
  "hesap",
]

async function fetchTable(table: string) {
  const response = await fetch(`/api/admin/operations?table=${table}`, { cache: "no-store" })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `${table} yuklenemedi`)
  return data.items || []
}

export default function OperasyonPage() {
  const [data, setData] = useState<Record<string, any[]>>({})
  const [users, setUsers] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [rule, setRule] = useState({ name: "", event_type: "attendance", level: "warning", starts_at: "", ends_at: "", message_template: "" })
  const [permission, setPermission] = useState({ scope_type: "role", role_key: "user", user_id: "", permission_key: "gelir", allowed: true, note: "" })
  const [announcement, setAnnouncement] = useState({ title: "", body: "", level: "info", target_type: "all", starts_at: "", ends_at: "", always: true })
  const [holiday, setHoliday] = useState({ holiday_date: "", name: "", type: "official" })

  async function load() {
    setBusy(true)
    const entries = await Promise.allSettled(tables.map(async (table) => [table, await fetchTable(table)] as const))
    const next: Record<string, any[]> = {}
    for (const entry of entries) {
      if (entry.status === "fulfilled") next[entry.value[0]] = entry.value[1]
    }
    setData(next)
    const usersResponse = await fetch("/api/admin/users", { cache: "no-store" }).catch(() => null)
    if (usersResponse?.ok) {
      const usersPayload = await usersResponse.json().catch(() => ({}))
      setUsers(usersPayload.users || [])
    }
    setBusy(false)
  }

  useEffect(() => {
    load().catch((error) => toast.error(error instanceof Error ? error.message : "Operasyon verisi yuklenemedi."))
  }, [])

  const settings = useMemo(() => new Map((data.app_settings || []).map((item) => [item.key, item.value || {}])), [data])
  const maintenance = settings.get("maintenance_mode") || {}
  const teaModule = settings.get("tea_module") || { enabled: false }
  const permissionOverrides = useMemo(() => {
    return [...(data.dashboard_permission_overrides || [])].sort((a, b) => {
      const left = new Date(a.updated_at || a.created_at || 0).getTime()
      const right = new Date(b.updated_at || b.created_at || 0).getTime()
      return right - left
    })
  }, [data.dashboard_permission_overrides])

  async function updateSetting(key: string, value: any) {
    const response = await fetch(`/api/admin/operations?table=app_settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(result.error || "Ayar kaydedilemedi.")
      return
    }
    toast.success("Ayar kaydedildi.")
    load()
  }

  async function create(table: string, payload: any) {
    if (table === "dashboard_permission_overrides" && payload.scope_type === "user" && !payload.user_id) {
      toast.error("Once hesap secmelisin.")
      return false
    }

    const response = await fetch(`/api/admin/operations?table=${table}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(result.error || "Kayit eklenemedi.")
      return false
    }
    if (result.item?.id) {
      setData((current) => {
        const items = current[table] || []
        const filtered = items.filter((item) => item.id !== result.item.id)
        return { ...current, [table]: [result.item, ...filtered] }
      })
    }
    if (table === "dashboard_permission_overrides") {
      toast.success(result.action === "updated" ? "Mevcut yetki güncellendi." : "Yetki eklendi.")
    } else {
      toast.success("Kayit eklendi.")
    }
    await load()
    return true
  }

  async function patch(table: string, id: string, payload: any) {
    const response = await fetch(`/api/admin/operations?table=${table}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(result.error || "Kayit guncellenemedi.")
      return
    }
    toast.success("Kaydedildi.")
    load()
  }

  async function remove(table: string, id: string) {
    const response = await fetch(`/api/admin/operations?table=${table}&id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(result.error || "Kayit silinemedi.")
      return
    }
    toast.success("Kayit silindi.")
    load()
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-black tracking-normal">Operasyon Merkezi</h1>
        <p className="text-sm text-muted-foreground">Developer seviyesinde kural motoru, PDF, bakim, hata ve store paket yonetimi.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Bakim modu</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
              Sistem bakimda
              <Switch checked={Boolean(maintenance.enabled)} onCheckedChange={(enabled) => updateSetting("maintenance_mode", { ...maintenance, enabled })} />
            </label>
            <Textarea
              value={maintenance.message || ""}
              onChange={(event) => setData((current) => ({
                ...current,
                app_settings: (current.app_settings || []).map((item) => item.key === "maintenance_mode" ? { ...item, value: { ...maintenance, message: event.target.value } } : item),
              }))}
              rows={3}
            />
            <Button onClick={() => updateSetting("maintenance_mode", maintenance)} variant="outline">Mesaji kaydet</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Cay modulu</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
              Cay menusu aktif
              <Switch
                checked={Boolean(teaModule.enabled)}
                onCheckedChange={(enabled) => updateSetting("tea_module", {
                  ...teaModule,
                  enabled,
                  updatedAt: new Date().toISOString(),
                })}
              />
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Kapaliyken Cay menusu tum hesaplardan gizlenir ve API islem kabul etmez. Acildiginda yetkili hesaplar menuden kullanabilir.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Sistem alarmlari</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {["supabase", "smtp", "fcm", "vercel"].map((key) => (
              <div key={key} className="flex items-center justify-between rounded-xl border p-3">
                <span className="font-semibold uppercase">{key}</span>
                <Badge variant="outline">Izleniyor</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Store metadata</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(data.app_store_metadata || []).map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                <p className="font-bold">{item.platform} / {item.title}</p>
                <p className="text-muted-foreground">{item.subtitle}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.screenshot_url}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Otomatik gunluk yedekler</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data.backup_snapshots || []).slice(0, 9).map((item) => (
            <div key={item.id} className="rounded-xl border p-3 text-sm">
              <p className="font-bold">{item.title}</p>
              <p className="text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")}</p>
              <p className="mt-2 text-xs text-muted-foreground">{Object.keys(item.table_counts || {}).length} tablo sayildi</p>
            </div>
          ))}
          {(data.backup_snapshots || []).length === 0 ? <p className="text-sm text-muted-foreground">Henuz otomatik yedek yok.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Hesap yetki yonetimi</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[160px_1fr_1fr_140px_auto] md:items-end">
            <label className="grid gap-1.5 text-sm font-medium">
              Kapsam
              <Select value={permission.scope_type} onValueChange={(scope_type) => setPermission({ ...permission, scope_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Rol</SelectItem>
                  <SelectItem value="user">Tek hesap</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {permission.scope_type === "role" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Rol
                <Select value={permission.role_key} onValueChange={(role_key) => setPermission({ ...permission, role_key })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Kullanici</SelectItem>
                    <SelectItem value="admin">Yonetici</SelectItem>
                    <SelectItem value="developer">Developer</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            ) : (
              <label className="grid gap-1.5 text-sm font-medium">
                Hesap
                <Select value={permission.user_id} onValueChange={(user_id) => setPermission({ ...permission, user_id })}>
                  <SelectTrigger><SelectValue placeholder="Hesap sec" /></SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.user_id} value={user.user_id}>{user.display_name || user.email || user.tc_kimlik}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Yetki
              <Select value={permission.permission_key} onValueChange={(permission_key) => setPermission({ ...permission, permission_key })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {permissionOptions.map((key) => <SelectItem key={key} value={key}>{key}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label className="flex h-10 items-center justify-between gap-3 rounded-xl border px-3 text-sm font-semibold">
              Yetkili
              <Switch checked={permission.allowed} onCheckedChange={(allowed) => setPermission({ ...permission, allowed })} />
            </label>
            <Button onClick={() => create("dashboard_permission_overrides", {
              ...permission,
              role_key: permission.scope_type === "role" ? permission.role_key : null,
              user_id: permission.scope_type === "user" ? permission.user_id : null,
            })}>Kaydet</Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Kayitlar son guncellenme zamanina gore siralanir.</span>
            <span>{permissionOverrides.length} yetki kaydi</span>
          </div>
          <div className="grid max-h-[520px] gap-2 overflow-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
            {permissionOverrides.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div>
                  <p className="font-bold">{item.permission_key}</p>
                  <p className="text-muted-foreground">
                    {item.scope_type === "role" ? `Rol: ${item.role_key}` : `Hesap: ${users.find((user) => user.user_id === item.user_id)?.display_name || item.user_id}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={item.allowed ? "default" : "destructive"}>{item.allowed ? "Acik" : "Kapali"}</Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove("dashboard_permission_overrides", item.id)} title="Sil">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            {permissionOverrides.length === 0 ? <p className="text-sm text-muted-foreground">Henuz hesap yetki kaydi yok.</p> : null}
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bildirim kural motoru</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <Input placeholder="Kural adi" value={rule.name} onChange={(e) => setRule({ ...rule, name: e.target.value })} />
              <Select value={rule.level} onValueChange={(level) => setRule({ ...rule, level })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Bilgi</SelectItem>
                  <SelectItem value="warning">Uyari</SelectItem>
                  <SelectItem value="error">Kritik</SelectItem>
                </SelectContent>
              </Select>
              <Input type="time" value={rule.starts_at} onChange={(e) => setRule({ ...rule, starts_at: e.target.value })} />
              <Input type="time" value={rule.ends_at} onChange={(e) => setRule({ ...rule, ends_at: e.target.value })} />
            </div>
            <Textarea placeholder="Mesaj sablonu" value={rule.message_template} onChange={(e) => setRule({ ...rule, message_template: e.target.value })} />
            <Button onClick={() => create("notification_rule_definitions", rule)}>Kural ekle</Button>
            <div className="space-y-2">
              {(data.notification_rule_definitions || []).map((item) => (
                <div key={item.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">{item.name}</p>
                    <Badge>{item.level}</Badge>
                  </div>
                  <p className="text-muted-foreground">{item.starts_at || "--"} - {item.ends_at || "--"} / {item.event_type}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> PDF arsivi</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">PDF raporlari otomatik arsivlenir. Manuel sablon ekleme kapatildi.</p>
            <div className="grid gap-2 md:grid-cols-2">
              {(data.pdf_archives || []).slice(0, 10).map((item) => (
                <div key={item.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{item.title}</p>
                      <p className="text-muted-foreground">{item.report_type} / {new Date(item.created_at).toLocaleString("tr-TR")}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove("pdf_archives", item.id)} title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {(data.pdf_archives || []).length === 0 ? <p className="text-sm text-muted-foreground">PDF arsiv kaydi yok.</p> : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Uygulama ici duyuru</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Duyuru basligi" value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} />
            <Textarea placeholder="Duyuru metni" value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} />
            <div className="grid gap-3 md:grid-cols-3">
              <Select value={announcement.level} onValueChange={(level) => setAnnouncement({ ...announcement, level })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Bilgi</SelectItem>
                  <SelectItem value="success">Basarili</SelectItem>
                  <SelectItem value="warning">Uyari</SelectItem>
                  <SelectItem value="error">Kritik</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm font-semibold">
                Her zaman
                <Switch checked={announcement.always} onCheckedChange={(always) => setAnnouncement({ ...announcement, always })} />
              </label>
              <Button onClick={() => create("app_announcements", {
                ...announcement,
                starts_at: announcement.always || !announcement.starts_at ? null : new Date(announcement.starts_at).toISOString(),
                ends_at: announcement.always || !announcement.ends_at ? null : new Date(announcement.ends_at).toISOString(),
              })}>Duyuru ekle</Button>
            </div>
            {!announcement.always ? (
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Baslangic
                  <Input type="datetime-local" value={announcement.starts_at} onChange={(e) => setAnnouncement({ ...announcement, starts_at: e.target.value })} />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Bitis
                  <Input type="datetime-local" value={announcement.ends_at} onChange={(e) => setAnnouncement({ ...announcement, ends_at: e.target.value })} />
                </label>
              </div>
            ) : null}
            {(data.app_announcements || []).slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{item.title}</p>
                      <Badge variant={item.active ? "default" : "secondary"}>{item.active ? "Aktif" : "Pasif"}</Badge>
                      <Badge variant="outline">{item.level}</Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{item.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.starts_at ? new Date(item.starts_at).toLocaleString("tr-TR") : "Her zaman"} - {item.ends_at ? new Date(item.ends_at).toLocaleString("tr-TR") : "suresiz"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => patch("app_announcements", item.id, { ...item, active: !item.active })}>
                      {item.active ? "Gizle" : "Goster"}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => remove("app_announcements", item.id)} title="Sil">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Resmi tatil ve ozel gun</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-[160px_1fr_160px]">
              <Input type="date" value={holiday.holiday_date} onChange={(e) => setHoliday({ ...holiday, holiday_date: e.target.value })} />
              <Input placeholder="Gun adi" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
              <Input placeholder="Tip" value={holiday.type} onChange={(e) => setHoliday({ ...holiday, type: e.target.value })} />
            </div>
            <Button onClick={() => create("holidays", holiday)}>Gun ekle</Button>
            <div className="max-h-72 space-y-2 overflow-auto">
              {(data.holidays || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <span className="font-semibold">{item.name}</span>
                  <span className="text-muted-foreground">{item.holiday_date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Mesai onay akisi</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.overtime_approvals || []).slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-bold">{item.personel_name || item.user_profile_id}</p>
                <p className="text-muted-foreground">{item.raw_minutes} dk / {item.payable_minutes} dk</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => patch("overtime_approvals", item.id, { status: "approved" })}>Onayla</Button>
                  <Button size="sm" variant="outline" onClick={() => patch("overtime_approvals", item.id, { status: "rejected" })}>Reddet</Button>
                </div>
              </div>
            ))}
            {(data.overtime_approvals || []).length === 0 ? <p className="text-sm text-muted-foreground">Bekleyen onay yok.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Offline cakismazlik</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.offline_conflicts || []).slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-bold">{item.mutation_path}</p>
                <p className="text-muted-foreground">{item.status}</p>
                {item.status === "open" ? <Button size="sm" className="mt-2" onClick={() => patch("offline_conflicts", item.id, { status: "resolved" })}>Cozuldu isaretle</Button> : null}
              </div>
            ))}
            {(data.offline_conflicts || []).length === 0 ? <p className="text-sm text-muted-foreground">Cakismazlik yok.</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Hata raporlari</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.error_reports || []).slice(0, 12).map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-bold">{item.message}</p>
                <p className="truncate text-muted-foreground">{item.path || "-"}</p>
              </div>
            ))}
            {(data.error_reports || []).length === 0 ? <p className="text-sm text-muted-foreground">Hata raporu yok.</p> : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
