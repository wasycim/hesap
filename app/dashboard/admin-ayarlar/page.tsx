"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Plus, Trash2, UserPlus } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"

interface AdminUser {
  user_id: string
  email: string | null
  is_admin: boolean
  sube_id: string | null
  vardiya: string | null
  subeler?: { ad?: string } | null
}

export default function AdminAyarlarPage() {
  const { subeler, isAdmin } = useSube()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [email, setEmail] = useState("")
  const [subeId, setSubeId] = useState("")
  const [role, setRole] = useState("user")
  const [vardiya, setVardiya] = useState("none")
  const [newSubeName, setNewSubeName] = useState("")
  const [savingUser, setSavingUser] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    if (subeler.length > 0 && !subeId) setSubeId(subeler[0].id)
  }, [subeler, subeId])

  useEffect(() => {
    if (isAdmin) loadUsers()
  }, [isAdmin])

  async function loadUsers() {
    const response = await fetch("/api/admin/users")
    const result = await response.json()
    setUsers(result.users || [])
  }

  async function createUser() {
    if (!email.trim() || !subeId) {
      setMessage("E-posta ve şube zorunlu.")
      return
    }

    setSavingUser(true)
    setMessage(null)
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        subeId,
        isAdmin: role === "admin",
        vardiya: vardiya === "none" ? null : vardiya,
      }),
    })
    const result = await response.json()

    if (!response.ok) {
      setMessage(result.error || "Kullanıcı oluşturulamadı.")
      setSavingUser(false)
      return
    }

    setEmail("")
    setRole("user")
    setVardiya("none")
    setMessage("Kullanıcı oluşturuldu. İlk şifre: 123456")
    setSavingUser(false)
    loadUsers()
  }

  async function addBranch() {
    const name = newSubeName.trim()
    if (!name) return

    const code = name.toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0131/g, "i")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")

    const { error } = await supabase.from("subeler").insert({
      ad: name,
      kod: code || `sube-${Date.now()}`,
      aktif: true,
    })

    if (!error) {
      await logSecurityEvent("branch_create", { ad: name })
      setNewSubeName("")
      window.location.reload()
    } else {
      setMessage(error.message)
    }
  }

  async function deleteBranch(id: string, name: string) {
    if (!confirm(`${name} şubesini silmek istediğinizden emin misiniz?`)) return

    const { error } = await supabase.from("subeler").delete().eq("id", id)
    if (!error) {
      await logSecurityEvent("branch_delete", { sube_id: id, ad: name })
      window.location.reload()
    } else {
      setMessage(error.message)
    }
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

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Ayarları</h1>
        <p className="text-sm text-muted-foreground">Kullanıcı ve şube yönetimi.</p>
      </div>

      {message && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{message}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Kullanıcı Oluştur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="test.kullanici@mail.com" />
            </div>
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={subeId} onValueChange={setSubeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Şube seçin" />
                </SelectTrigger>
                <SelectContent>
                  {subeler.map(sube => (
                    <SelectItem key={sube.id} value={sube.id}>{sube.ad}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Hesap tipi</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Kullanıcı</SelectItem>
                    <SelectItem value="admin">Yönetici</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vardiya</Label>
                <Select value={vardiya} onValueChange={setVardiya}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Hepsi</SelectItem>
                    <SelectItem value="S">Sabah</SelectItem>
                    <SelectItem value="A">Akşam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={createUser} disabled={savingUser} className="w-full gap-2">
              <Plus className="h-4 w-4" />
              {savingUser ? "Oluşturuluyor..." : "Kullanıcı Oluştur"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Şubeler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={newSubeName} onChange={(event) => setNewSubeName(event.target.value)} placeholder="Yeni şube adı" />
              <Button onClick={addBranch} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {subeler.map(sube => (
                <div key={sube.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">{sube.ad}</p>
                    <p className="text-xs text-muted-foreground">{sube.kod}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteBranch(sube.id, sube.ad)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kullanıcılar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">E-posta</th>
                  <th className="p-3 text-left">Rol</th>
                  <th className="p-3 text-left">Şube</th>
                  <th className="p-3 text-left">Vardiya</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.user_id} className="border-b">
                    <td className="p-3">{user.email || "-"}</td>
                    <td className="p-3">{user.is_admin ? "Yönetici" : "Kullanıcı"}</td>
                    <td className="p-3">{user.subeler?.ad || "-"}</td>
                    <td className="p-3">{user.vardiya || "Hepsi"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

