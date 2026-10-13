"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Archive, CheckCircle2, DatabaseBackup, Download, Loader2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

type Settings = {
  dailyEnabled: boolean
  weeklyEnabled: boolean
  monthlyEnabled: boolean
  recipients: string[]
  attachLimitMb: number
  dailyRetention: number
  weeklyRetention: number
  monthlyRetention: number
}

type Payload = {
  settings: Settings
  storage: { provider: string; bucket: string; encrypted: boolean }
  encryptionConfigured: boolean
  recent: Array<{ id: string; title: string; interval: string; object_path: string | null; size_bytes: number | null; status: string; error_message: string | null; created_at: string }>
}

export function BackupDeliveryPanel() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [recipients, setRecipients] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    const response = await fetch("/api/admin/backup-settings", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) { toast.error(data.error || "Yedek ayarları yüklenemedi."); return }
    setPayload(data)
    setRecipients((data.settings?.recipients || []).join("\n"))
  }

  function patch(settings: Partial<Settings>) {
    setPayload((current) => current ? { ...current, settings: { ...current.settings, ...settings } } : current)
  }

  async function save() {
    if (!payload) return
    setSaving(true)
    const next = {
      ...payload.settings,
      recipients: recipients.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean),
    }
    const response = await fetch("/api/admin/backup-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: next }),
    })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) { toast.error(data.error || "Yedek ayarları kaydedilemedi."); return }
    toast.success("Günlük, haftalık ve aylık yedek teslimatı kaydedildi.")
    void load()
  }

  if (loading && !payload) return <Card><CardContent className="grid min-h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
  if (!payload) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><DatabaseBackup className="h-5 w-5" /> Şifreli Tam Yedek Teslimatı</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 lg:grid-cols-3">
          <Frequency label="Günlük yedek" enabled={payload.settings.dailyEnabled} retention={payload.settings.dailyRetention} unit="gün" onEnabled={(dailyEnabled) => patch({ dailyEnabled })} onRetention={(dailyRetention) => patch({ dailyRetention })} />
          <Frequency label="Haftalık yedek" enabled={payload.settings.weeklyEnabled} retention={payload.settings.weeklyRetention} unit="hafta" onEnabled={(weeklyEnabled) => patch({ weeklyEnabled })} onRetention={(weeklyRetention) => patch({ weeklyRetention })} />
          <Frequency label="Aylık yedek" enabled={payload.settings.monthlyEnabled} retention={payload.settings.monthlyRetention} unit="ay" onEnabled={(monthlyEnabled) => patch({ monthlyEnabled })} onRetention={(monthlyRetention) => patch({ monthlyRetention })} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <label className="grid gap-2 text-sm font-semibold">
            Yedek gönderilecek e-posta adresleri
            <textarea value={recipients} onChange={(event) => setRecipients(event.target.value)} rows={5} placeholder={"yonetici@firma.com\nyedek@firma.com"} className="min-h-28 rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-emerald-500" />
            <span className="text-xs font-normal text-muted-foreground">Her satıra bir adres yazın. 12 MB altındaki şifreli dosya eklenir; daha büyük dosyada 7 günlük özel bağlantı gönderilir.</span>
          </label>
          <div className="space-y-3 rounded-xl border bg-muted/25 p-4 text-sm">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Harici hedef</span><strong>{payload.storage.provider}</strong></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Özel bucket</span><code className="rounded bg-muted px-2 py-1">{payload.storage.bucket}</code></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Şifreleme</span><Badge variant={payload.encryptionConfigured ? "default" : "destructive"}>{payload.encryptionConfigured ? "AES-256-GCM hazır" : "Anahtar eksik"}</Badge></div>
            <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Veritabanı tabloları ve Auth kullanıcı listesi sayfalı olarak tam dışa aktarılır.</div>
          </div>
        </div>

        <Button onClick={save} disabled={saving || !payload.encryptionConfigured} className="gap-2"><Archive className="h-4 w-4" />{saving ? "Kaydediliyor..." : "Yedek kurallarını kaydet"}</Button>

        <div>
          <h3 className="mb-3 text-sm font-bold">Son yedekler</h3>
          <div className="grid gap-2">
            {payload.recent.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl border p-3 text-sm sm:flex-row sm:items-center"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString("tr-TR")} · {formatBytes(item.size_bytes || 0)}</p>{item.error_message ? <p className="mt-1 text-xs text-red-600">{item.error_message}</p> : null}</div><div className="flex items-center gap-2">{item.object_path ? <a href={`/api/admin/backup-files/${item.id}`} className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-semibold hover:bg-muted"><Download className="h-3.5 w-3.5" /> JSON indir</a> : null}<Badge variant={item.status === "completed" ? "default" : "destructive"} className="w-fit gap-1">{item.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : null}{item.status === "completed" ? "Tamamlandı" : "Teslimat hatası"}</Badge></div></div>)}
            {!payload.recent.length ? <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">Henüz yeni nesil yedek kaydı yok.</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Frequency({ label, enabled, retention, unit, onEnabled, onRetention }: { label: string; enabled: boolean; retention: number; unit: string; onEnabled: (value: boolean) => void; onRetention: (value: number) => void }) {
  return <div className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><strong className="text-sm">{label}</strong><Switch checked={enabled} onCheckedChange={onEnabled} /></div><label className="mt-4 grid grid-cols-[1fr_auto] items-center gap-2 text-xs text-muted-foreground"><Input type="number" min={1} value={retention} onChange={(event) => onRetention(Number(event.target.value))} className="h-9" /> {unit} sakla</label></div>
}

function formatBytes(value: number) {
  if (!value) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1)
  return `${(value / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`
}
