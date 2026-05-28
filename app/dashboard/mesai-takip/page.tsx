"use client"

import { useEffect, useMemo, useState } from "react"
import { format, parseISO } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarDays, ChevronDown, FileText, Filter, RefreshCw, TimerReset, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { openPdfReport } from "@/lib/pdf-report"

type Branch = { id: string; ad: string; kod: string }

type BranchSummary = {
  branch: Branch
  personelCount: number
  logCount: number
  openCount: number
  beforeShiftMinutes: number
  earlyMinutes: number
  lateMinutes: number
  afterShiftMinutes: number
  overtimeMinutes: number
  workedMinutes: number
}

type PersonelSummary = {
  personelId: string
  name: string
  tcKimlik: string | null
  branch: Branch | null
  logCount: number
  openCount: number
  beforeShiftMinutes: number
  earlyMinutes: number
  lateMinutes: number
  afterShiftMinutes: number
  overtimeMinutes: number
  workedMinutes: number
}

type Detail = {
  id: number
  personel: string
  tcKimlik: string
  branch: Branch | null
  workDate: string
  checkInAt: string
  checkOutAt: string | null
  workedMinutes: number
  beforeShiftMinutes: number
  earlyMinutes: number
  lateMinutes: number
  afterShiftMinutes: number
  overtimeMinutes: number
  status: "OPEN" | "CLOSED"
  shift: { id: string; name: string; label: string } | null
}

type Payload = {
  range: { from: string; to: string }
  branches: Branch[]
  branchSummaries: BranchSummary[]
  personelSummaries: PersonelSummary[]
  details: Detail[]
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
}

function monthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(new Date(value))
}

function formatTime(value: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value))
}

function minutes(value: number) {
  if (!value) return "-"
  const hours = Math.floor(value / 60)
  const rest = value % 60
  if (!hours) return `${rest} dk`
  return rest ? `${hours} sa ${rest} dk` : `${hours} sa`
}

function WarningBadges({
  beforeShiftMinutes,
  earlyMinutes,
  lateMinutes,
  afterShiftMinutes,
  overtimeMinutes,
}: {
  beforeShiftMinutes: number
  earlyMinutes: number
  lateMinutes: number
  afterShiftMinutes: number
  overtimeMinutes: number
}) {
  if (!beforeShiftMinutes && !earlyMinutes && !lateMinutes && !afterShiftMinutes && !overtimeMinutes) {
    return <span className="text-muted-foreground">Sorun yok</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {beforeShiftMinutes > 0 && (
        <Badge variant="outline" className="border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
          Vardiya öncesi {minutes(beforeShiftMinutes)}
        </Badge>
      )}
      {earlyMinutes > 0 && (
        <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">
          Erken {minutes(earlyMinutes)}
        </Badge>
      )}
      {lateMinutes > 0 && (
        <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
          Geç {minutes(lateMinutes)}
        </Badge>
      )}
      {afterShiftMinutes > 0 && afterShiftMinutes !== overtimeMinutes && (
        <Badge variant="outline" className="border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300">
          Mesai sonrası {minutes(afterShiftMinutes)}
        </Badge>
      )}
      {overtimeMinutes > 0 && (
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300">
          Net fazla {minutes(overtimeMinutes)}
        </Badge>
      )}
    </div>
  )
}

function DetailStatusBadge({ status }: { status: "OPEN" | "CLOSED" }) {
  if (status === "OPEN") {
    return (
      <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        Devam ediyor
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
      Tamamlandı
    </Badge>
  )
}

export default function MesaiTakipPage() {
  const { isAdmin, loading: subeLoading } = useSube()
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(today())
  const [selectedSubeId, setSelectedSubeId] = useState("all")
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!subeLoading && isAdmin) loadData()
    if (!subeLoading && !isAdmin) setLoading(false)
  }, [subeLoading, isAdmin, from, to, selectedSubeId])

  async function loadData() {
    setLoading(true)
    const params = new URLSearchParams({ from, to })
    if (selectedSubeId !== "all") params.set("subeId", selectedSubeId)

    const response = await fetch(`/api/dashboard/mesai-takip?${params.toString()}`)
    const data = await response.json().catch(() => ({}))
    setPayload(response.ok ? data : null)
    setLoading(false)
  }

  const totals = useMemo(() => {
    const branchSummaries = payload?.branchSummaries || []
    return {
      personel: branchSummaries.reduce((sum, item) => sum + item.personelCount, 0),
      open: branchSummaries.reduce((sum, item) => sum + item.openCount, 0),
      overtime: branchSummaries.reduce((sum, item) => sum + item.overtimeMinutes, 0),
      late: branchSummaries.reduce((sum, item) => sum + item.lateMinutes, 0),
    }
  }, [payload])

  const overtimePeople = useMemo(() => (
    (payload?.personelSummaries || [])
      .filter((personel) => personel.overtimeMinutes > 0)
      .sort((a, b) => b.overtimeMinutes - a.overtimeMinutes)
  ), [payload])

  function exportPdf() {
    if (!payload) return
    const branchName = selectedSubeId === "all"
      ? "Tüm şubeler"
      : payload.branches.find((branch) => branch.id === selectedSubeId)?.ad || "Şube"

    openPdfReport({
      title: "Mesai Takip Raporu",
      subtitle: `${branchName} / ${from} - ${to}`,
      orientation: "landscape",
      metrics: [
        { label: "Personel", value: String(totals.personel) },
        { label: "Fazla Mesai", value: minutes(totals.overtime) },
        { label: "Geç Kalma", value: minutes(totals.late) },
      ],
      tables: [
        {
          title: "Şube Özeti",
          headers: ["Şube", "Personel", "Açık", "Vardiya Öncesi", "Erken Giriş", "Geç Kalma", "Mesai Sonrası", "Net Fazla", "Çalışma"],
          rows: payload.branchSummaries.map((item) => [
            item.branch.ad,
            item.personelCount,
            item.openCount,
            minutes(item.beforeShiftMinutes),
            minutes(item.earlyMinutes),
            minutes(item.lateMinutes),
            minutes(item.afterShiftMinutes),
            minutes(item.overtimeMinutes),
            minutes(item.workedMinutes),
          ]),
        },
        {
          title: "Personel Özeti",
          headers: ["Personel", "Şube", "Açık", "Vardiya Öncesi", "Erken Giriş", "Geç Kalma", "Mesai Sonrası", "Net Fazla", "Çalışma"],
          rows: payload.personelSummaries.map((item) => [
            item.name,
            item.branch?.ad || "-",
            item.openCount,
            minutes(item.beforeShiftMinutes),
            minutes(item.earlyMinutes),
            minutes(item.lateMinutes),
            minutes(item.afterShiftMinutes),
            minutes(item.overtimeMinutes),
            minutes(item.workedMinutes),
          ]),
        },
        {
          title: "Gunluk Giris Cikis Listesi",
          headers: ["Tarih", "Personel", "Sube", "Vardiya", "Giris Saati", "Cikis Saati", "Calisma", "Uyari", "Sonuc"],
          rows: payload.details.map((item) => [
            formatDate(item.workDate),
            item.personel,
            item.branch?.ad || "-",
            item.shift?.label || "-",
            formatTime(item.checkInAt),
            formatTime(item.checkOutAt),
            minutes(item.workedMinutes),
            [
              item.beforeShiftMinutes > 0 ? `Vardiya oncesi: ${minutes(item.beforeShiftMinutes)}` : "",
              item.earlyMinutes > 0 ? `Erken: ${minutes(item.earlyMinutes)}` : "",
              item.lateMinutes > 0 ? `Gec: ${minutes(item.lateMinutes)}` : "",
              item.afterShiftMinutes > 0 ? `Mesai sonrasi: ${minutes(item.afterShiftMinutes)}` : "",
              item.overtimeMinutes > 0 ? `Net fazla: ${minutes(item.overtimeMinutes)}` : "",
            ].filter(Boolean).join(" / ") || "-",
            item.status === "OPEN" ? "Cikis bekliyor" : "Tamamlandi",
          ]),
        },
      ],
    })
  }

  if (!subeLoading && !isAdmin) {
    return (
      <main className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Bu sayfa yalnızca yöneticiler tarafından görüntülenebilir.</CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <RefreshAnimationStyle />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-normal">Mesai Takip</h1>
          <p className="mt-1 text-sm text-muted-foreground">Şube bazlı giriş, çıkış, geç kalma ve fazla mesai takibi.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={exportPdf} disabled={!payload}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtreler
          </CardTitle>
        </CardHeader>
        <CardContent className="grid items-end gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_minmax(190px,1fr)_minmax(210px,1fr)_150px]">
          <DatePicker label="Başlangıç" value={from} onChange={setFrom} />
          <DatePicker label="Bitiş" value={to} onChange={setTo} />
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            Şube
            <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
              <SelectTrigger className="h-11 rounded-xl bg-background/80 px-3 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm şubeler</SelectItem>
                {(payload?.branches || []).map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.ad}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
            İşlem
            <Button type="button" variant="secondary" className="h-11 rounded-xl gap-2 shadow-sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 shrink-0 ${loading ? "animate-[mesai-refresh-spin_700ms_linear_infinite] text-emerald-600" : ""}`} />
              Yenile
            </Button>
          </label>
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<UsersRound className="h-4 w-4" />} label="Personel" value={String(totals.personel)} />
        <Metric icon={<TimerReset className="h-4 w-4" />} label="Fazla Mesai" value={minutes(totals.overtime)} />
        <Metric icon={<CalendarDays className="h-4 w-4" />} label="Geç Kalma" value={minutes(totals.late)} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Şube Özeti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor</p>
            ) : (payload?.branchSummaries || []).map((item) => (
              <div key={item.branch.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.branch.ad}</p>
                    <p className="text-xs text-muted-foreground">{item.personelCount} personel</p>
                  </div>
                  <span className={item.overtimeMinutes > 0 ? "font-bold text-amber-600" : "font-bold text-muted-foreground"}>
                    {minutes(item.overtimeMinutes)}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fazla Mesai Yapanlar</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor</p>
            ) : overtimePeople.length === 0 ? (
              <p className="rounded-lg border p-4 text-sm text-muted-foreground">Seçili aralıkta fazla mesai yok.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/70 text-left">
                    <tr>
                      <th className="p-3">Personel</th>
                      <th className="p-3">Şube</th>
                      <th className="p-3">Geç</th>
                      <th className="p-3">Fazla Mesai</th>
                      <th className="p-3">Çalışma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overtimePeople.map((item) => (
                      <tr key={item.personelId} className="border-t">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.branch?.ad || "-"}</td>
                        <td className="p-3">{minutes(item.lateMinutes)}</td>
                        <td className="p-3 font-bold text-amber-600">{minutes(item.overtimeMinutes)}</td>
                        <td className="p-3">{minutes(item.workedMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Günlük Giriş Çıkış Listesi</CardTitle>
          <p className="text-sm text-muted-foreground">
            Her satır bir personelin o günkü giriş-çıkış durumunu gösterir. Açık mesai satırlarında çıkış beklenir.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="p-3">Tarih</th>
                  <th className="p-3">Personel</th>
                  <th className="p-3">Planlanan Vardiya</th>
                  <th className="p-3">Giriş</th>
                  <th className="p-3">Çıkış</th>
                  <th className="p-3">Çalışma</th>
                  <th className="p-3">Uyarı</th>
                  <th className="p-3">Sonuç</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Yükleniyor</td></tr>
                ) : (payload?.details || []).length === 0 ? (
                  <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Seçili aralıkta giriş çıkış bulunamadı</td></tr>
                ) : payload?.details.map((item) => (
                  <tr key={item.id} className={`border-t ${item.status === "OPEN" ? "bg-amber-500/5" : ""}`}>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{formatDate(item.workDate)}</td>
                    <td className="p-3">
                      <div className="font-medium">{item.personel}</div>
                      <div className="text-xs text-muted-foreground">{item.branch?.ad || "Şube yok"}</div>
                    </td>
                    <td className="p-3">
                      <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-medium">
                        {item.shift?.label || "Vardiya yok"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-emerald-600 dark:text-emerald-400">{formatTime(item.checkInAt)}</div>
                      <div className="text-xs text-muted-foreground">Giriş yapıldı</div>
                    </td>
                    <td className="p-3">
                      {item.checkOutAt ? (
                        <>
                          <div className="font-semibold text-sky-600 dark:text-sky-400">{formatTime(item.checkOutAt)}</div>
                          <div className="text-xs text-muted-foreground">Çıkış yapıldı</div>
                        </>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          Çıkış bekliyor
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 font-semibold">{minutes(item.workedMinutes)}</td>
                    <td className="p-3">
                      <WarningBadges
                        beforeShiftMinutes={item.beforeShiftMinutes}
                        earlyMinutes={item.earlyMinutes}
                        lateMinutes={item.lateMinutes}
                        afterShiftMinutes={item.afterShiftMinutes}
                        overtimeMinutes={item.overtimeMinutes}
                      />
                    </td>
                    <td className="p-3">
                      <DetailStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

function DatePicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const selected = parseISO(value)

  return (
    <label className="grid gap-1.5 text-xs font-semibold text-muted-foreground">
      {label}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-between rounded-xl bg-background/80 px-3 text-left font-normal shadow-sm"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/12 text-amber-700 dark:text-amber-300">
                <CalendarDays className="h-4 w-4" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {format(selected, "d MMMM yyyy", { locale: tr })}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
          <div className="bg-slate-950 px-4 py-3 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold">{label} tarihi</div>
                <div className="mt-0.5 text-xs text-white/65">{format(selected, "d MMMM yyyy", { locale: tr })}</div>
              </div>
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                <CalendarDays className="h-4 w-4" />
              </div>
            </div>
          </div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) onChange(format(date, "yyyy-MM-dd"))
            }}
            locale={tr}
            className="rounded-xl p-3 [--cell-size:--spacing(9)]"
          />
        </PopoverContent>
      </Popover>
    </label>
  )
}

function RefreshAnimationStyle() {
  return (
    <style jsx global>{`
      @keyframes mesai-refresh-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  )
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {icon}
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-bold">{value}</CardContent>
    </Card>
  )
}

