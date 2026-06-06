"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Mail, RefreshCw, Send, Settings2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

type MailSettings = {
  dailyEnabled: boolean
  dailyTime: string
  weeklyEnabled: boolean
  weeklyDay: string
  weeklyTime: string
  attachPdf: boolean
  attachHtml: boolean
  detailLevel: "summary" | "detailed"
  reportTypes: string[]
  targetRoles: string[]
}

type MailUser = {
  user_id: string
  email: string | null
  digest_email: string
  display_name: string | null
  is_admin: boolean
  is_developer: boolean
  role: "user" | "admin" | "developer"
  daily_enabled: boolean
  weekly_enabled: boolean
}

const roleOptions = [
  { key: "developer", label: "Developer" },
  { key: "admin", label: "Yönetici" },
  { key: "user", label: "Personel" },
]

const reportOptions = [
  { key: "attendance", label: "Mesai özeti" },
  { key: "salary", label: "Maaş özeti" },
  { key: "finance", label: "Gelir/gider özeti" },
  { key: "system", label: "Sistem özeti" },
]

const weekDays = [
  { key: "monday", label: "Pazartesi" },
  { key: "tuesday", label: "Salı" },
  { key: "wednesday", label: "Çarşamba" },
  { key: "thursday", label: "Perşembe" },
  { key: "friday", label: "Cuma" },
  { key: "saturday", label: "Cumartesi" },
  { key: "sunday", label: "Pazar" },
]

export default function MailIslemleriPage() {
  const [settings, setSettings] = useState<MailSettings | null>(null)
  const [users, setUsers] = useState<MailUser[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const response = await fetch("/api/admin/mail-settings", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      toast.error(data.error || "Mail ayarları yüklenemedi.")
      return
    }
    setSettings(data.settings)
    setUsers(data.users || [])
  }

  function patchSettings(patch: Partial<MailSettings>) {
    setSettings((current) => current ? { ...current, ...patch } : current)
  }

  function toggleArray(field: "targetRoles" | "reportTypes", key: string) {
    setSettings((current) => {
      if (!current) return current
      const set = new Set(current[field])
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...current, [field]: Array.from(set) }
    })
  }

  async function saveSettings() {
    if (!settings) return
    setBusy("settings")
    const response = await fetch("/api/admin/mail-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "settings", settings }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) {
      toast.error(data.error || "Mail ayarları kaydedilemedi.")
      return
    }
    toast.success("Mail işlemleri ayarları kaydedildi.")
    load()
  }

  async function saveUser(user: MailUser, patch: Partial<MailUser>) {
    const next = { ...user, ...patch }
    setUsers((items) => items.map((item) => item.user_id === user.user_id ? next : item))
    setBusy(user.user_id)
    const response = await fetch("/api/admin/mail-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "subscriber",
        userId: next.user_id,
        email: next.digest_email,
        dailyEnabled: next.daily_enabled,
        weeklyEnabled: next.weekly_enabled,
      }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok) {
      toast.error(data.error || "Alıcı ayarı kaydedilemedi.")
      load()
      return
    }
    toast.success("Alıcı ayarı kaydedildi.")
  }

  async function sendTest() {
    setBusy("test")
    const response = await fetch("/api/admin/digest-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(null)
    if (!response.ok || !data.sent) {
      toast.error(data.error || "Test maili gönderilemedi.")
      return
    }
    toast.success("PDF ve HTML ekli test maili gönderildi.")
  }

  const summary = useMemo(() => ({
    daily: users.filter((user) => user.daily_enabled).length,
    weekly: users.filter((user) => user.weekly_enabled).length,
    roles: settings?.targetRoles.length || 0,
  }), [settings?.targetRoles.length, users])

  if (loading && !settings) {
    return <div className="p-6 text-sm text-muted-foreground">Mail ayarları yükleniyor...</div>
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Mail İşlemleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Otomatik özet mailleri, PDF/HTML ekleri, alıcı rolleri ve yönetici aboneliklerini buradan ayarla.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Yenile
          </Button>
          <Button variant="outline" onClick={sendTest} disabled={busy === "test"} className="gap-2">
            <Send className={busy === "test" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
            Test maili
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Günlük alıcı</p>
            <p className="mt-2 text-3xl font-black">{summary.daily}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Haftalık alıcı</p>
            <p className="mt-2 text-3xl font-black">{summary.weekly}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Rol hedefi</p>
            <p className="mt-2 text-3xl font-black">{summary.roles}</p>
          </CardContent>
        </Card>
      </section>

      {settings ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5" /> Genel Mail Kuralı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-4">
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
                Günlük mail
                <Switch checked={settings.dailyEnabled} onCheckedChange={(checked) => patchSettings({ dailyEnabled: checked })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Günlük saat
                <Input type="time" value={settings.dailyTime} onChange={(event) => patchSettings({ dailyTime: event.target.value })} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
                Haftalık mail
                <Switch checked={settings.weeklyEnabled} onCheckedChange={(checked) => patchSettings({ weeklyEnabled: checked })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Haftalık gün
                <Select value={settings.weeklyDay} onValueChange={(weeklyDay) => patchSettings({ weeklyDay })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{weekDays.map((day) => <SelectItem key={day.key} value={day.key}>{day.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <label className="grid gap-1.5 text-sm font-medium">
                Haftalık saat
                <Input type="time" value={settings.weeklyTime} onChange={(event) => patchSettings({ weeklyTime: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Detay seviyesi
                <Select value={settings.detailLevel} onValueChange={(detailLevel: "summary" | "detailed") => patchSettings({ detailLevel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="summary">Kısa özet</SelectItem>
                    <SelectItem value="detailed">Detaylı özet</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
                PDF eki
                <Switch checked={settings.attachPdf} onCheckedChange={(checked) => patchSettings({ attachPdf: checked })} />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-semibold">
                HTML eki
                <Switch checked={settings.attachHtml} onCheckedChange={(checked) => patchSettings({ attachHtml: checked })} />
              </label>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-xl border p-3">
                <p className="mb-3 text-sm font-bold">Hedef roller</p>
                <div className="flex flex-wrap gap-2">
                  {roleOptions.map((role) => (
                    <button
                      type="button"
                      key={role.key}
                      onClick={() => toggleArray("targetRoles", role.key)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${settings.targetRoles.includes(role.key) ? "border-emerald-500 bg-emerald-500 text-white" : "bg-background"}`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border p-3">
                <p className="mb-3 text-sm font-bold">Rapor içerikleri</p>
                <div className="flex flex-wrap gap-2">
                  {reportOptions.map((report) => (
                    <button
                      type="button"
                      key={report.key}
                      onClick={() => toggleArray("reportTypes", report.key)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${settings.reportTypes.includes(report.key) ? "border-sky-500 bg-sky-500 text-white" : "bg-background"}`}
                    >
                      {report.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={busy === "settings"} className="gap-2">
              <Mail className={busy === "settings" ? "h-4 w-4 animate-pulse" : "h-4 w-4"} />
              Mail kuralını kaydet
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Alıcı Yönetimi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="p-3">Hesap</th>
                  <th className="p-3">Rol</th>
                  <th className="p-3">Rapor e-postası</th>
                  <th className="p-3">Günlük</th>
                  <th className="p-3">Haftalık</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id} className="border-t">
                    <td className="p-3">
                      <p className="font-semibold">{user.display_name || user.email || user.user_id}</p>
                      <p className="text-xs text-muted-foreground">{user.email || "-"}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant={user.role === "developer" ? "default" : user.role === "admin" ? "secondary" : "outline"}>
                        {user.role === "developer" ? "Developer" : user.role === "admin" ? "Yönetici" : "Personel"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <Input
                        value={user.digest_email}
                        onChange={(event) => setUsers((items) => items.map((item) => item.user_id === user.user_id ? { ...item, digest_email: event.target.value } : item))}
                      />
                    </td>
                    <td className="p-3">
                      <Switch checked={user.daily_enabled} onCheckedChange={(checked) => saveUser(user, { daily_enabled: checked })} />
                    </td>
                    <td className="p-3">
                      <Switch checked={user.weekly_enabled} onCheckedChange={(checked) => saveUser(user, { weekly_enabled: checked })} />
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" disabled={busy === user.user_id} onClick={() => saveUser(user, {})}>
                        Kaydet
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Alıcı hesabı yok.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
