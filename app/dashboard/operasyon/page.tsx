"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CalendarDays, FileText, Megaphone, ShieldAlert, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

const tables = [
  "app_settings",
  "notification_rule_definitions",
  "overtime_approvals",
  "pdf_templates",
  "pdf_archives",
  "app_announcements",
  "holidays",
  "offline_conflicts",
  "error_reports",
  "app_store_metadata",
  "backup_snapshots",
]

async function fetchTable(table: string) {
  const response = await fetch(`/api/admin/operations?table=${table}`, { cache: "no-store" })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `${table} yuklenemedi`)
  return data.items || []
}

export default function OperasyonPage() {
  const [data, setData] = useState<Record<string, any[]>>({})
  const [busy, setBusy] = useState(false)
  const [rule, setRule] = useState({ name: "", event_type: "attendance", level: "warning", starts_at: "", ends_at: "", message_template: "" })
  const [template, setTemplate] = useState({ name: "", report_type: "mesai", orientation: "landscape" })
  const [announcement, setAnnouncement] = useState({ title: "", body: "", level: "info", target_type: "all" })
  const [holiday, setHoliday] = useState({ holiday_date: "", name: "", type: "official" })

  async function load() {
    setBusy(true)
    const entries = await Promise.allSettled(tables.map(async (table) => [table, await fetchTable(table)] as const))
    const next: Record<string, any[]> = {}
    for (const entry of entries) {
      if (entry.status === "fulfilled") next[entry.value[0]] = entry.value[1]
    }
    setData(next)
    setBusy(false)
  }

  useEffect(() => {
    load().catch((error) => toast.error(error instanceof Error ? error.message : "Operasyon verisi yuklenemedi."))
  }, [])

  const settings = useMemo(() => new Map((data.app_settings || []).map((item) => [item.key, item.value || {}])), [data])
  const maintenance = settings.get("maintenance_mode") || {}

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
    toast.success("Kayit eklendi.")
    load()
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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-black tracking-normal">Operasyon Merkezi</h1>
        <p className="text-sm text-muted-foreground">Developer seviyesinde kural motoru, PDF, bakim, hata ve store paket yonetimi.</p>
      </header>

      <section className="grid gap-4 xl:grid-cols-3">
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
          <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> PDF sablon ve arsiv</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <Input placeholder="Sablon adi" value={template.name} onChange={(e) => setTemplate({ ...template, name: e.target.value })} />
              <Input placeholder="Rapor tipi" value={template.report_type} onChange={(e) => setTemplate({ ...template, report_type: e.target.value })} />
              <Select value={template.orientation} onValueChange={(orientation) => setTemplate({ ...template, orientation })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Yatay</SelectItem>
                  <SelectItem value="portrait">Dikey</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => create("pdf_templates", { ...template, template_json: { density: "compact", header: true, footer: true } })}>PDF sablon ekle</Button>
            <div className="grid gap-2 md:grid-cols-2">
              {(data.pdf_templates || []).slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-bold">{item.name}</p>
                  <p className="text-muted-foreground">{item.report_type} / {item.orientation}</p>
                </div>
              ))}
              {(data.pdf_archives || []).slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-bold">{item.title}</p>
                  <p className="text-muted-foreground">{item.report_type} / {new Date(item.created_at).toLocaleString("tr-TR")}</p>
                </div>
              ))}
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
            <Button onClick={() => create("app_announcements", announcement)}>Duyuru ekle</Button>
            {(data.app_announcements || []).slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl border p-3 text-sm">
                <p className="font-bold">{item.title}</p>
                <p className="text-muted-foreground">{item.body}</p>
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
