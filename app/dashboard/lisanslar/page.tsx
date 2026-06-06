"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Laptop, MonitorCheck, RefreshCcw, Search, Smartphone, Tablet, Trash2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type DeviceLicense = {
  id: string
  user_id: string | null
  device_id: string
  platform: string
  label: string | null
  active: boolean
  revoked_at: string | null
  last_ip: string | null
  user_agent: string | null
  last_seen_at: string | null
  created_at: string
  user_profile?: {
    display_name?: string | null
    email?: string | null
    tc_kimlik?: string | null
  } | null
}

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })
}

function platformIcon(platform: string) {
  const normalized = platform.toLowerCase()
  if (normalized.includes("android") || normalized.includes("ios") || normalized.includes("mobile")) return Smartphone
  if (normalized.includes("tablet")) return Tablet
  if (normalized.includes("desktop") || normalized.includes("electron") || normalized.includes("windows")) return Laptop
  return MonitorCheck
}

export default function LisanslarPage() {
  const [licenses, setLicenses] = useState<DeviceLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")
  const [platform, setPlatform] = useState("all")
  const [status, setStatus] = useState("all")
  const [resetBusy, setResetBusy] = useState<"revoked" | "all" | null>(null)

  async function load() {
    setLoading(true)
    const response = await fetch("/api/admin/device-licenses", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      toast.error(data.error || "Cihaz lisansları yüklenemedi.")
      return
    }
    setLicenses(data.licenses || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(id: string, active: boolean) {
    const response = await fetch("/api/admin/device-licenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(data.error || "Cihaz durumu değiştirilemedi.")
      return
    }
    toast.success(active ? "Cihaz tekrar aktif." : "Cihaz iptal edildi.")
    load()
  }

  async function resetLicenses(scope: "revoked" | "all") {
    const message = scope === "all"
      ? "Tüm lisanslı cihaz kayıtları silinecek. Cihazlar tekrar giriş yaptıkça yeniden kaydolur. Devam edilsin mi?"
      : "Sadece iptal edilmiş lisans kayıtları silinecek. Devam edilsin mi?"

    if (!window.confirm(message)) return

    setResetBusy(scope)
    const response = await fetch("/api/admin/device-licenses", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    })
    const data = await response.json().catch(() => ({}))
    setResetBusy(null)

    if (!response.ok) {
      toast.error(data.error || "Lisans kayıtları sıfırlanamadı.")
      return
    }

    toast.success(`${data.deleted || 0} cihaz lisansı temizlendi.`)
    load()
  }

  const platforms = useMemo(() => {
    const unique = Array.from(new Set(licenses.map((license) => license.platform || "web")))
    return unique.sort((a, b) => a.localeCompare(b, "tr"))
  }, [licenses])

  const filtered = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase("tr-TR")
    return licenses.filter((license) => {
      const profile = license.user_profile
      const haystack = [
        profile?.display_name,
        profile?.email,
        profile?.tc_kimlik,
        license.platform,
        license.label,
        license.device_id,
        license.last_ip,
      ].filter(Boolean).join(" ").toLocaleLowerCase("tr-TR")
      if (clean && !haystack.includes(clean)) return false
      if (platform !== "all" && license.platform !== platform) return false
      if (status === "active" && !license.active) return false
      if (status === "revoked" && license.active) return false
      return true
    })
  }, [licenses, platform, query, status])

  const stats = useMemo(() => ({
    total: licenses.length,
    active: licenses.filter((license) => license.active).length,
    revoked: licenses.filter((license) => !license.active).length,
    desktop: licenses.filter((license) => /desktop|electron|windows/i.test(license.platform)).length,
    mobile: licenses.filter((license) => /android|ios|mobile/i.test(license.platform)).length,
  }), [licenses])

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal">Cihaz Bazlı Lisanslama</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hangi PC/telefon aktif, kimin cihazı, son IP ve son görülme bilgisi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Yükleniyor..." : "Yenile"}
          </Button>
          <Button variant="outline" onClick={() => resetLicenses("revoked")} disabled={Boolean(resetBusy)}>
            <Trash2 className="mr-2 h-4 w-4" />
            {resetBusy === "revoked" ? "Temizleniyor..." : "İptalleri temizle"}
          </Button>
          <Button variant="destructive" onClick={() => resetLicenses("all")} disabled={Boolean(resetBusy)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            {resetBusy === "all" ? "Sıfırlanıyor..." : "Tümünü sıfırla"}
          </Button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Toplam" value={stats.total} />
        <StatCard label="Aktif" value={stats.active} />
        <StatCard label="İptal" value={stats.revoked} />
        <StatCard label="EXE/PC" value={stats.desktop} />
        <StatCard label="Mobil" value={stats.mobile} />
      </section>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_220px_180px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Personel, e-posta, IP, cihaz ID ara..."
              className="pl-9"
            />
          </label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm platformlar</SelectItem>
              {platforms.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="revoked">İptal</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <section className="grid gap-3 xl:grid-cols-2">
        {loading ? <p className="text-sm text-muted-foreground">Cihazlar yükleniyor...</p> : null}
        {!loading && filtered.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Filtreye uygun cihaz yok.</CardContent>
          </Card>
        ) : null}
        {filtered.map((license) => {
          const Icon = platformIcon(license.platform || "web")
          const profile = license.user_profile
          return (
            <Card key={license.id} className={!license.active ? "opacity-75" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold">{profile?.display_name || profile?.email || license.user_id || "Bilinmeyen hesap"}</p>
                        <Badge variant={license.active ? "default" : "destructive"}>{license.active ? "Aktif" : "İptal"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{profile?.tc_kimlik || "-"} · {profile?.email || "e-posta yok"}</p>
                      <p className="mt-2 truncate text-sm font-semibold">{license.label || license.platform || "Cihaz"}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">ID: {license.device_id}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={license.active ? "destructive" : "outline"}
                    onClick={() => toggle(license.id, !license.active)}
                    className="shrink-0 gap-2"
                  >
                    {license.active ? <XCircle className="h-4 w-4" /> : <MonitorCheck className="h-4 w-4" />}
                    {license.active ? "İptal et" : "Aktif et"}
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 rounded-xl border bg-muted/20 p-3 text-xs sm:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Platform</p>
                    <p className="font-semibold">{license.platform || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Son IP</p>
                    <p className="font-semibold">{license.last_ip || "-"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Son görülme</p>
                    <p className="font-semibold">{formatDate(license.last_seen_at || license.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-black">{value}</p>
      </CardContent>
    </Card>
  )
}
