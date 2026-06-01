"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Coffee, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

export default function CayPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myItems, setMyItems] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [targetType, setTargetType] = useState("users")
  const [userId, setUserId] = useState("")
  const [subeId, setSubeId] = useState("")
  const [message, setMessage] = useState("Cay hazir mi?")
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    const response = await fetch("/api/tea", { cache: "no-store" })
    const data = await response.json().catch(() => ({}))
    setLoading(false)
    if (!response.ok) {
      toast.error(data.error || "Cay bilgileri yuklenemedi.")
      return
    }
    setIsAdmin(Boolean(data.isAdmin))
    setMyItems(data.myItems || [])
    setRequests(data.requests || [])
    setUsers(data.users || [])
    setBranches(data.branches || [])
  }

  useEffect(() => {
    load()
  }, [])

  const openItems = useMemo(() => myItems.filter((item) => item.response === "pending" && item.tea_requests?.status === "open"), [myItems])

  async function createTeaRequest() {
    setBusy(true)
    const response = await fetch("/api/tea", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, userIds: userId ? [userId] : [], subeId, message }),
    })
    const data = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) {
      toast.error(data.error || "Cay bildirimi gonderilemedi.")
      return
    }
    toast.success(`${data.recipients || 0} kisiye cay bildirimi gitti.`)
    load()
  }

  async function respond(id: string, responseValue: "ready" | "not_ready") {
    const response = await fetch("/api/tea", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, response: responseValue }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      toast.error(data.error || "Cevap kaydedilemedi.")
      return
    }
    toast.success("Cevap yoneticiye iletildi.")
    load()
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header>
        <h1 className="text-2xl font-black tracking-normal">Cay</h1>
        <p className="text-sm text-muted-foreground">Yoneticiler cay hazir mi diye sorar; kullanicilar tek tikla cevaplar.</p>
      </header>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Cay bildirimi gonder</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[200px_1fr_1fr_auto] lg:items-end">
            <label className="grid gap-1.5 text-sm font-medium">
              Hedef
              <Select value={targetType} onValueChange={setTargetType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="users">Tek kullanici</SelectItem>
                  <SelectItem value="branch">Sube</SelectItem>
                  <SelectItem value="all">Tum kullanicilar</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {targetType === "users" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Kullanici
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger><SelectValue placeholder="Kullanici sec" /></SelectTrigger>
                  <SelectContent>{users.map((user) => <SelectItem key={user.user_id} value={user.user_id}>{user.display_name || user.email || user.user_id}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            ) : null}
            {targetType === "branch" ? (
              <label className="grid gap-1.5 text-sm font-medium">
                Sube
                <Select value={subeId} onValueChange={setSubeId}>
                  <SelectTrigger><SelectValue placeholder="Sube sec" /></SelectTrigger>
                  <SelectContent>{branches.map((branch) => <SelectItem key={branch.id} value={branch.id}>{branch.ad}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            ) : null}
            <label className="grid gap-1.5 text-sm font-medium">
              Mesaj
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} />
            </label>
            <Button onClick={createTeaRequest} disabled={busy} className="gap-2">
              <Send className="h-4 w-4" />
              Gonder
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bana gelenler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <p className="text-sm text-muted-foreground">Yukleniyor...</p> : null}
            {openItems.length === 0 ? <p className="text-sm text-muted-foreground">Bekleyen cay bildirimi yok.</p> : null}
            {openItems.map((item) => (
              <div key={item.id} className="rounded-xl border p-4">
                <p className="font-bold">{item.tea_requests?.title || "Cay hazir mi?"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.tea_requests?.message}</p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => respond(item.id, "ready")} className="bg-emerald-600 hover:bg-emerald-700">Hazir</Button>
                  <Button onClick={() => respond(item.id, "not_ready")} variant="outline">Hazir degil</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader>
              <CardTitle>Son cay durumlari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((request) => {
                const recipients = request.tea_request_recipients || []
                const ready = recipients.filter((item: any) => item.response === "ready").length
                const notReady = recipients.filter((item: any) => item.response === "not_ready").length
                const pending = recipients.filter((item: any) => item.response === "pending").length
                return (
                  <div key={request.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold">{request.message}</p>
                        <p className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleString("tr-TR")}</p>
                      </div>
                      <Badge>{request.status}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline">Hazir: {ready}</Badge>
                      <Badge variant="secondary">Hazir degil: {notReady}</Badge>
                      <Badge variant="outline">Bekleyen: {pending}</Badge>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  )
}
