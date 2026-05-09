"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Monitor, KeyRound, Trash2, Columns3, UserPlus } from "lucide-react"

interface SecurityEvent {
  id: string
  user_email: string | null
  event_type: string
  ip_address: string | null
  user_agent: string | null
  details: Record<string, any>
  created_at: string
}

const EVENT_LABELS: Record<string, string> = {
  login: "Giriş",
  row_delete: "Satır silme",
  column_delete: "Sütun silme",
  column_hide: "Sütun gizleme",
  password_change: "Şifre değişikliği",
  user_create: "Kullanıcı oluşturma",
  branch_create: "Şube ekleme",
  branch_delete: "Şube silme",
  visibility_update: "Görünüm ayarı",
}

const EVENT_ICONS: Record<string, any> = {
  login: Monitor,
  row_delete: Trash2,
  column_delete: Columns3,
  column_hide: Columns3,
  password_change: KeyRound,
  user_create: UserPlus,
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

export default function GuvenlikAyarlarPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

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
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">İşlem</th>
                  <th className="p-3 text-left">Kullanıcı</th>
                  <th className="p-3 text-left">IP Adresi</th>
                  <th className="p-3 text-left">Zaman</th>
                  <th className="p-3 text-left">Detay</th>
                </tr>
              </thead>
              <tbody>
                {events.map(event => {
                  const Icon = EVENT_ICONS[event.event_type] || Shield
                  return (
                    <tr key={event.id} className="border-b">
                      <td className="p-3">
                        <div className="flex items-center gap-2 font-medium">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {EVENT_LABELS[event.event_type] || event.event_type}
                        </div>
                      </td>
                      <td className="p-3">{event.user_email || "-"}</td>
                      <td className="p-3">{event.ip_address || "-"}</td>
                      <td className="p-3">{formatDate(event.created_at)}</td>
                      <td className="p-3 text-muted-foreground">{JSON.stringify(event.details || {})}</td>
                    </tr>
                  )
                })}
                {events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-muted-foreground">Henüz güvenlik kaydı yok.</td>
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

