"use client"

import { useEffect, useMemo, useState } from "react"
import { addDays, endOfMonth, endOfWeek, format, getDay, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { tr } from "date-fns/locale"
import { toast } from "sonner"
import { CalendarDays, ChevronLeft, ChevronRight, FileText, Save, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import { useSube } from "@/contexts/sube-context"
import { openPdfReport } from "@/lib/pdf-report"

type Personel = {
  id: string
  ad: string
  aktif: boolean
  sira: number
  sabit_vardiya?: string | null
}

type Assignment = {
  id?: string
  personel_id: string
  tarih: string
  vardiya: string
  notlar?: string | null
}

type CustomShift = {
  id: string
  ad: string
  simge?: string | null
  baslangic: string
  bitis: string
  aktif: boolean
  sira: number
}

type FixedShiftDefinition = {
  kod: string
  ad: string
  simge?: string | null
  baslangic: string | null
  bitis: string | null
  aktif: boolean
}

type ShiftOption = {
  id: string
  label: string
  short: string
  time: string
  className: string
}

type FilterMode = "day" | "week" | "month" | "custom"
type RangeEditing = "from" | "to"

const defaultShifts: ShiftOption[] = [
  { id: "S", label: "Sabah", short: "S", time: "06:00 - 16:00", className: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-100" },
  { id: "A", label: "Aksam", short: "A", time: "16:00 - 02:00", className: "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-100" },
  { id: "R", label: "Ara", short: "R", time: "11:00 - 21:00", className: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100" },
  { id: "I", label: "Izin", short: "I", time: "-", className: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200" },
]

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd")
}

function buildRangeDays(from: Date, to: Date) {
  const days = []
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    days.push(cursor)
  }
  return days
}

function dayLabel(day: Date) {
  return format(day, "d EEE", { locale: tr })
}

function rangeLabel(from: Date, to: Date) {
  if (dateKey(from) === dateKey(to)) return format(from, "d MMMM yyyy", { locale: tr })
  return `${format(from, "d MMM", { locale: tr })} - ${format(to, "d MMM yyyy", { locale: tr })}`
}

function ShiftLogo() {
  return (
    <div className="relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-violet-400/30 bg-slate-950 text-white shadow-sm">
      <div className="absolute inset-1 rounded-md bg-violet-500/15" />
      <div className="relative grid grid-cols-3 gap-0.5">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-white/30 animate-[shift-dot_1.8s_ease-in-out_infinite]"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </div>
      <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 text-amber-300" />
      <style jsx>{`
        @keyframes shift-dot {
          0%, 100% { background: rgba(255, 255, 255, .28); transform: scale(.82); }
          35% { background: #a7f3d0; transform: scale(1.16); box-shadow: 0 0 10px rgba(167, 243, 208, .72); }
        }
      `}</style>
    </div>
  )
}

function shortName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toLocaleUpperCase("tr-TR")
}

export default function VardiyaPage() {
  const supabase = createClient()
  const { currentSube } = useSube()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>("month")
  const [anchorDate, setAnchorDate] = useState(() => dateKey(new Date()))
  const [customFrom, setCustomFrom] = useState(() => dateKey(startOfMonth(new Date())))
  const [customTo, setCustomTo] = useState(() => dateKey(endOfMonth(new Date())))
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [rangeEditing, setRangeEditing] = useState<RangeEditing>("from")
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [fixedShifts, setFixedShifts] = useState<FixedShiftDefinition[]>([])
  const [customShifts, setCustomShifts] = useState<CustomShift[]>([])
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [dirtyAssignments, setDirtyAssignments] = useState<Record<string, string>>({})
  const [fixedShiftDrafts, setFixedShiftDrafts] = useState<Record<string, string>>({})
  const [dirtyFixedShifts, setDirtyFixedShifts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const selectedRange = useMemo(() => {
    const anchor = parseISO(anchorDate)
    if (filterMode === "day") return { from: anchor, to: anchor, label: rangeLabel(anchor, anchor), title: "Gunluk Plan" }
    if (filterMode === "week") {
      const from = startOfWeek(anchor, { weekStartsOn: 1 })
      const to = endOfWeek(anchor, { weekStartsOn: 1 })
      return { from, to, label: rangeLabel(from, to), title: "Haftalik Plan" }
    }
    if (filterMode === "custom") {
      const first = parseISO(customFrom)
      const last = parseISO(customTo)
      const from = customFrom <= customTo ? first : last
      const to = customFrom <= customTo ? last : first
      return { from, to, label: rangeLabel(from, to), title: "Secili Tarih Araligi" }
    }

    const from = startOfMonth(anchor)
    const to = endOfMonth(anchor)
    return { from, to, label: format(anchor, "LLLL yyyy", { locale: tr }), title: "Aylik Plan" }
  }, [anchorDate, customFrom, customTo, filterMode])
  const days = useMemo(() => buildRangeDays(selectedRange.from, selectedRange.to), [selectedRange])

  const shiftOptions = useMemo<ShiftOption[]>(() => [
    ...(fixedShifts.length ? fixedShifts.map((shift) => ({
      id: shift.kod,
      label: shift.ad,
      short: shift.simge?.trim() || shift.kod,
      time: shift.baslangic && shift.bitis ? `${shift.baslangic} - ${shift.bitis}` : "-",
      className: defaultShifts.find((item) => item.id === shift.kod)?.className || "border-slate-300 bg-slate-50 text-slate-700",
    })) : defaultShifts),
    ...customShifts.map((shift) => ({
      id: shift.id,
      label: shift.ad,
      short: shift.simge?.trim() || shortName(shift.ad),
      time: `${shift.baslangic} - ${shift.bitis}`,
      className: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-500/15 dark:text-sky-100",
    })),
  ], [customShifts, fixedShifts])

  const shiftById = useMemo(() => new Map(shiftOptions.map((shift) => [shift.id, shift])), [shiftOptions])

  useEffect(() => {
    async function checkAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsAdmin(false)
        return
      }

      const { data } = await supabase
        .from("user_profiles")
        .select("is_admin")
        .eq("user_id", user.id)
        .single()

      setIsAdmin(Boolean(data?.is_admin))
    }

    checkAdmin()
  }, [])

  useEffect(() => {
    if (currentSube && isAdmin) loadSchedule()
  }, [currentSube?.id, selectedRange.from, selectedRange.to, isAdmin])

  async function loadSchedule() {
    if (!currentSube) return

    setLoading(true)
    const params = new URLSearchParams({
      subeId: currentSube.id,
      from: dateKey(selectedRange.from),
      to: dateKey(selectedRange.to),
    })
    const response = await fetch(`/api/dashboard/vardiya?${params.toString()}`, {
      cache: "no-store",
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload.error || "Vardiya plani yuklenemedi.")
      setLoading(false)
      return
    }

    setPersoneller(payload.personeller || [])
    setFixedShifts(payload.fixedShiftDefinitions || [])
    setCustomShifts(payload.shiftDefinitions || [])
    setFixedShiftDrafts(Object.fromEntries((payload.personeller || []).map((personel: Personel) => [
      personel.id,
      personel.sabit_vardiya || "",
    ])))
    setAssignments(Object.fromEntries((payload.assignments || []).map((assignment: Assignment) => [
      `${assignment.tarih}__${assignment.personel_id}`,
      assignment.vardiya,
    ])))
    setDirtyAssignments({})
    setDirtyFixedShifts({})
    setLoading(false)
  }

  function getAssignment(day: Date, personelId: string) {
    const key = `${dateKey(day)}__${personelId}`
    return dirtyAssignments[key] ?? assignments[key] ?? fixedShiftDrafts[personelId] ?? ""
  }

  function setAssignment(day: Date, personelId: string, vardiya: string) {
    const key = `${dateKey(day)}__${personelId}`
    setDirtyAssignments((current) => ({ ...current, [key]: vardiya }))
  }

  function setFixedShift(personelId: string, vardiya: string) {
    setFixedShiftDrafts((current) => ({ ...current, [personelId]: vardiya }))
    setDirtyFixedShifts((current) => ({ ...current, [personelId]: vardiya }))
  }

  async function saveSchedule() {
    if (!currentSube) return

    setSaving(true)
    const response = await fetch("/api/dashboard/vardiya", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subeId: currentSube.id,
        assignments: Object.entries(dirtyAssignments).map(([key, vardiya]) => {
          const [tarih, personel_id] = key.split("__")
          return { tarih, personel_id, vardiya }
        }),
        fixedShifts: Object.entries(dirtyFixedShifts).map(([personel_id, sabit_vardiya]) => ({
          personel_id,
          sabit_vardiya,
        })),
      }),
    })
    const payload = await response.json().catch(() => ({}))
    setSaving(false)

    if (!response.ok) {
      toast.error(payload.error || "Vardiya plani kaydedilemedi.")
      return
    }

    toast.success("Vardiya plani kaydedildi.")
    await loadSchedule()
  }

  function exportPdf() {
    openPdfReport({
      title: "Vardiya Plani",
      subtitle: `${currentSube?.ad || "Sube"} - ${selectedRange.label}`,
      orientation: "landscape",
      metrics: [
        { label: "Personel", value: String(personeller.length) },
        { label: "Gun", value: String(days.length) },
        { label: "Vardiya Tipi", value: String(shiftOptions.length) },
      ],
      tables: [
        {
          title: selectedRange.title,
          firstColumnWidth: "18%",
          headers: ["Personel", "Sabit", ...days.map((day) => format(day, "d"))],
          rows: personeller.map((personel) => [
            personel.ad,
            shiftById.get(fixedShiftDrafts[personel.id] || "")?.label || "-",
            ...days.map((day) => {
              const shift = shiftById.get(getAssignment(day, personel.id))
              return shift ? shift.short : "-"
            }),
          ]),
        },
      ],
    })
  }

  function moveRange(direction: -1 | 1) {
    const anchor = parseISO(anchorDate)
    if (filterMode === "day") setAnchorDate(dateKey(addDays(anchor, direction)))
    if (filterMode === "week") setAnchorDate(dateKey(addDays(anchor, direction * 7)))
    if (filterMode === "month") setAnchorDate(dateKey(startOfMonth(addDays(direction > 0 ? endOfMonth(anchor) : startOfMonth(anchor), direction))))
    if (filterMode === "custom") {
      const span = Math.max(days.length, 1)
      setCustomFrom(dateKey(addDays(selectedRange.from, direction * span)))
      setCustomTo(dateKey(addDays(selectedRange.to, direction * span)))
    }
  }

  function selectSingleDate(date?: Date) {
    if (!date) return
    setAnchorDate(dateKey(date))
    setDatePickerOpen(false)
  }

  function selectRangeEndpoint(date?: Date) {
    if (!date) return
    const next = dateKey(date)

    if (rangeEditing === "from") {
      setCustomFrom(next)
      setRangeEditing("to")
    } else {
      setCustomTo(next)
    }
  }

  function selectPreset(nextMode: FilterMode) {
    const today = new Date()
    setFilterMode(nextMode)
    setAnchorDate(dateKey(today))
    if (nextMode === "custom") {
      setCustomFrom(dateKey(startOfMonth(today)))
      setCustomTo(dateKey(endOfMonth(today)))
      setRangeEditing("from")
    }
    setDatePickerOpen(false)
  }

  const hasChanges = Object.keys(dirtyAssignments).length > 0 || Object.keys(dirtyFixedShifts).length > 0

  if (isAdmin === false) {
    return (
      <div className="grid min-h-64 place-items-center p-6 text-center">
        <div>
          <h1 className="text-lg font-semibold">Erisim engellendi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vardiya planini sadece yoneticiler gorebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-background p-3 sm:p-4 lg:p-5">
      <div className="mx-auto flex max-w-7xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ShiftLogo />
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-normal">Vardiya</h1>
              <p className="truncate text-xs text-muted-foreground">Sabah 06:00-16:00 · Aksam 16:00-02:00 · Ara 11:00-21:00</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="hidden sm:inline-flex">{personeller.length} personel</Badge>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-card/90 p-1 shadow-sm">
              <Tabs value={filterMode} onValueChange={(value) => setFilterMode(value as FilterMode)}>
                <TabsList className="h-9 rounded-lg bg-muted/60 p-1">
                  <TabsTrigger value="day" className="rounded-md px-3 text-xs">Gunluk</TabsTrigger>
                  <TabsTrigger value="week" className="rounded-md px-3 text-xs">Haftalik</TabsTrigger>
                  <TabsTrigger value="month" className="rounded-md px-3 text-xs">Aylik</TabsTrigger>
                  <TabsTrigger value="custom" className="rounded-md px-3 text-xs">Aralik</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Onceki tarih" onClick={() => moveRange(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" className="h-9 min-w-[220px] justify-start gap-2 rounded-lg px-3 text-left">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                      <CalendarDays className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold uppercase leading-none text-muted-foreground">{selectedRange.title}</span>
                      <span className="block truncate text-xs font-bold leading-4">{selectedRange.label}</span>
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto overflow-hidden rounded-2xl border bg-card p-0 shadow-2xl">
                  <div className="bg-slate-950 px-4 py-3 text-white">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold">Tarih sec</div>
                        <div className="mt-0.5 text-xs text-white/65">{selectedRange.label}</div>
                      </div>
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-white/8 p-1">
                      <button type="button" onClick={() => selectPreset("day")} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12">Bugun</button>
                      <button type="button" onClick={() => selectPreset("week")} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12">Hafta</button>
                      <button type="button" onClick={() => selectPreset("month")} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12">Ay</button>
                      <button type="button" onClick={() => selectPreset("custom")} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/12">Aralik</button>
                    </div>
                  </div>
                  <div className="p-2">
                    {filterMode === "custom" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2 px-1">
                          <button
                            type="button"
                            onClick={() => setRangeEditing("from")}
                            className={`rounded-lg border px-3 py-2 text-left transition ${rangeEditing === "from" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted/35 hover:bg-muted"}`}
                          >
                            <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Baslangic</span>
                            <span className="block text-xs font-bold">{format(parseISO(customFrom), "d MMM yyyy", { locale: tr })}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRangeEditing("to")}
                            className={`rounded-lg border px-3 py-2 text-left transition ${rangeEditing === "to" ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted/35 hover:bg-muted"}`}
                          >
                            <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Bitis</span>
                            <span className="block text-xs font-bold">{format(parseISO(customTo), "d MMM yyyy", { locale: tr })}</span>
                          </button>
                        </div>
                        <Calendar
                          mode="single"
                          selected={parseISO(rangeEditing === "from" ? customFrom : customTo)}
                          onSelect={selectRangeEndpoint}
                          numberOfMonths={2}
                          locale={tr}
                          className="rounded-xl p-2 [--cell-size:--spacing(9)]"
                        />
                        <div className="px-2 pb-1 text-[11px] text-muted-foreground">
                          {rangeEditing === "from" ? "Baslangic tarihini sec; sonra otomatik bitise gececek." : "Bitis tarihini sec veya baslangici duzenlemek icin soldaki alana tikla."}
                        </div>
                      </div>
                    ) : (
                      <Calendar
                        mode="single"
                        selected={parseISO(anchorDate)}
                        onSelect={selectSingleDate}
                        locale={tr}
                        className="rounded-xl p-2 [--cell-size:--spacing(9)]"
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-lg" aria-label="Sonraki tarih" onClick={() => moveRange(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-2" onClick={exportPdf} disabled={!personeller.length}>
              <FileText className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button type="button" size="sm" className="h-8 gap-2" onClick={saveSchedule} disabled={saving || !hasChanges}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Kaydediliyor" : "Kaydet"}
            </Button>
          </div>
        </div>

        {!currentSube ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Once bir sube secin.</CardContent>
          </Card>
        ) : personeller.length === 0 && !loading ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Bu subede aktif personel yok.</CardContent>
          </Card>
        ) : (
          <div className="overflow-auto rounded-md border bg-card">
            <table className="w-full border-separate border-spacing-0 text-xs" style={{ minWidth: Math.max(640, 300 + days.length * 64) }}>
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-20 w-44 border-b border-r bg-muted/95 px-2 py-2 text-left font-semibold">Personel</th>
                  <th className="w-28 border-b border-r px-2 py-2 text-left font-semibold">Sabit</th>
                  {days.map((day) => {
                    const weekend = getDay(day) === 0 || getDay(day) === 6
                    return (
                      <th key={dateKey(day)} className={`w-16 border-b border-r px-1 py-2 text-center font-semibold ${weekend ? "bg-muted" : ""}`}>
                        <div>{format(day, "d")}</div>
                        <div className="text-[10px] font-medium text-muted-foreground">{format(day, "EEE", { locale: tr })}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {personeller.map((personel) => (
                  <tr key={personel.id} className="hover:bg-muted/30">
                    <td className="sticky left-0 z-10 max-w-44 border-b border-r bg-card px-2 py-1.5 font-medium">
                      <span className="block truncate" title={personel.ad}>{personel.ad}</span>
                    </td>
                    <td className="border-b border-r px-1 py-1">
                      <Select value={fixedShiftDrafts[personel.id] || "none"} onValueChange={(next) => setFixedShift(personel.id, next === "none" ? "" : next)}>
                        <SelectTrigger className="h-7 w-full px-2 text-[11px]">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Yok</SelectItem>
                          {shiftOptions.map((shift) => (
                            <SelectItem key={shift.id} value={shift.id}>{shift.label} · {shift.time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    {days.map((day) => {
                      const value = getAssignment(day, personel.id)
                      const shift = shiftById.get(value)
                      return (
                        <td key={dateKey(day)} className="border-b border-r p-1">
                          <Select value={value || "none"} onValueChange={(next) => setAssignment(day, personel.id, next === "none" ? "" : next)}>
                            <SelectTrigger
                              aria-label={`${personel.ad} ${dayLabel(day)} vardiyasi`}
                              className={`h-7 w-full justify-center px-1 text-[11px] font-semibold ${shift?.className || ""}`}
                            >
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Bos</SelectItem>
                              {shiftOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>{option.label} · {option.time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {shiftOptions.map((shift) => (
            <span key={shift.id} className={`rounded border px-2 py-0.5 font-semibold ${shift.className}`}>
              {shift.short} · {shift.label} {shift.time !== "-" ? shift.time : ""}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline">Sabit sütunu bu sayfadan yönetilir.</span>
        </div>
      </div>
    </div>
  )
}
