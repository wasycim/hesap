"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { BellPlus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const pageLinks = [
  { label: "Genel Bakis", href: "/dashboard" },
  { label: "Mesai", href: "/dashboard/mesai" },
  { label: "Mesai Takip", href: "/dashboard/mesai-takip" },
  { label: "Vardiya", href: "/dashboard/vardiya" },
  { label: "Maaslar", href: "/dashboard/maaslar" },
  { label: "Bildirimler", href: "/dashboard/bildirimler" },
  { label: "Cay", href: "/dashboard/cay" },
]

export default function BildirimGonderPage() {
  const [users, setUsers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [targetType, setTargetType] = useState("admins")
  const [userId, setUserId] = useState("")
  const [subeId, setSubeId] = useState("")
  const [title, setTitle] = useState("Hesap bildirimi")
  const [body, setBody] = useState("")
  const [href, setHref] = useState("/dashboard/bildirimler")
  const [level, setLevel] = useState("info")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || [])
        setBranches(data.branches || [])
      })
      .catch(() => undefined)
  }, [])

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast.error("Baslik ve mesaj zorunlu.")
      return
    }
    setBusy(true)
    const response = await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, userId, subeId, title, body, href, level, sendPush: true }),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      toast.error(result.error || "Bildirim gonderilemedi.")
      return
    }
    toast.success(`${result.recipients || 0} kisiye bildirim gonderildi.`)
    setBody("")
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-black tracking-normal">Bildirim Gonder</h1>
        <p className="text-sm text-muted-foreground">Link yazmak yerine hedef sayfayi listeden secin.</p>
      </header>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellPlus className="h-5 w-5" /> Yeni bildirim</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Hedef
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admins">Yoneticiler</SelectItem>
                  <SelectItem value="branch">Sube</SelectItem>
                  <SelectItem value="user">Tek kullanici</SelectItem>
                  <SelectItem value="all">Tum kullanicilar</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {targetType === "branch" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Sube
                <Select value={subeId} onValueChange={setSubeId}>
                  <SelectTrigger><SelectValue placeholder="Sube sec" /></SelectTrigger>
                  <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.ad}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            ) : null}
            {targetType === "user" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Kullanici
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Kullanici sec" /></SelectTrigger>
                  <SelectContent>{users.map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.display_name || user.email || user.user_id}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Sayfa
              <Select value={href} onValueChange={setHref}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{pageLinks.map((item) => <SelectItem key={item.href} value={item.href}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_180px]">
            <label className="grid gap-1.5 text-sm font-medium">
              Baslik
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Seviye
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Bilgi</SelectItem>
                  <SelectItem value="success">Basarili</SelectItem>
                  <SelectItem value="warning">Uyari</SelectItem>
                  <SelectItem value="error">Kritik</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Mesaj
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} />
          </label>
          <Button onClick={submit} disabled={busy} className="w-fit gap-2">
            <Send className="h-4 w-4" />
            {busy ? "Gonderiliyor..." : "Bildirim gonder"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
