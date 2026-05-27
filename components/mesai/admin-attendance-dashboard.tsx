"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Clock3, FileText, LogOut, Moon, QrCode, Search, Sun, TimerReset, UserRound } from "lucide-react"
import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { openPdfReport } from "@/lib/pdf-report"

type DashboardProps = {
  adminName: string
}

type Shift = {
  id: string
  name: string
  symbol?: string
  label: string
}

type Branch = {
  id: string
  ad: string
  kod: string
}

type User = {
  id: string
  tcKimlik: string
  name: string
  role: "ADMIN" | "PERSONNEL"
  branch: Branch | null
  shift: Shift | null
}

type Log = {
  id: number
  checkInAt: string
  checkOutAt: string | null
  workDate: string
  lateMinutes: number
  overtimeMinutes: number
  status: "OPEN" | "CLOSED"
  user: {
    id: number
    name: string
    tcKimlik: string
  }
  shift: Shift | null
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function minutes(value: number) {
  if (!value) return "-"
  const hours = Math.floor(value / 60)
  const rest = value % 60
  return hours ? `${hours} sa ${rest} dk` : `${rest} dk`
}

function roleLabel(role: User["role"]) {
  return role === "PERSONNEL" ? "PERSONEL" : "ADMIN"
}

export function AdminAttendanceDashboard({ adminName }: DashboardProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [users, setUsers] = useState<User[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [branchId, setBranchId] = useState("all")
  const [shiftId, setShiftId] = useState("all")
  const [status, setStatus] = useState("all")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  async function loadStaticData() {
    const userParams = new URLSearchParams()
    userParams.set("date", from)
    if (branchId !== "all") userParams.set("subeId", branchId)

    const shiftParams = new URLSearchParams()
    if (branchId !== "all") shiftParams.set("subeId", branchId)

    const [usersResponse, shiftsResponse, branchesResponse] = await Promise.all([
      fetch(`/api/personel-mesai/users?${userParams.toString()}`),
      fetch(`/api/personel-mesai/shifts?${shiftParams.toString()}`),
      fetch("/api/personel-mesai/branches"),
    ])

    const usersPayload = await usersResponse.json().catch(() => ({}))
    const shiftsPayload = await shiftsResponse.json().catch(() => ({}))
    const branchesPayload = await branchesResponse.json().catch(() => ({}))
    setUsers(usersPayload.users ?? [])
    setShifts(shiftsPayload.shifts ?? [])
    setBranches(branchesPayload.branches ?? [])
  }

  async function loadLogs() {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (branchId !== "all") params.set("subeId", branchId)
    if (shiftId !== "all") params.set("shiftId", shiftId)
    if (status !== "all") params.set("status", status)

    const response = await fetch(`/api/personel-mesai/logs?${params.toString()}`)
    const payload = await response.json().catch(() => ({}))
    setLogs(payload.logs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadStaticData()
  }, [from, branchId])

  useEffect(() => {
    loadLogs()
  }, [from, to, branchId, shiftId, status])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("tr-TR")
    if (!normalized) return users
    return users.filter((user) => (
      user.name.toLocaleLowerCase("tr-TR").includes(normalized) ||
      user.tcKimlik.includes(normalized) ||
      Boolean(user.branch?.ad.toLocaleLowerCase("tr-TR").includes(normalized))
    ))
  }, [query, users])

  const totals = useMemo(() => {
    const open = logs.filter((log) => log.status === "OPEN").length
    const late = logs.filter((log) => log.lateMinutes > 0).length
    const overtime = logs.reduce((sum, log) => sum + log.overtimeMinutes, 0)
    return { open, late, overtime }
  }, [logs])

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.replace("/login")
    router.refresh()
  }

  function exportPdf() {
    const branchName = branches.find((branch) => branch.id === branchId)?.ad || "Tüm şubeler"
    openPdfReport({
      title: "Personel Mesai Raporu",
      subtitle: `${branchName} / ${from} - ${to}`,
      orientation: "landscape",
      metrics: [
        { label: "Kayıt", value: String(logs.length) },
        { label: "Açık Mesai", value: String(totals.open) },
        { label: "Geç Kalan", value: String(totals.late) },
        { label: "Fazla Mesai", value: minutes(totals.overtime) },
      ],
      tables: [
        {
          title: "Giriş Çıkış Listesi",
          headers: ["Personel", "TC", "Vardiya", "Tarih", "Giriş", "Çıkış", "Geç", "Fazla Mesai", "Durum"],
          firstColumnWidth: "18%",
          rows: logs.map((log) => [
            log.user.name,
            log.user.tcKimlik,
            log.shift?.label ?? "",
            formatDate(log.workDate),
            formatDateTime(log.checkInAt),
            formatDateTime(log.checkOutAt),
            minutes(log.lateMinutes),
            minutes(log.overtimeMinutes),
            log.status === "OPEN" ? "Açık" : "Kapalı",
          ]),
        },
      ],
    })
  }

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/92 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold tracking-normal">Personel Mesai</h1>
            <p className="text-sm text-muted-foreground">Admin: {adminName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" aria-label="Tema değiştir" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" className="gap-2" onClick={() => router.push("/terminal")}>
              <QrCode className="h-4 w-4" />
              Terminal
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="Çıkış" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserRound className="h-4 w-4" />
                Personel
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{users.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                Açık Mesai
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.open}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <TimerReset className="h-4 w-4" />
                Geç Kalan
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{totals.late}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Fazla Mesai
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-bold">{minutes(totals.overtime)}</CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Personel Listesi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Ad, TC veya şube ara" />
              </div>
              <div className="grid max-h-[560px] gap-2 overflow-auto pr-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className="rounded-md border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.branch?.ad ?? "Şube yok"}{user.tcKimlik !== "-" ? ` / ${user.tcKimlik}` : ""}</p>
                      </div>
                      <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{roleLabel(user.role)}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{user.shift ? `${user.shift.symbol ? `${user.shift.symbol} - ` : ""}${user.shift.label}` : "Vardiya atanmamış"}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Günlük Giriş Çıkışlar</CardTitle>
                <Button type="button" variant="outline" className="gap-2" onClick={exportPdf}>
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-5">
                <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">Tüm şubeler</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.ad}</option>
                  ))}
                </select>
                <select value={shiftId} onChange={(event) => setShiftId(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">Tüm vardiyalar</option>
                  {shifts.map((shift) => (
                    <option key={`${shift.id}-${shift.label}`} value={shift.id}>{shift.symbol ? `${shift.symbol} - ` : ""}{shift.label}</option>
                  ))}
                </select>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="all">Tüm kayıtlar</option>
                  <option value="late">Geç kalanlar</option>
                  <option value="overtime">Fazla mesai</option>
                  <option value="open">Açık mesailer</option>
                </select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personel</TableHead>
                      <TableHead>Vardiya</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Giriş</TableHead>
                      <TableHead>Çıkış</TableHead>
                      <TableHead>Geç</TableHead>
                      <TableHead>Fazla Mesai</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Yükleniyor</TableCell>
                      </TableRow>
                    ) : logs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Kayıt bulunamadı</TableCell>
                      </TableRow>
                    ) : logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium">{log.user.name}</div>
                          <div className="text-xs text-muted-foreground">{log.user.tcKimlik}</div>
                        </TableCell>
                        <TableCell>{log.shift?.label ?? "-"}</TableCell>
                        <TableCell>{formatDate(log.workDate)}</TableCell>
                        <TableCell>{formatDateTime(log.checkInAt)}</TableCell>
                        <TableCell>{formatDateTime(log.checkOutAt)}</TableCell>
                        <TableCell>{minutes(log.lateMinutes)}</TableCell>
                        <TableCell>{minutes(log.overtimeMinutes)}</TableCell>
                        <TableCell>
                          <Badge variant={log.status === "OPEN" ? "default" : "secondary"}>
                            {log.status === "OPEN" ? "Açık" : "Kapalı"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser?.name}</DialogTitle>
            <DialogDescription>Personel TC ve şifresiyle giriş yapar; kendi kamerasıyla /terminal ekranındaki 30 saniyede bir yenilenen QR kodu okutur.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-md border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Şube</span>
              <span className="font-medium">{selectedUser?.branch?.ad ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">TC</span>
              <span className="font-medium">{selectedUser?.tcKimlik ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Vardiya</span>
              <span className="font-medium">{selectedUser?.shift?.label ?? "-"}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
