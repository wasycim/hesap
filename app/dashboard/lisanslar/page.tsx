"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { MonitorCheck, Smartphone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LisanslarPage() {
  const [licenses, setLicenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const response = await fetch("/api/admin/device-licenses", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      toast.error(data.error || "Cihaz lisanslari yuklenemedi.")
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
      toast.error(data.error || "Cihaz durumu degistirilemedi.")
      return
    }
    toast.success(active ? "Cihaz tekrar aktif." : "Cihaz iptal edildi.")
    load()
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-black tracking-normal">Cihaz Bazli Lisanslama</h1>
        <p className="text-sm text-muted-foreground">Hangi PC/telefon aktif, son IP ve platform bilgileri.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MonitorCheck className="h-5 w-5" /> Aktif cihazlar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="p-3 text-left">Kullanici</th>
                  <th className="p-3 text-left">Platform</th>
                  <th className="p-3 text-left">Cihaz</th>
                  <th className="p-3 text-left">Son IP</th>
                  <th className="p-3 text-left">Son gorulme</th>
                  <th className="p-3 text-left">Durum</th>
                  <th className="p-3 text-right">Islem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Yukleniyor...</td></tr>
                ) : null}
                {!loading && licenses.length === 0 ? (
                  <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Kayitli cihaz yok.</td></tr>
                ) : null}
                {licenses.map((license) => {
                  const profile = Array.isArray(license.user_profiles) ? license.user_profiles[0] : license.user_profiles
                  return (
                    <tr key={license.id} className="border-t">
                      <td className="p-3">
                        <p className="font-semibold">{profile?.display_name || profile?.email || license.user_id}</p>
                        <p className="text-xs text-muted-foreground">{profile?.tc_kimlik || "-"}</p>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          {license.platform}
                        </span>
                      </td>
                      <td className="max-w-[260px] truncate p-3">{license.label || license.device_id}</td>
                      <td className="p-3">{license.last_ip || "-"}</td>
                      <td className="p-3">{license.last_seen_at ? new Date(license.last_seen_at).toLocaleString("tr-TR") : "-"}</td>
                      <td className="p-3"><Badge variant={license.active ? "default" : "destructive"}>{license.active ? "Aktif" : "Iptal"}</Badge></td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant={license.active ? "destructive" : "outline"} onClick={() => toggle(license.id, !license.active)}>
                          {license.active ? "Iptal et" : "Aktif et"}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
