"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  DollarSign,
  Download,
  FileSpreadsheet,
  Filter,
  Layers,
  Percent,
  PieChart as PieIcon,
  Store,
  TrendingUp,
} from "lucide-react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { createClient } from "@/lib/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSube } from "@/contexts/sube-context"
import { getLocalDateString } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"

interface Firma {
  id: string
  sube_id: string
  ad: string
  komisyon_orani: number | null
  color: string
}

interface GelirKaydi {
  sube_id: string
  tarih: string
  vardiya: string | null
  custom_values: Record<string, number>
}

type Period = "daily" | "weekly" | "monthly" | "custom"

const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

const COLOR_MAP: Record<string, string> = {
  "bg-emerald-500": "#10b981",
  "bg-blue-500": "#3b82f6",
  "bg-indigo-500": "#6366f1",
  "bg-purple-500": "#a855f7",
  "bg-pink-500": "#ec4899",
  "bg-amber-500": "#f59e0b",
  "bg-rose-500": "#f43f5e",
  "bg-cyan-500": "#06b6d4",
  "bg-orange-500": "#f97316",
  "bg-teal-500": "#14b8a6",
  "bg-red-500": "#ef4444",
  "bg-sky-500": "#0ea5e9",
  "bg-violet-500": "#8b5cf6",
}

const DEFAULT_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
  "#ef4444",
  "#8b5cf6",
]

function getFirmaHexColor(colorClass?: string, index = 0): string {
  if (!colorClass) return DEFAULT_COLORS[index % DEFAULT_COLORS.length]
  return COLOR_MAP[colorClass] || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
}

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function getMonthStart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function getShiftLabel(value: string | null) {
  if (value === "S") return "Sabah"
  if (value === "A") return "Akşam"
  return "Tek Vardiya"
}

function compareDateVardiya(a: Pick<GelirKaydi, "tarih" | "vardiya">, b: Pick<GelirKaydi, "tarih" | "vardiya">) {
  const dateCompare = a.tarih.localeCompare(b.tarih)
  if (dateCompare !== 0) return dateCompare
  return (VARDIYA_SIRASI[a.vardiya || ""] ?? 99) - (VARDIYA_SIRASI[b.vardiya || ""] ?? 99)
}

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function CustomPieTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const color = payload[0].color || payload[0].fill
    return (
      <div className="rounded-xl border bg-popover/95 p-3 shadow-xl backdrop-blur-md text-popover-foreground text-xs space-y-1.5 min-w-[170px]">
        <div className="flex items-center gap-2 font-bold text-sm">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
          <span className="truncate">{data.name}</span>
        </div>
        <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatMoney(data.value)} ₺
        </div>
        {data.komisyon !== undefined && (
          <div className="flex justify-between gap-4 text-muted-foreground pt-1 border-t border-border/50">
            <span>Komisyon:</span>
            <span className="font-semibold text-foreground">{formatMoney(data.komisyon)} ₺</span>
          </div>
        )}
        {data.percentage !== undefined && (
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>Ciro Payı:</span>
            <span className="font-semibold text-foreground">%{Number(data.percentage).toFixed(1)}</span>
          </div>
        )}
      </div>
    )
  }
  return null
}

function CustomAreaTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border bg-popover/95 p-3 shadow-xl backdrop-blur-md text-popover-foreground text-xs space-y-1.5 min-w-[180px]">
        <div className="font-bold text-xs text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" />
          {label}
        </div>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex justify-between gap-4 items-center">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}:
            </span>
            <span className="font-bold text-foreground">{formatMoney(Number(item.value))} ₺</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function SubeCiroRaporlariPage() {
  const supabase = createClient()
  const { subeler, isAdmin, loading: subeLoading } = useSube()
  const today = getLocalDateString()
  const [period, setPeriod] = useState<Period>("monthly")
  const [startDate, setStartDate] = useState(getMonthStart(new Date()))
  const [endDate, setEndDate] = useState(today)
  const [selectedSubeId, setSelectedSubeId] = useState("all")
  const [selectedFirmaId, setSelectedFirmaId] = useState("all")
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [rows, setRows] = useState<GelirKaydi[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("firma")
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const now = new Date()
    if (period === "daily") {
      setStartDate(today)
      setEndDate(today)
    } else if (period === "weekly") {
      const start = new Date()
      start.setDate(start.getDate() - 6)
      setStartDate(getLocalDateString(start))
      setEndDate(today)
    } else if (period === "monthly") {
      setStartDate(getMonthStart(now))
      setEndDate(today)
    }
  }, [period, today])

  useEffect(() => {
    if (!subeLoading && isAdmin) loadData()
  }, [subeLoading, isAdmin, selectedSubeId, startDate, endDate])

  async function loadData() {
    setLoading(true)

    let firmaQuery = supabase
      .from("gelir_firmalar")
      .select("id, sube_id, ad, komisyon_orani, color")
      .eq("aktif", true)
      .order("sira", { ascending: true })

    let gelirQuery = supabase
      .from("gelir_kayitlari")
      .select("sube_id, tarih, vardiya, custom_values")
      .gte("tarih", startDate)
      .lte("tarih", endDate)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true })

    if (selectedSubeId !== "all") {
      firmaQuery = firmaQuery.eq("sube_id", selectedSubeId)
      gelirQuery = gelirQuery.eq("sube_id", selectedSubeId)
    }

    const [firmaRes, gelirRes] = await Promise.all([firmaQuery, gelirQuery])
    setFirmalar(firmaRes.data || [])
    setRows(
      (gelirRes.data || [])
        .map((row) => ({
          ...row,
          custom_values: row.custom_values || {},
        }))
        .sort(compareDateVardiya)
    )
    setLoading(false)
  }

  const firmaMap = useMemo(() => new Map(firmalar.map((firma) => [firma.id, firma])), [firmalar])

  const filteredFirmalar = useMemo(
    () => (selectedFirmaId === "all" ? firmalar : firmalar.filter((firma) => firma.id === selectedFirmaId)),
    [firmalar, selectedFirmaId]
  )

  const reportRows = useMemo(() => {
    return rows.flatMap((row) =>
      filteredFirmalar
        .map((firma) => {
          const satis = Number(row.custom_values?.[`firma_${firma.id}`]) || 0
          const oran = Number(firma.komisyon_orani) || 0
          return {
            sube_id: row.sube_id,
            firma_id: firma.id,
            tarih: row.tarih,
            vardiya: row.vardiya,
            satis,
            komisyon: (satis * oran) / 100,
          }
        })
        .filter((item) => item.satis > 0)
    )
  }, [rows, filteredFirmalar])

  const totals = useMemo(
    () =>
      reportRows.reduce(
        (acc, row) => ({
          satis: acc.satis + row.satis,
          komisyon: acc.komisyon + row.komisyon,
        }),
        { satis: 0, komisyon: 0 }
      ),
    [reportRows]
  )

  const netHakedis = Math.max(0, totals.satis - totals.komisyon)
  const avgKomisyonOrani = totals.satis > 0 ? (totals.komisyon / totals.satis) * 100 : 0

  const subeSummaries = useMemo(
    () =>
      subeler
        .filter((sube) => selectedSubeId === "all" || sube.id === selectedSubeId)
        .map((sube) => {
          const subeRows = reportRows.filter((row) => row.sube_id === sube.id)
          return {
            sube,
            satis: subeRows.reduce((sum, row) => sum + row.satis, 0),
            komisyon: subeRows.reduce((sum, row) => sum + row.komisyon, 0),
          }
        })
        .filter((item) => item.satis > 0 || selectedSubeId !== "all"),
    [reportRows, selectedSubeId, subeler]
  )

  const firmaSummaries = useMemo(
    () =>
      filteredFirmalar
        .map((firma) => {
          const firmaRows = reportRows.filter((row) => row.firma_id === firma.id)
          return {
            firma,
            satis: firmaRows.reduce((sum, row) => sum + row.satis, 0),
            komisyon: firmaRows.reduce((sum, row) => sum + row.komisyon, 0),
          }
        })
        .filter((item) => item.satis > 0 || selectedFirmaId !== "all"),
    [filteredFirmalar, reportRows, selectedFirmaId]
  )

  const detailRows = useMemo(
    () =>
      reportRows.map((row) => ({
        ...row,
        subeAd: subeler.find((sube) => sube.id === row.sube_id)?.ad || "-",
        firma: firmaMap.get(row.firma_id),
      })),
    [reportRows, subeler, firmaMap]
  )

  // Visual Chart Data Processing
  const firmaChartData = useMemo(() => {
    return firmaSummaries
      .filter((item) => item.satis > 0)
      .map((item, idx) => ({
        name: item.firma.ad,
        value: item.satis,
        komisyon: item.komisyon,
        percentage: totals.satis > 0 ? (item.satis / totals.satis) * 100 : 0,
        color: getFirmaHexColor(item.firma.color, idx),
        id: item.firma.id,
      }))
      .sort((a, b) => b.value - a.value)
  }, [firmaSummaries, totals.satis])

  const subeChartData = useMemo(() => {
    return subeSummaries
      .filter((item) => item.satis > 0)
      .map((item, idx) => ({
        name: item.sube.ad,
        ciro: item.satis,
        komisyon: item.komisyon,
        net: item.satis - item.komisyon,
        percentage: totals.satis > 0 ? (item.satis / totals.satis) * 100 : 0,
        color: DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
      }))
      .sort((a, b) => b.ciro - a.ciro)
  }, [subeSummaries, totals.satis])

  const trendChartData = useMemo(() => {
    const map = new Map<string, { ciro: number; komisyon: number }>()
    reportRows.forEach((r) => {
      const existing = map.get(r.tarih) || { ciro: 0, komisyon: 0 }
      map.set(r.tarih, {
        ciro: existing.ciro + r.satis,
        komisyon: existing.komisyon + r.komisyon,
      })
    })

    return Array.from(map.entries())
      .map(([date, data]) => ({
        tarih: formatDate(date),
        rawDate: date,
        Ciro: data.ciro,
        Komisyon: data.komisyon,
        Net: data.ciro - data.komisyon,
      }))
      .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
  }, [reportRows])

  const vardiyaChartData = useMemo(() => {
    const map = new Map<string, { ciro: number; komisyon: number }>()
    reportRows.forEach((r) => {
      const shiftKey = getShiftLabel(r.vardiya)
      const existing = map.get(shiftKey) || { ciro: 0, komisyon: 0 }
      map.set(shiftKey, {
        ciro: existing.ciro + r.satis,
        komisyon: existing.komisyon + r.komisyon,
      })
    })

    return Array.from(map.entries()).map(([name, data], idx) => ({
      name,
      value: data.ciro,
      komisyon: data.komisyon,
      percentage: totals.satis > 0 ? (data.ciro / totals.satis) * 100 : 0,
      color: idx === 0 ? "#10b981" : idx === 1 ? "#3b82f6" : "#f59e0b",
    }))
  }, [reportRows, totals.satis])

  function exportCsv() {
    const lines: unknown[][] = [
      ["Şube Ciro Raporları"],
      ["Rapor Aralığı", `${formatDate(startDate)} - ${formatDate(endDate)}`],
      ["Toplam Satış", `${formatMoney(totals.satis)} TL`],
      ["Toplam Komisyon", `${formatMoney(totals.komisyon)} TL`],
      ["Net Firma Hakedişi", `${formatMoney(netHakedis)} TL`],
      [],
      ["Şube Özetleri"],
      ["Şube", "Toplam Satış", "Toplam Komisyon"],
      ...subeSummaries.map((item) => [
        item.sube.ad,
        `${formatMoney(item.satis)} TL`,
        `${formatMoney(item.komisyon)} TL`,
      ]),
      [],
      ["Firma Özetleri"],
      ["Firma", "Toplam Satış", "Toplam Komisyon"],
      ...firmaSummaries.map((item) => [
        item.firma.ad,
        `${formatMoney(item.satis)} TL`,
        `${formatMoney(item.komisyon)} TL`,
      ]),
      [],
      ["Detaylar"],
      ["Tarih", "Vardiya", "Şube", "Firma", "Toplam Satış", "Komisyon"],
      ...detailRows.map((row) => [
        formatDate(row.tarih),
        getShiftLabel(row.vardiya),
        row.subeAd,
        row.firma?.ad || "-",
        `${formatMoney(row.satis)} TL`,
        `${formatMoney(row.komisyon)} TL`,
      ]),
    ]
    const csv = lines
      .map((line) => line.map(escapeCsvValue).join(";"))
      .join("\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `sube-ciro-raporu-${startDate}-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    openPdfReport({
      title: "Şube Ciro Raporları ve Görsel Analizler",
      subtitle: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Satış", value: `${formatMoney(totals.satis)} TL` },
        { label: "Toplam Komisyon", value: `${formatMoney(totals.komisyon)} TL` },
        { label: "Net Firma Hakedişi", value: `${formatMoney(netHakedis)} TL` },
        { label: "Kayıt Sayısı", value: String(detailRows.length) },
      ],
      tables: [
        {
          title: "Şube Özetleri",
          headers: ["Şube", "Toplam Satış", "Toplam Komisyon"],
          firstColumnWidth: "45%",
          rows: subeSummaries.map((item) => [
            item.sube.ad,
            `${formatMoney(item.satis)} TL`,
            `${formatMoney(item.komisyon)} TL`,
          ]),
        },
        {
          title: "Firma Özetleri",
          headers: ["Firma", "Toplam Satış", "Komisyon Oranı", "Toplam Komisyon"],
          firstColumnWidth: "40%",
          rows: firmaSummaries.map((item) => [
            item.firma.ad,
            `${formatMoney(item.satis)} TL`,
            `%${item.firma.komisyon_orani ?? 0}`,
            `${formatMoney(item.komisyon)} TL`,
          ]),
        },
        {
          title: "Günlük ve Vardiya Detayı",
          headers: ["Tarih", "Vardiya", "Şube", "Firma", "Satış", "Komisyon"],
          firstColumnWidth: "82px",
          rows: detailRows.map((row) => [
            formatDate(row.tarih),
            getShiftLabel(row.vardiya),
            row.subeAd,
            row.firma?.ad || "-",
            `${formatMoney(row.satis)} TL`,
            `${formatMoney(row.komisyon)} TL`,
          ]),
        },
      ],
    })
  }

  if (subeLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Erişim engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  return (
    <div data-unsaved-ignore="true" className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            Şube Ciro Raporları & Görsel Analizler
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Firma bazlı ciro dağılımları, komisyon oranları, zaman serisi trendleri ve şube karşılaştırmaları.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportCsv} variant="outline" className="gap-2" disabled={detailRows.length === 0}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel (CSV)
          </Button>
          <Button onClick={exportPdf} variant="outline" className="gap-2" disabled={detailRows.length === 0}>
            <Download className="h-4 w-4 text-blue-600" />
            PDF Rapor
          </Button>
          <Button onClick={loadData} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Filter className="h-4 w-4" />
            Raporu Yenile
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-emerald-500/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-600" />
            Filtreleme ve Rapor Aralığı
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Günlük</SelectItem>
                <SelectItem value="weekly">Haftalık</SelectItem>
                <SelectItem value="monthly">Aylık</SelectItem>
                <SelectItem value="custom">Özel Tarih Aralığı</SelectItem>
              </SelectContent>
            </Select>
            <ModernDatePicker
              label="Başlangıç"
              value={startDate}
              onChange={(value) => {
                setPeriod("custom")
                setStartDate(value)
              }}
            />
            <ModernDatePicker
              label="Bitiş"
              value={endDate}
              onChange={(value) => {
                setPeriod("custom")
                setEndDate(value)
              }}
            />
            <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Şubeler</SelectItem>
                {subeler.map((sube) => (
                  <SelectItem key={sube.id} value={sube.id}>
                    {sube.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedFirmaId} onValueChange={setSelectedFirmaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Firmalar</SelectItem>
                {firmalar.map((firma) => (
                  <SelectItem key={firma.id} value={firma.id}>
                    {firma.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Firma Filter Badges */}
          {firmalar.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t text-xs">
              <span className="text-muted-foreground font-semibold mr-1">Hızlı Filtre:</span>
              <button
                type="button"
                onClick={() => setSelectedFirmaId("all")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  selectedFirmaId === "all"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-muted hover:bg-muted/80 text-muted-foreground"
                }`}
              >
                Tüm Firmalar ({firmalar.length})
              </button>
              {firmalar.map((firma, idx) => {
                const hex = getFirmaHexColor(firma.color, idx)
                const isSelected = selectedFirmaId === firma.id
                return (
                  <button
                    key={firma.id}
                    type="button"
                    onClick={() => setSelectedFirmaId(isSelected ? "all" : firma.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all border ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold shadow-sm"
                        : "border-transparent bg-muted/60 hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex }} />
                    <span>{firma.ad}</span>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Toplam Satış (Ciro)</p>
              <p className="text-2xl font-black tracking-tight text-emerald-800 dark:text-emerald-200">
                {formatMoney(totals.satis)} ₺
              </p>
              <p className="text-xs text-muted-foreground">{detailRows.length} İşlem / Satış Kaydı</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-blue-500/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Toplam Komisyon</p>
              <p className="text-2xl font-black tracking-tight text-blue-800 dark:text-blue-200">
                {formatMoney(totals.komisyon)} ₺
              </p>
              <p className="text-xs text-muted-foreground">Ort. Komisyon: %{avgKomisyonOrani.toFixed(1)}</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600">
              <Percent className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 bg-purple-500/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Firma Hakedişi</p>
              <p className="text-2xl font-black tracking-tight text-purple-800 dark:text-purple-200">
                {formatMoney(netHakedis)} ₺
              </p>
              <p className="text-xs text-muted-foreground">Ciro - Toplam Komisyon</p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-purple-500/10 text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-amber-500/5">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktif Rapor Aralığı</p>
              <p className="text-base font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-amber-600" />
                {formatDate(startDate)} - {formatDate(endDate)}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedSubeId === "all" ? "Tüm Şubeler" : subeler.find((s) => s.id === selectedSubeId)?.ad || "Şube"}
              </p>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Store className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Analytics Tabbed Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-2 rounded-xl border">
          <div className="flex items-center gap-2 px-2 font-bold text-sm">
            <PieIcon className="h-4 w-4 text-emerald-600" />
            Görsel Analitik Grafikler
          </div>
          <TabsList className="grid grid-cols-4 w-full sm:w-auto h-9">
            <TabsTrigger value="firma" className="text-xs gap-1.5">
              <PieIcon className="h-3.5 w-3.5" />
              Firma Pasta
            </TabsTrigger>
            <TabsTrigger value="trend" className="text-xs gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Ciro Trendi
            </TabsTrigger>
            <TabsTrigger value="sube" className="text-xs gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Şube Dağılımı
            </TabsTrigger>
            <TabsTrigger value="vardiya" className="text-xs gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Vardiya
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Firma Pasta & Çubuk Grafiği */}
        <TabsContent value="firma" className="space-y-4 m-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Firma Ciro Dağılımı (Pasta Grafik)</span>
                  <Badge variant="outline" className="font-normal text-xs">
                    %{totals.satis > 0 ? "100" : "0"} Pay
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {firmaChartData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Bu periyotta gösterilecek ciro verisi bulunamadı.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={firmaChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={105}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {firmaChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend
                            formatter={(value: string) => (
                              <span className="text-xs font-semibold text-foreground">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Firma Ciro Katkı Sıralaması</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {firmaSummaries.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Firma ciro kaydı bulunamadı.
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                    {firmaSummaries.map((item, idx) => {
                      const percentage = totals.satis > 0 ? (item.satis / totals.satis) * 100 : 0
                      const hex = getFirmaHexColor(item.firma.color, idx)
                      return (
                        <div key={item.firma.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: hex }} />
                              <span>{item.firma.ad}</span>
                              <span className="text-[11px] font-normal text-muted-foreground">
                                (%{item.firma.komisyon_orani ?? 0} komisyon)
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">%{percentage.toFixed(1)}</span>
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                {formatMoney(item.satis)} ₺
                              </span>
                            </div>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, percentage)}%`, backgroundColor: hex }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Ciro Trendi */}
        <TabsContent value="trend" className="space-y-4 m-0">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                Ciro Zaman Serisi Eğrisi ({startDate} / {endDate})
              </CardTitle>
              <Badge variant="outline" className="font-normal text-xs">
                {trendChartData.length} Günlük Veri
              </Badge>
            </CardHeader>
            <CardContent className="pt-4">
              {trendChartData.length === 0 ? (
                <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                  Zaman serisinde gösterilecek veri yok.
                </div>
              ) : (
                <div className="h-80 w-full">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendChartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="ciroGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                          <linearGradient id="komisyonGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="tarih" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                        <Tooltip content={<CustomAreaTooltip />} />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="Ciro"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#ciroGradient)"
                        />
                        <Area
                          type="monotone"
                          dataKey="Komisyon"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#komisyonGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Şube Dağılımı */}
        <TabsContent value="sube" className="space-y-4 m-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Şube Bazlı Ciro Karşılaştırması</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {subeChartData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Şube ciro verisi yok.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subeChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend />
                          <Bar dataKey="ciro" name="Toplam Satış (Ciro)" fill="#10b981" radius={[6, 6, 0, 0]} />
                          <Bar dataKey="komisyon" name="Komisyon Tutarı" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Şube Payı Pasta Grafiği</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {subeChartData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Gösterilecek veri yok.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={subeChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="ciro"
                          >
                            {subeChartData.map((entry, index) => (
                              <Cell key={`sube-cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend
                            formatter={(value: string) => (
                              <span className="text-xs font-semibold text-foreground">{value}</span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Vardiya Performansı */}
        <TabsContent value="vardiya" className="space-y-4 m-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vardiya Ciro Dağılımı (Sabah / Akşam)</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {vardiyaChartData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                    Vardiya verisi bulunamadı.
                  </div>
                ) : (
                  <div className="h-72 w-full">
                    {isMounted && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={vardiyaChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {vardiyaChartData.map((entry, index) => (
                              <Cell key={`var-cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomPieTooltip />} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Vardiya Ciro Karşılaştırması</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 space-y-4">
                {vardiyaChartData.map((v) => (
                  <div key={v.name} className="space-y-1.5 rounded-lg border p-3.5 bg-muted/20">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: v.color }} />
                        <span>{v.name}</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatMoney(v.value)} ₺</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Komisyon: {formatMoney(v.komisyon)} ₺</span>
                      <span className="font-semibold text-foreground">%{v.percentage.toFixed(1)} Pay</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, v.percentage)}%`, backgroundColor: v.color }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-600" />
                Şube Özetleri
              </span>
              <Badge variant="outline" className="font-normal text-xs">
                {subeSummaries.length} Şube
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {subeSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta satış yok.</p>
            ) : (
              subeSummaries.map((item) => (
                <div
                  key={item.sube.id}
                  className="flex items-center justify-between rounded-xl border p-3.5 bg-card hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <p className="font-bold text-sm">{item.sube.ad}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Satış {formatMoney(item.satis)} ₺</p>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatMoney(item.komisyon)} ₺</p>
                    <p className="text-[11px] text-muted-foreground">Komisyon</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-600" />
                Firma Özetleri
              </span>
              <Badge variant="outline" className="font-normal text-xs">
                {firmaSummaries.length} Firma
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {firmaSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta firma satışı yok.</p>
            ) : (
              firmaSummaries.map((item, idx) => {
                const hex = getFirmaHexColor(item.firma.color, idx)
                const isSelected = selectedFirmaId === item.firma.id
                return (
                  <button
                    key={item.firma.id}
                    type="button"
                    onClick={() => setSelectedFirmaId(isSelected ? "all" : item.firma.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                        : "bg-card hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-3.5 w-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: hex }} />
                      <div>
                        <p className="font-bold text-sm">{item.firma.ad}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Satış {formatMoney(item.satis)} ₺ · Oran %{item.firma.komisyon_orani ?? 0}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatMoney(item.komisyon)} ₺</p>
                      <p className="text-[11px] text-muted-foreground">Komisyon</p>
                    </div>
                  </button>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-emerald-600" />
            Günlük ve Vardiya Detayı ({detailRows.length} Kayıt)
          </CardTitle>
          <div className="flex items-center gap-2">
            {selectedFirmaId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFirmaId("all")}
                className="h-8 text-xs text-emerald-600 hover:text-emerald-700"
              >
                Filtreyi Temizle
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="sticky-table-scroll rounded-xl border overflow-hidden">
            <table className="sticky-table min-w-[860px] w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="sticky-date-first-column bg-muted/50 p-3 text-left">Tarih</th>
                  <th className="p-3 text-left">Şube</th>
                  <th className="sticky-shift-after-date-column bg-muted/50 p-3 text-left">Vardiya</th>
                  <th className="p-3 text-left">Firma</th>
                  <th className="p-3 text-right">Satış</th>
                  <th className="p-3 text-right">Oran</th>
                  <th className="p-3 text-right">Komisyon</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {detailRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Filtreye uygun detay bulunamadı.
                    </td>
                  </tr>
                ) : (
                  detailRows.map((row, index) => {
                    const hex = getFirmaHexColor(row.firma?.color, index)
                    return (
                      <tr key={`${row.firma_id}-${row.tarih}-${row.vardiya}-${index}`} className="hover:bg-muted/30 transition-colors">
                        <td className="sticky-date-first-column bg-card p-3 font-medium">{formatDate(row.tarih)}</td>
                        <td className="p-3 font-medium">{row.subeAd}</td>
                        <td className="sticky-shift-after-date-column bg-card p-3 font-medium">
                          <span className="px-2 py-0.5 rounded bg-muted text-xs font-semibold">
                            {getShiftLabel(row.vardiya)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-2 font-semibold">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                            {row.firma?.ad || "-"}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">{formatMoney(row.satis)} ₺</td>
                        <td className="p-3 text-right text-muted-foreground">%{row.firma?.komisyon_orani ?? 0}</td>
                        <td className="p-3 text-right font-extrabold text-emerald-600 dark:text-emerald-400">
                          {formatMoney(row.komisyon)} ₺
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
