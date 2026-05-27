"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Building2, KeyRound, Plus, Trash2, UserCog, UserPlus, UserX } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"

interface AdminUser {
  user_id: string
  email: string | null
  tc_kimlik?: string | null
  display_name?: string | null
  trusted_ips?: string[]
  is_admin: boolean
  dashboard_access?: boolean
  sube_id: string | null
  vardiya: string | null
  subeler?: { ad?: string } | null
}

interface ConfirmState {
  title: string
  description: string
  action: () => void
}

function formatVardiya(value: string | null) {
  if (value === "S") return "Sabah"
  if (value === "A") return "Akşam"
  return "Tek vardiya"
}

function formatAccountType(user: AdminUser) {
  if (user.dashboard_access === false) return "Sadece Mesai"
  return user.is_admin ? "Yönetici" : "Kullanıcı"
}

function getBranchDeleteErrorMessage(error: { code?: string; message?: string }) {
  const message = error.message || ""
  if (error.code === "23503" || message.includes("user_profiles_sube_id_fkey")) {
    return "Şube silinemez, şubeye bağlı kullanıcılar var."
  }

  return "Şube silinemedi. Lütfen güvenlik kayıtlarındaki hata detayını kontrol edin."
}

export default function AdminAyarlarPage() {
  const { subeler, isAdmin } = useSube()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [email, setEmail] = useState("")
  const [tcKimlik, setTcKimlik] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [subeId, setSubeId] = useState("")
  const [role, setRole] = useState("user")
  const [vardiya, setVardiya] = useState("T")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [editSubeId, setEditSubeId] = useState("")
  const [editDisplayName, setEditDisplayName] = useState("")
  const [editTcKimlik, setEditTcKimlik] = useState("")
  const [editTrustedIps, setEditTrustedIps] = useState("")
  const [editRole, setEditRole] = useState("user")
  const [editVardiya, setEditVardiya] = useState("T")
  const [newSubeName, setNewSubeName] = useState("")
  const [savingUser, setSavingUser] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingUser, setDeletingUser] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const supabase = createClient()

  const selectedUser = useMemo(
    () => users.find(user => user.user_id === selectedUserId) || null,
    [users, selectedUserId]
  )

  useEffect(() => {
    if (subeler.length > 0 && !subeId) setSubeId(subeler[0].id)
  }, [subeler, subeId])

  useEffect(() => {
    if (isAdmin) loadUsers()
  }, [isAdmin])

  useEffect(() => {
    if (!selectedUser) return
    setEditDisplayName(selectedUser.display_name || "")
    setEditTcKimlik(selectedUser.tc_kimlik || "")
    setEditTrustedIps((selectedUser.trusted_ips || []).join(", "))
    setEditSubeId(selectedUser.sube_id || subeler[0]?.id || "")
    setEditRole(selectedUser.dashboard_access === false ? "attendance_only" : selectedUser.is_admin ? "admin" : "user")
    setEditVardiya(selectedUser.vardiya || "T")
  }, [selectedUser, subeler])

  async function loadUsers() {
    const response = await fetch("/api/admin/users")
    const result = await response.json()
    setUsers(result.users || [])
  }

  async function createUser() {
    if (tcKimlik.replace(/\D/g, "").length !== 11 || !subeId || !displayName.trim() || password.length < 6) {
      toast.error("İsim soyisim, TC, şifre ve şube zorunlu.")
      return
    }

    setSavingUser(true)
    setMessage(null)
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        tcKimlik,
        displayName,
        password,
        subeId,
        isAdmin: role === "admin",
        dashboardAccess: role !== "attendance_only",
        vardiya,
      }),
    })
    const result = await response.json()

    if (!response.ok) {
      const text = result.error || "Kullanıcı oluşturulamadı."
      setMessage(text)
      toast.error(text)
      setSavingUser(false)
      return
    }

    setEmail("")
    setTcKimlik("")
    setPassword("")
    setDisplayName("")
    setRole("user")
    setVardiya("T")
    setMessage("Kullanıcı oluşturuldu.")
    toast.success("Değişiklikler kaydedildi ✅")
    setSavingUser(false)
    loadUsers()
  }

  async function updateUser() {
    if (!selectedUserId || editTcKimlik.replace(/\D/g, "").length !== 11 || !editSubeId || !editDisplayName.trim()) {
      toast.error("Düzenlenecek kullanıcı, TC ve şube zorunlu.")
      return
    }

    setSavingEdit(true)
    setMessage(null)
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: selectedUserId,
        displayName: editDisplayName,
        tcKimlik: editTcKimlik,
        trustedIps: editTrustedIps,
        subeId: editSubeId,
        isAdmin: editRole === "admin",
        dashboardAccess: editRole !== "attendance_only",
        vardiya: editVardiya,
      }),
    })
    const result = await response.json()

    if (!response.ok) {
      const text = result.error || "Kullanıcı güncellenemedi."
      setMessage(text)
      toast.error(text)
      setSavingEdit(false)
      return
    }

    toast.success("Değişiklikler kaydedildi ✅")
    setSavingEdit(false)
    loadUsers()
  }

  async function deleteUser() {
    if (!selectedUser) {
      toast.error("Silinecek kullanıcı seçin.")
      return
    }

    const userLabel = selectedUser.email || selectedUser.user_id
    setConfirmState({
      title: "Kullanıcı silinsin mi?",
      description: `${userLabel} kullanıcısını silmek istediğinizden emin misiniz? Bu işlem kritik olarak kaydedilecek.`,
      action: () => performDeleteUser(selectedUser.user_id),
    })
  }

  async function performDeleteUser(userId: string) {
    setDeletingUser(true)
    setMessage(null)
    const response = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    const result = await response.json()

    if (!response.ok) {
      const text = result.error || "Kullanıcı silinemedi."
      setMessage(text)
      toast.error(text)
      setDeletingUser(false)
      return
    }

    setSelectedUserId("")
    setMessage("Kullanıcı silindi.")
    toast.success("Değişiklikler kaydedildi ✅")
    setDeletingUser(false)
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
      toast.success("Değişiklikler kaydedildi ✅")
      window.location.reload()
    } else {
      setMessage(error.message)
      toast.error(error.message)
    }
  }

  async function deleteBranch(id: string, name: string) {
    setConfirmState({
      title: "Şube silinsin mi?",
      description: `${name} şubesini silmek istediğinizden emin misiniz?`,
      action: () => performDeleteBranch(id, name),
    })
  }

  async function performDeleteBranch(id: string, name: string) {
    const { error } = await supabase.from("subeler").delete().eq("id", id)
    if (!error) {
      await logSecurityEvent("branch_delete", { sube_id: id, ad: name })
      toast.success("Değişiklikler kaydedildi ✅")
      window.location.reload()
    } else {
      const friendlyMessage = getBranchDeleteErrorMessage(error)
      await logSecurityEvent("branch_delete_failed", {
        sube_id: id,
        ad: name,
        reason: friendlyMessage,
        error_message: error.message,
        error_code: error.code,
        error_details: error.details,
        error_hint: error.hint,
      })
      setMessage(friendlyMessage)
      toast.error(friendlyMessage)
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
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Ayarları</h1>
        <p className="text-sm text-muted-foreground">Kullanıcı, yetki, vardiya ve şube yönetimi.</p>
      </div>

      {message && <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Kullanıcı Oluştur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>E-posta (opsiyonel)</Label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="test.kullanici@mail.com" />
            </div>
            <div className="space-y-2">
              <Label>Görünen ad</Label>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Örn. Murat Yılmaz" />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input
                value={tcKimlik}
                onChange={(event) => setTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="11 haneli TC"
                inputMode="numeric"
                maxLength={11}
              />
            </div>
            <div className="space-y-2">
              <Label>Şifre</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pl-9"
                  type="password"
                  placeholder="En az 6 karakter"
                  autoComplete="new-password"
                />
              </div>
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
                    <SelectItem value="attendance_only">Sadece Mesai</SelectItem>
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
                    <SelectItem value="T">Tek vardiya</SelectItem>
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
              <UserCog className="h-5 w-5" />
              Kullanıcı Düzenle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Kullanıcı</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Kullanıcı seçin" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.user_id} value={user.user_id}>
                      {user.display_name || user.email || user.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Görünen ad</Label>
              <Input value={editDisplayName} onChange={(event) => setEditDisplayName(event.target.value)} placeholder="Sol menüde görünecek ad" disabled={!selectedUser} />
            </div>
            <div className="space-y-2">
              <Label>TC Kimlik No</Label>
              <Input
                value={editTcKimlik}
                onChange={(event) => setEditTcKimlik(event.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="11 haneli TC"
                inputMode="numeric"
                maxLength={11}
                disabled={!selectedUser}
              />
            </div>
            <div className="space-y-2">
              <Label>Güvenilir IP</Label>
              <Input
                value={editTrustedIps}
                onChange={(event) => setEditTrustedIps(event.target.value)}
                placeholder="88.230.254.101, 192.168.1.10"
                disabled={!selectedUser}
              />
              <p className="text-xs text-muted-foreground">Birden fazla IP için virgül, boşluk veya yeni satır kullanabilirsiniz.</p>
            </div>
            <div className="space-y-2">
              <Label>Şube</Label>
              <Select value={editSubeId} onValueChange={setEditSubeId} disabled={!selectedUser}>
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
                <Label>Yetki</Label>
                <Select value={editRole} onValueChange={setEditRole} disabled={!selectedUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Kullanıcı</SelectItem>
                    <SelectItem value="admin">Yönetici</SelectItem>
                    <SelectItem value="attendance_only">Sadece Mesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vardiya</Label>
                <Select value={editVardiya} onValueChange={setEditVardiya} disabled={!selectedUser}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="T">Tek vardiya</SelectItem>
                    <SelectItem value="S">Sabah</SelectItem>
                    <SelectItem value="A">Akşam</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={updateUser} disabled={!selectedUser || savingEdit} className="w-full gap-2">
              <UserCog className="h-4 w-4" />
              {savingEdit ? "Kaydediliyor..." : "Kullanıcıyı Güncelle"}
            </Button>
            <Button
              onClick={deleteUser}
              disabled={!selectedUser || deletingUser}
              variant="destructive"
              className="w-full gap-2"
            >
              <UserX className="h-4 w-4" />
              {deletingUser ? "Siliniyor..." : "Kullanıcıyı Sil"}
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
          <div className="mobile-scroll overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">E-posta</th>
                  <th className="p-3 text-left">TC</th>
                  <th className="p-3 text-left">Görünen ad</th>
                  <th className="p-3 text-left">Rol</th>
                  <th className="p-3 text-left">Şube</th>
                  <th className="p-3 text-left">Erişim</th>
                  <th className="p-3 text-left">Vardiya</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.user_id} className="border-b">
                    <td className="p-3">{user.email || "-"}</td>
                    <td className="p-3">{user.tc_kimlik || "-"}</td>
                    <td className="p-3">{user.display_name || "-"}</td>
                    <td className="p-3">{formatAccountType(user)}</td>
                    <td className="p-3">{user.subeler?.ad || "-"}</td>
                    <td className="p-3">{user.dashboard_access === false ? "Sadece Mesai" : "Dashboard"}</td>
                    <td className="p-3">{formatVardiya(user.vardiya)}</td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedUserId(user.user_id)}
                        title="Kullanıcıyı düzenle"
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent className="animate-modal-pop rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                const action = confirmState?.action
                setConfirmState(null)
                action?.()
              }}
            >
              Tamam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
