"use client"

import { useEffect, useMemo, useState } from "react"
import { 
  BarChart3, 
  CalendarDays, 
  ChevronDown, 
  Filter, 
  TrendingUp, 
  Sparkles, 
  Building2, 
  Calendar as CalendarIcon, 
  ArrowLeftRight, 
  Clock, 
  PieChart as PieIcon,
  HelpCircle,
  ChevronRight,
  TrendingDown,
  Building,
  Target,
  Search,
  BadgePercent
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { getLocalDateString, MONTHS } from "@/lib/date-navigation"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  AreaChart,
  Area
} from "recharts"

interface DbFirma {
  id: string
  sube_id: string
  ad: string
  color: string
}

interface Sube {
  id: string
  ad: string
  kod: string
}

interface GelirRecord {
  sube_id: string
  tarih: string
  vardiya: string | null
  pamukkale_turizm: number
  anadolu_ulasim: number
  inegol_seyahat: number
  alasehir_turizm: number
  unlu_1: number
  unlu_2: number
  pamukkale_kargo: number
  diger_komisyon: number
  custom_values: Record<string, number>
}

interface CompanyOption {
  key: string
  label: string
  type: "builtin" | "custom"
  color: string
  text: string
  isShared: boolean // Whether it is classified as one of the main shared/common firms
  mappings?: { sube_id: string; id: string }[] // For custom firms
}

type PeriodPreset = "bu_ay" | "gecen_ay" | "son_3_ay" | "son_6_ay" | "bu_yil" | "custom"

// Core list of built-in database columns. Shared status will be determined dynamically.
const BUILTIN_FIRMALAR: Omit<CompanyOption, "isShared">[] = [
  { key: "pamukkale_turizm", label: "Pamukkale Turizm", type: "builtin", color: "bg-red-500", text: "text-white" },
  { key: "anadolu_ulasim", label: "Anadolu Ulaşım", type: "builtin", color: "bg-blue-600", text: "text-white" },
  { key: "inegol_seyahat", label: "İnegöl Seyahat", type: "builtin", color: "bg-orange-500", text: "text-white" },
  { key: "alasehir_turizm", label: "Alaşehir Turizm", type: "builtin", color: "bg-yellow-500", text: "text-yellow-950" },
  { key: "unlu_1", label: "Ünlü 1", type: "builtin", color: "bg-teal-600", text: "text-white" },
  { key: "unlu_2", label: "Ünlü 2", type: "builtin", color: "bg-cyan-600", text: "text-white" },
  { key: "pamukkale_kargo", label: "Pamukkale Kargo", type: "builtin", color: "bg-rose-500", text: "text-white" },
  { key: "diger_komisyon", label: "Diğer Komisyon", type: "builtin", color: "bg-slate-500", text: "text-white" },
]

// Only these keys are explicitly flagged as the main "Ortak Firmalar"
const MAIN_SHARED_KEYS = new Set(["pamukkale_turizm", "anadolu_ulasim", "inegol_seyahat"])

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeFirmaName(name: string): string {
  return (name || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\s+/g, " ")
    .trim()
}

export default function PerformansAnaliziPage() {
  const supabase = createClient()
  const { subeler: contextSubeler, isAdmin, loading: subeLoading } = useSube()
  const today = getLocalDateString()

  // State definitions
  const [period, setPeriod] = useState<PeriodPreset>("bu_ay")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState(today)
  const [selectedSubeId, setSelectedSubeId] = useState<string>("all")
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>("pamukkale_turizm")
  const [dbFirmalar, setDbFirmalar] = useState<DbFirma[]>([])
  const [records, setRecords] = useState<GelirRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedSubeId, setExpandedSubeId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")

  // Set date ranges based on preset
  useEffect(() => {
    const now = new Date()
    const todayStr = getLocalDateString(now)
    if (period === "bu_ay") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      setStartDate(getLocalDateString(start))
      setEndDate(todayStr)
    } else if (period === "gecen_ay") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      setStartDate(getLocalDateString(start))
      setEndDate(getLocalDateString(end))
    } else if (period === "son_3_ay") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      setStartDate(getLocalDateString(start))
      setEndDate(todayStr)
    } else if (period === "son_6_ay") {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      setStartDate(getLocalDateString(start))
      setEndDate(todayStr)
    } else if (period === "bu_yil") {
      const start = new Date(now.getFullYear(), 0, 1)
      setStartDate(getLocalDateString(start))
      setEndDate(todayStr)
    }
  }, [period, today])

  // Load database entities
  useEffect(() => {
    if (!subeLoading && isAdmin && startDate && endDate) {
      loadData()
    }
  }, [subeLoading, isAdmin, startDate, endDate])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Fetch active custom firms from database
      const { data: dbFirmsRes, error: dbFirmsError } = await supabase
        .from("gelir_firmalar")
        .select("id, sube_id, ad, color")
        .eq("aktif", true)
        .order("sira", { ascending: true })

      if (dbFirmsError) throw dbFirmsError
      setDbFirmalar(dbFirmsRes || [])

      // 2. Fetch income records within selected dates
      const { data: recordsRes, error: recordsError } = await supabase
        .from("gelir_kayitlari")
        .select(`
          sube_id, 
          tarih, 
          vardiya, 
          pamukkale_turizm, 
          anadolu_ulasim, 
          inegol_seyahat, 
          alasehir_turizm, 
          unlu_1, 
          unlu_2, 
          pamukkale_kargo, 
          diger_komisyon, 
          custom_values
        `)
        .gte("tarih", startDate)
        .lte("tarih", endDate)
        .order("tarih", { ascending: true })

      if (recordsError) throw recordsError
      setRecords((recordsRes || []).map(row => ({
        ...row,
        custom_values: row.custom_values || {},
        pamukkale_turizm: Number(row.pamukkale_turizm) || 0,
        anadolu_ulasim: Number(row.anadolu_ulasim) || 0,
        inegol_seyahat: Number(row.inegol_seyahat) || 0,
        alasehir_turizm: Number(row.alasehir_turizm) || 0,
        unlu_1: Number(row.unlu_1) || 0,
        unlu_2: Number(row.unlu_2) || 0,
        pamukkale_kargo: Number(row.pamukkale_kargo) || 0,
        diger_komisyon: Number(row.diger_komisyon) || 0,
      })))
    } catch (err: any) {
      console.error("Error loading data:", err.message)
    } finally {
      setLoading(false)
    }
  }

  // 1. Compute list of all available companies (built-in + grouped custom ones)
  const availableCompanies = useMemo(() => {
    // Map builtin list to include isShared flag
    const list: CompanyOption[] = BUILTIN_FIRMALAR.map(c => ({
      ...c,
      isShared: MAIN_SHARED_KEYS.has(c.key)
    }))

    // Group custom firms from database by name
    const customGroups = new Map<string, { label: string; mappings: { sube_id: string; id: string }[]; color: string }>()

    dbFirmalar.forEach((firm) => {
      const normalized = normalizeFirmaName(firm.ad)
      if (!normalized) return

      // Don't add if it matches a builtin name
      const matchesBuiltin = BUILTIN_FIRMALAR.some(b => normalizeFirmaName(b.label) === normalized)
      if (matchesBuiltin) return

      const existing = customGroups.get(normalized)
      if (existing) {
        existing.mappings.push({ sube_id: firm.sube_id, id: firm.id })
      } else {
        customGroups.set(normalized, {
          label: firm.ad,
          mappings: [{ sube_id: firm.sube_id, id: firm.id }],
          color: firm.color || "bg-indigo-500"
        })
      }
    })

    // Sort custom companies by branch coverage count descending
    const sortedCustoms = Array.from(customGroups.entries())
      .map(([normKey, info]) => ({
        key: `custom_${normKey}`,
        label: info.label,
        type: "custom" as const,
        color: info.color,
        text: "text-white",
        mappings: info.mappings,
        coverageCount: info.mappings.length
      }))
      .sort((a, b) => b.coverageCount - a.coverageCount)

    sortedCustoms.forEach(c => {
      list.push({
        key: c.key,
        label: c.label,
        type: c.type,
        color: c.color,
        text: c.text,
        isShared: false, // Custom firms are never flagged as main shared ones by default
        mappings: c.mappings
      })
    })

    return list
  }, [dbFirmalar])

  // Filtered available companies based on search
  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return availableCompanies
    const term = normalizeFirmaName(searchTerm)
    return availableCompanies.filter(comp => normalizeFirmaName(comp.label).includes(term))
  }, [availableCompanies, searchTerm])

  // Selected company object
  const selectedCompany = useMemo(() => {
    return availableCompanies.find(c => c.key === selectedCompanyKey) || availableCompanies[0]
  }, [availableCompanies, selectedCompanyKey])

  // 2. Perform analytics aggregation per branch
  const analyticsData = useMemo(() => {
    if (!selectedCompany) return []

    return contextSubeler.map((sube) => {
      const subeRecords = records.filter(r => r.sube_id === sube.id)
      let totalCiro = 0
      let recordCount = 0
      const uniqueDays = new Set<string>()

      // Map to track monthly details
      const monthMap = new Map<string, { label: string; ciro: number; recordCount: number; uniqueDays: Set<string> }>()

      subeRecords.forEach((record) => {
        let val = 0
        if (selectedCompany.type === "builtin") {
          val = record[selectedCompany.key as keyof GelirRecord] as number || 0
        } else if (selectedCompany.type === "custom" && selectedCompany.mappings) {
          const mapping = selectedCompany.mappings.find(m => m.sube_id === sube.id)
          if (mapping) {
            val = Number(record.custom_values?.[`firma_${mapping.id}`]) || 0
          }
        }

        if (val > 0) {
          totalCiro += val
          recordCount++
          uniqueDays.add(record.tarih)

          // Group by month
          const date = new Date(record.tarih)
          if (!Number.isNaN(date.getTime())) {
            const yearStr = date.getFullYear()
            const monthStr = MONTHS[date.getMonth()]
            const label = `${monthStr} ${yearStr}`
            const sortKey = `${yearStr}-${String(date.getMonth() + 1).padStart(2, "0")}`

            const current = monthMap.get(sortKey) || { label, ciro: 0, recordCount: 0, uniqueDays: new Set<string>() }
            current.ciro += val
            current.recordCount++
            current.uniqueDays.add(record.tarih)
            monthMap.set(sortKey, current)
          }
        }
      })

      const monthlyBreakdown = Array.from(monthMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([sortKey, value]) => ({
          monthSortKey: sortKey,
          monthLabel: value.label,
          ciro: value.ciro,
          recordCount: value.recordCount,
          uniqueDaysCount: value.uniqueDays.size
        }))

      return {
        subeId: sube.id,
        subeAd: sube.ad,
        subeKod: sube.kod,
        totalCiro,
        averageDailyCiro: uniqueDays.size > 0 ? totalCiro / uniqueDays.size : 0,
        recordCount,
        uniqueDaysCount: uniqueDays.size,
        monthlyBreakdown
      }
    })
  }, [contextSubeler, records, selectedCompany])

  // Filtered branches list to show in UI
  const filteredAnalyticsData = useMemo(() => {
    if (selectedSubeId === "all") return analyticsData
    return analyticsData.filter(d => d.subeId === selectedSubeId)
  }, [analyticsData, selectedSubeId])

  // 3. Compute KPI Summaries
  const kpiData = useMemo(() => {
    let totalCiro = 0
    let totalActiveDays = 0
    let activeBranchesCount = 0
    let topBranch = { name: "-", ciro: 0, share: 0 }

    analyticsData.forEach((subeData) => {
      totalCiro += subeData.totalCiro
      totalActiveDays += subeData.uniqueDaysCount
      if (subeData.totalCiro > 0) {
        activeBranchesCount++
      }
    })

    // Find top branch
    let maxCiro = 0
    let bestBranchName = "-"
    analyticsData.forEach((subeData) => {
      if (subeData.totalCiro > maxCiro) {
        maxCiro = subeData.totalCiro
        bestBranchName = subeData.subeAd
      }
    })

    if (totalCiro > 0 && maxCiro > 0) {
      topBranch = {
        name: bestBranchName,
        ciro: maxCiro,
        share: (maxCiro / totalCiro) * 100
      }
    }

    return {
      totalCiro,
      activeBranchesCount,
      topBranch,
      dailyAverage: totalActiveDays > 0 ? totalCiro / totalActiveDays : 0
    }
  }, [analyticsData])

  // 4. Compute Charts Data
  const chartsData = useMemo(() => {
    // Sube comparison
    const subesComparison = analyticsData
      .filter(d => d.totalCiro > 0)
      .map(d => ({
        name: d.subeAd,
        ciro: d.totalCiro,
        formattedCiro: formatMoney(d.totalCiro)
      }))
      .sort((a, b) => b.ciro - a.ciro)

    // Monthly Trend
    const monthlyTrendMap = new Map<string, { monthLabel: string; ciro: number }>()

    analyticsData.forEach((subeData) => {
      if (selectedSubeId !== "all" && subeData.subeId !== selectedSubeId) return

      subeData.monthlyBreakdown.forEach((m) => {
        const current = monthlyTrendMap.get(m.monthSortKey) || { monthLabel: m.monthLabel, ciro: 0 }
        current.ciro += m.ciro
        monthlyTrendMap.set(m.monthSortKey, current)
      })
    })

    const monthlyTrend = Array.from(monthlyTrendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([sortKey, value]) => ({
        monthSortKey: sortKey,
        name: value.monthLabel,
        ciro: value.ciro,
        formattedCiro: formatMoney(value.ciro)
      }))

    return {
      subesComparison,
      monthlyTrend
    }
  }, [analyticsData, selectedSubeId])

  // Loading indicator for sube loading
  if (subeLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Şubeler yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Permission lock
  if (!isAdmin) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center max-w-md p-6 bg-card border rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 mb-4">
            <TrendingDown className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Erişim Engellendi</h2>
          <p className="text-muted-foreground mb-6">
            Bu sayfa şubelerin finansal performanslarını ve cirolarını karşılaştırdığı için yalnızca yöneticiler tarafından görüntülenebilir.
          </p>
          <Button onClick={() => window.history.back()} variant="outline" className="w-full">
            Geri Dön
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner group hover:scale-105 transition-transform">
            <BarChart3 className="h-6 w-6 group-hover:animate-[bounce_0.6s_ease-in-out_infinite]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Performans Analizi</h1>
            <p className="text-sm text-muted-foreground">Şubeler ve firmalar bazında ciro ve performans göstergeleri.</p>
          </div>
        </div>

        {/* Date presets & date pickers */}
        <div className="flex flex-wrap items-center gap-3">
          <Select value={period} onValueChange={(val) => setPeriod(val as PeriodPreset)}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl bg-card border shadow-sm">
              <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Periyot seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bu_ay">Bu Ay</SelectItem>
              <SelectItem value="gecen_ay">Geçen Ay</SelectItem>
              <SelectItem value="son_3_ay">Son 3 Ay</SelectItem>
              <SelectItem value="son_6_ay">Son 6 Ay</SelectItem>
              <SelectItem value="bu_yil">Bu Yıl</SelectItem>
              <SelectItem value="custom">Özel Tarih Aralığı</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-3 duration-300">
              <div className="w-[160px]">
                <ModernDatePicker
                  label="Başlangıç"
                  value={startDate}
                  onChange={setStartDate}
                />
              </div>
              <div className="w-[160px]">
                <ModernDatePicker
                  label="Bitiş"
                  value={endDate}
                  onChange={setEndDate}
                />
              </div>
            </div>
          )}

          <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
            <SelectTrigger className="w-[180px] h-11 rounded-xl bg-card border shadow-sm">
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Şube seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Şubeler</SelectItem>
              {contextSubeler.map((sube) => (
                <SelectItem key={sube.id} value={sube.id}>
                  Şube {sube.ad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* FIRM SELECTION PANEL */}
      <Card className="border border-border/60 bg-card/65 backdrop-blur-md shadow-sm overflow-hidden rounded-2xl">
        <CardHeader className="py-4 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-500" />
                Firma Seçimi
              </CardTitle>
              <CardDescription>Performansını analiz etmek istediğiniz firmayı seçin.</CardDescription>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Firma ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {filteredCompanies.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Arama kriterine uygun firma bulunamadı.
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* 1. ORTAK FİRMALAR (Main Shared Companies in Grid) */}
              {(!searchTerm.trim() || filteredCompanies.some(c => c.isShared)) && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3.5 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Ortak Firmalar (Ana Hatlar)
                  </div>
                  
                  {/* Grid Layout for Shared Companies */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {filteredCompanies.filter(c => c.isShared).map((comp) => {
                      const isSelected = selectedCompanyKey === comp.key
                      
                      // Custom brand styles
                      let customCardStyle = ""
                      let watermark = ""
                      if (isSelected) {
                        if (comp.key === "pamukkale_turizm") {
                          customCardStyle = "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20 border-transparent ring-2 ring-rose-500/20 scale-[1.03]"
                          watermark = "P"
                        } else if (comp.key === "anadolu_ulasim") {
                          customCardStyle = "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 border-transparent ring-2 ring-blue-600/20 scale-[1.03]"
                          watermark = "A"
                        } else if (comp.key === "inegol_seyahat") {
                          customCardStyle = "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/20 border-transparent ring-2 ring-amber-500/20 scale-[1.03]"
                          watermark = "İ"
                        }
                      } else {
                        if (comp.key === "pamukkale_turizm") {
                          customCardStyle = "bg-rose-500/5 hover:bg-rose-500/10 border-rose-500/15 text-rose-700 dark:text-rose-400 hover:scale-[1.01]"
                          watermark = "P"
                        } else if (comp.key === "anadolu_ulasim") {
                          customCardStyle = "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/15 text-blue-700 dark:text-blue-400 hover:scale-[1.01]"
                          watermark = "A"
                        } else if (comp.key === "inegol_seyahat") {
                          customCardStyle = "bg-amber-500/5 hover:bg-amber-500/10 border-amber-500/15 text-amber-700 dark:text-amber-400 hover:scale-[1.01]"
                          watermark = "İ"
                        }
                      }

                      return (
                        <button
                          key={comp.key}
                          onClick={() => {
                            setSelectedCompanyKey(comp.key)
                            setExpandedSubeId(null)
                          }}
                          className={`relative flex flex-col justify-between p-4 h-24 rounded-2xl border transition-all duration-300 text-left overflow-hidden cursor-pointer ${customCardStyle}`}
                        >
                          {/* Background Watermark Initial */}
                          <div className={`absolute -right-2 -bottom-6 text-7xl font-black select-none pointer-events-none transition-opacity duration-300 font-serif ${
                            isSelected ? "opacity-15 text-white" : "opacity-8 text-current"
                          }`}>
                            {watermark}
                          </div>

                          <div className="flex items-center justify-between w-full">
                            <span className={`h-3 w-3 rounded-full ${isSelected ? "bg-white" : comp.color} shrink-0`} />
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] px-1.5 py-0.5 border-none rounded-md leading-none font-bold uppercase tracking-wider ${
                                isSelected 
                                  ? "bg-white/20 text-white" 
                                  : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                              }`}
                            >
                              Ortak Firma
                            </Badge>
                          </div>
                          <div className="font-bold text-base leading-tight tracking-tight mt-auto z-10">
                            {comp.label}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 2. DİĞER FİRMALAR (Other builtin + dynamic firms) */}
              {(!searchTerm.trim() || filteredCompanies.some(c => !c.isShared)) && (
                <div className="border-t border-dashed pt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                    Diğer Firmalar
                  </div>
                  
                  {/* Flex wrapping pills for other/local companies */}
                  <div className="flex flex-wrap gap-2">
                    {filteredCompanies.filter(c => !c.isShared).map((comp) => {
                      const isSelected = selectedCompanyKey === comp.key
                      const isCustom = comp.type === "custom"
                      const coverage = comp.mappings?.length || 0
                      
                      return (
                        <button
                          key={comp.key}
                          onClick={() => {
                            setSelectedCompanyKey(comp.key)
                            setExpandedSubeId(null)
                          }}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition-all duration-300 relative group cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md scale-105 font-semibold"
                              : "bg-muted/30 hover:bg-muted border-border/60 hover:scale-[1.02] text-foreground/80"
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            isSelected 
                              ? "bg-white animate-pulse" 
                              : isCustom 
                                ? "bg-indigo-400 dark:bg-indigo-500" 
                                : comp.color
                          } shrink-0`} />
                          
                          <span className="font-medium">{comp.label}</span>
                          
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] px-1 py-0 border-none rounded-md leading-none ${
                              isSelected 
                                ? "bg-white/20 text-white" 
                                : isCustom 
                                  ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                                  : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {isCustom ? `${coverage} Şube` : "Yerleşik"}
                          </Badge>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </CardContent>
      </Card>

      {/* LOADING STATE FOR QUERIES */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
            <p className="text-sm text-muted-foreground">Veriler işleniyor...</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI METRICS OVERVIEW */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            
            {/* KPI 1: Toplam Ciro */}
            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-indigo-50/40 via-card to-card dark:from-indigo-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Toplam Ciro</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                  {formatMoney(kpiData.totalCiro)} TL
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  Seçilen filtrelerdeki genel toplam ciro.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-indigo-200 dark:text-indigo-950/40">
                  <TrendingUp className="h-full w-full" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 2: En Yüksek Ciro Yapan Şube */}
            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-emerald-50/40 via-card to-card dark:from-emerald-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">En Başarılı Şube</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {kpiData.topBranch.name}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <BadgePercent className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{formatMoney(kpiData.topBranch.ciro)} TL (%{kpiData.topBranch.share.toFixed(1)}) pay.</span>
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-emerald-200 dark:text-emerald-950/40">
                  <Building className="h-full w-full" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 3: Günlük Ortalama */}
            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-amber-50/40 via-card to-card dark:from-amber-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Günlük Ortalama Ciro</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {formatMoney(kpiData.dailyAverage)} TL
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <ArrowLeftRight className="h-3 w-3 shrink-0" />
                  İşlem gören takvim günlerinin günlük ciro ortalaması.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-amber-200 dark:text-amber-950/40">
                  <Sparkles className="h-full w-full" />
                </div>
              </CardContent>
            </Card>

            {/* KPI 4: Aktif Şubeler */}
            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-purple-50/40 via-card to-card dark:from-purple-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktif Şube Sayısı</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 font-mono">
                  {kpiData.activeBranchesCount} / {contextSubeler.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  Seçilen firmadan ciro bildiren şube sayısı.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-purple-200 dark:text-purple-950/40">
                  <PieIcon className="h-full w-full" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* VISUAL ANALYTICS SECTION (CHARTS) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            
            {/* Chart 1: Sube Comparison */}
            <Card className="border border-border/60 bg-card/75 backdrop-blur-md shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building className="h-4.5 w-4.5 text-indigo-500" />
                  Şube Performans Dağılımı
                </CardTitle>
                <CardDescription>Şubelerin toplam cirodaki payları ve karşılaştırmaları.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {chartsData.subesComparison.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    Bu periyotta ciro kaydı bulunmamaktadır.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                    
                    {/* Doughnut Chart */}
                    <div className="col-span-1 md:col-span-2 h-[260px] relative flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartsData.subesComparison}
                            dataKey="ciro"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                            animationDuration={800}
                          >
                            {chartsData.subesComparison.map((entry, index) => {
                              const colors = [
                                "rgb(79, 70, 229)", // Indigo 600
                                "rgb(16, 185, 129)", // Emerald 500
                                "rgb(245, 158, 11)", // Amber 500
                                "rgb(239, 68, 68)",  // Red 500
                                "rgb(168, 85, 247)", // Purple 500
                                "rgb(6, 182, 212)",  // Cyan 500
                                "rgb(236, 72, 153)", // Pink 500
                                "rgb(100, 116, 139)" // Slate 500
                              ]
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                            })}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                            contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="block text-[10px] uppercase font-bold text-muted-foreground leading-none">Toplam</span>
                        <span className="block text-sm font-black text-foreground mt-0.5">{formatMoney(kpiData.totalCiro).split(",")[0]} TL</span>
                      </div>
                    </div>

                    {/* Side Bar Comparison Chart */}
                    <div className="col-span-1 md:col-span-3 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartsData.subesComparison}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} fontSize={10} stroke="rgba(128,128,128,0.4)" />
                          <YAxis dataKey="name" type="category" width={65} fontSize={10} stroke="rgba(128,128,128,0.4)" />
                          <Tooltip
                            formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                            contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)" }}
                          />
                          <Bar dataKey="ciro" radius={[0, 8, 8, 0]} animationDuration={800}>
                            {chartsData.subesComparison.map((entry, index) => {
                              const colors = [
                                "rgb(79, 70, 229)", // Indigo 600
                                "rgb(16, 185, 129)", // Emerald 500
                                "rgb(245, 158, 11)", // Amber 500
                                "rgb(239, 68, 68)",  // Red 500
                                "rgb(168, 85, 247)", // Purple 500
                                "rgb(6, 182, 212)",  // Cyan 500
                                "rgb(236, 72, 153)", // Pink 500
                                "rgb(100, 116, 139)" // Slate 500
                              ]
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} fillOpacity={0.88} />
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chart 2: Monthly Trend */}
            <Card className="border border-border/60 bg-card/75 backdrop-blur-md shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                  Ciro Trendi (Zaman Serisi)
                </CardTitle>
                <CardDescription>
                  {selectedSubeId === "all" ? "Tüm şubelerin aylık ciro kırılımı." : `Şube ${contextSubeler.find(s => s.id === selectedSubeId)?.ad || ""} aylık ciro kırılımı.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {chartsData.monthlyTrend.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    Bu periyotta trend oluşturacak veri bulunmamaktadır.
                  </div>
                ) : (
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartsData.monthlyTrend}
                        margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="colorCiro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="rgb(99, 102, 241)" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="rgb(99, 102, 241)" stopOpacity={0.01}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" />
                        <XAxis dataKey="name" fontSize={10} stroke="rgba(128,128,128,0.4)" />
                        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} fontSize={10} stroke="rgba(128,128,128,0.4)" />
                        <Tooltip
                          formatter={(value: number) => [`${formatMoney(value)} TL`, "Toplam Ciro"]}
                          contentStyle={{ borderRadius: "12px", border: "1px solid var(--border)", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="ciro" 
                          stroke="rgb(99, 102, 241)" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorCiro)" 
                          animationDuration={900}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* DETAILED ANALYSIS TABLE CARD */}
          <Card className="border border-border/60 bg-card/65 backdrop-blur-md shadow-sm rounded-2xl">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4.5 w-4.5 text-indigo-500" />
                Şube Bazlı Detay Raporu
              </CardTitle>
              <CardDescription>
                Şubelerin ciro oranları, günlük ortalamalar ve takvim günü bazlı kırılımları. Satırlara tıklayarak vardiya detaylarını inceleyebilirsiniz.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                      <th className="p-4 w-12">Detay</th>
                      <th className="p-4">Şube Adı</th>
                      <th className="p-4 text-right">Toplam Ciro</th>
                      <th className="p-4 text-center max-w-[140px] hidden sm:table-cell">Ciro Dağılımı</th>
                      <th className="p-4 text-right hidden md:table-cell">Günlük Ortalama</th>
                      <th className="p-4 text-right hidden sm:table-cell">Gün Sayısı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm">
                    {filteredAnalyticsData
                      .sort((a, b) => b.totalCiro - a.totalCiro)
                      .map((row) => {
                        const hasCiro = row.totalCiro > 0
                        const sharePercent = kpiData.totalCiro > 0 ? (row.totalCiro / kpiData.totalCiro) * 100 : 0
                        const isExpanded = expandedSubeId === row.subeId

                        return (
                          <>
                            {/* Main Row */}
                            <tr
                              key={row.subeId}
                              onClick={() => hasCiro && setExpandedSubeId(isExpanded ? null : row.subeId)}
                              className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                                isExpanded ? "bg-muted/15 font-semibold" : ""
                              } ${!hasCiro ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <td className="p-4 text-center">
                                {hasCiro && (
                                  <ChevronRight
                                    className={`h-4.5 w-4.5 text-muted-foreground transition-transform duration-300 ${
                                      isExpanded ? "rotate-90 text-indigo-500" : ""
                                    }`}
                                  />
                                )}
                              </td>
                              <td className="p-4">
                                <div className="font-semibold text-foreground">Şube {row.subeAd}</div>
                                <div className="text-[11px] text-muted-foreground font-mono">KOD: {row.subeKod}</div>
                              </td>
                              <td className="p-4 text-right font-bold text-foreground">
                                {formatMoney(row.totalCiro)} TL
                              </td>
                              {/* Progress bar column */}
                              <td className="p-4 hidden sm:table-cell max-w-[140px]">
                                <div className="flex items-center gap-2">
                                  <Progress value={sharePercent} className="h-2 w-16 bg-muted shrink-0" />
                                  <span className="text-xs text-muted-foreground font-mono font-bold w-10">
                                    %{sharePercent.toFixed(1)}
                                  </span>
                                </div>
                              </td>
                              <td className="p-4 text-right font-mono text-foreground hidden md:table-cell">
                                {formatMoney(row.averageDailyCiro)} TL
                              </td>
                              {/* Clarified Calendar Days and Shifts count */}
                              <td className="p-4 text-right hidden sm:table-cell">
                                <div className="font-bold text-foreground">{row.uniqueDaysCount} Gün</div>
                                <div className="text-[10px] text-muted-foreground font-medium">{row.recordCount} Vardiya</div>
                              </td>
                            </tr>

                            {/* Expanded Accordion Row for Monthly Breakdown */}
                            {isExpanded && hasCiro && (
                              <tr key={`${row.subeId}-expanded`} className="bg-muted/10 border-b">
                                <td colSpan={6} className="p-4 sm:px-8">
                                  <div className="space-y-3 p-4 bg-background/55 border rounded-2xl animate-in slide-in-from-top-4 duration-300 shadow-inner">
                                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                                      <TrendingUp className="h-4 w-4" />
                                      Şube {row.subeAd} - Aylık Ciro Kırılımı
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                      
                                      {/* Monthly breakdown mini-table */}
                                      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b bg-muted/40 font-semibold text-muted-foreground uppercase">
                                              <th className="p-2.5">Ay</th>
                                              <th className="p-2.5 text-right">Ciro</th>
                                              <th className="p-2.5 text-right">Gün (Vardiya) Sayısı</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y">
                                            {row.monthlyBreakdown.map((m) => (
                                              <tr key={m.monthSortKey} className="hover:bg-muted/10">
                                                <td className="p-2.5 font-medium">{m.monthLabel}</td>
                                                <td className="p-2.5 text-right font-bold text-foreground">
                                                  {formatMoney(m.ciro)} TL
                                                </td>
                                                <td className="p-2.5 text-right font-medium">
                                                  <span className="text-foreground font-bold">{m.uniqueDaysCount} Gün</span>
                                                  <span className="text-muted-foreground text-[10px] ml-1">({m.recordCount} Vardiya)</span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Mini charts trend for branch */}
                                      <div className="h-[140px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                          <BarChart data={row.monthlyBreakdown}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.06)" />
                                            <XAxis dataKey="monthLabel" fontSize={8} tickLine={false} />
                                            <YAxis fontSize={8} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={24} />
                                            <Tooltip
                                              formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                                              contentStyle={{ fontSize: "10px", borderRadius: "8px" }}
                                            />
                                            <Bar dataKey="ciro" fill="rgb(99, 102, 241)" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
                                          </BarChart>
                                        </ResponsiveContainer>
                                      </div>

                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

    </div>
  )
}
