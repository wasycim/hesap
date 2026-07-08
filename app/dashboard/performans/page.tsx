"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
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
  BadgePercent,
  Layers
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
  Area,
  Legend
} from "recharts"

interface DbFirma {
  id: string
  sube_id: string
  ad: string
  color: string
  komisyon_orani: number | null
}

interface GelirRecord {
  sube_id: string
  tarih: string
  vardiya: string | null
  pamukkale_turizm: number
  anadolu_ulasim: number
  inegol_seyahat: number
  alasehir_turizm: number
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
  komisyonOrani?: number
  mappings?: { sube_id: string; id: string; komisyon_orani: number | null }[] // For custom firms
}

type PeriodPreset = "bu_ay" | "gecen_ay" | "son_3_ay" | "son_6_ay" | "bu_yil" | "custom"

const BUILTIN_FIRMALAR: Omit<CompanyOption, "isShared">[] = [
  { key: "pamukkale_turizm", label: "Pamukkale Turizm", type: "builtin", color: "bg-red-500", text: "text-white", komisyonOrani: 5 },
  { key: "anadolu_ulasim", label: "Anadolu Ulaşım", type: "builtin", color: "bg-blue-600", text: "text-white", komisyonOrani: 5 },
  { key: "inegol_seyahat", label: "İnegöl Seyahat", type: "builtin", color: "bg-orange-500", text: "text-white", komisyonOrani: 5 },
  { key: "alasehir_turizm", label: "Alaşehir Turizm", type: "builtin", color: "bg-yellow-500", text: "text-yellow-950", komisyonOrani: 20 },
  { key: "unlu_2", label: "Ünlü", type: "builtin", color: "bg-cyan-600", text: "text-white", komisyonOrani: 20 },
  { key: "pamukkale_kargo", label: "Pamukkale Kargo", type: "builtin", color: "bg-rose-500", text: "text-white", komisyonOrani: 10 },
  { key: "diger_komisyon", label: "Diğer Komisyon", type: "builtin", color: "bg-slate-500", text: "text-white", komisyonOrani: 100 },
]

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

  // Tab State: "firma" (Firma Odaklı Analiz) or "sube" (Şube Odaklı Analiz)
  const [activeTab, setActiveTab] = useState<"firma" | "sube">("firma")

  // State definitions
  const [period, setPeriod] = useState<PeriodPreset>("bu_ay")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState(today)
  const [selectedSubeId, setSelectedSubeId] = useState<string>("all")
  const [selectedVardiya, setSelectedVardiya] = useState<string>("all")
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>("pamukkale_turizm")
  const [dbFirmalar, setDbFirmalar] = useState<DbFirma[]>([])
  const [records, setRecords] = useState<GelirRecord[]>([])
  const [loading, setLoading] = useState(true)
  
  // Expandable table row keys
  const [expandedSubeId, setExpandedSubeId] = useState<string | null>(null)
  const [expandedCompanyKey, setExpandedCompanyKey] = useState<string | null>(null)
  
  const [searchTerm, setSearchTerm] = useState("")

  // Auto-switch selectedSubeId if transitioning to sube-focused tab
  useEffect(() => {
    if (activeTab === "sube" && (selectedSubeId === "all" || !selectedSubeId)) {
      if (contextSubeler.length > 0) {
        setSelectedSubeId(contextSubeler[0].id)
      }
    }
  }, [activeTab, contextSubeler, selectedSubeId])

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
      // 1. Fetch active custom firms from database (with commission rates)
      const { data: dbFirmsRes, error: dbFirmsError } = await supabase
        .from("gelir_firmalar")
        .select("id, sube_id, ad, color, komisyon_orani")
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

  // Check if current selected branch has Morning/Evening shifts in records
  const branchHasShifts = useMemo(() => {
    const activeSubeId = selectedSubeId === "all" ? null : selectedSubeId
    const targetRecords = activeSubeId ? records.filter(r => r.sube_id === activeSubeId) : records
    return targetRecords.some(r => r.vardiya === "Sabah" || r.vardiya === "Akşam")
  }, [records, selectedSubeId])

  // Automatically reset selectedVardiya to "all" if branch has no shifts
  useEffect(() => {
    if (!branchHasShifts && selectedVardiya !== "all") {
      setSelectedVardiya("all")
    }
  }, [branchHasShifts, selectedVardiya])

  // Filtered records by selected shift (vardiya)
  const filteredRecords = useMemo(() => {
    if (selectedVardiya === "all") return records
    return records.filter(r => r.vardiya === selectedVardiya)
  }, [records, selectedVardiya])

  // 1. Compute list of all available companies (built-in + grouped custom ones)
  const availableCompanies = useMemo(() => {
    const list: CompanyOption[] = BUILTIN_FIRMALAR.map(c => ({
      ...c,
      isShared: MAIN_SHARED_KEYS.has(c.key)
    }))

    const customGroups = new Map<string, { label: string; mappings: { sube_id: string; id: string; komisyon_orani: number | null }[]; color: string }>()

    dbFirmalar.forEach((firm) => {
      const normalized = normalizeFirmaName(firm.ad)
      if (!normalized) return

      const matchesBuiltin = BUILTIN_FIRMALAR.some(b => normalizeFirmaName(b.label) === normalized)
      if (matchesBuiltin) return

      const existing = customGroups.get(normalized)
      if (existing) {
        existing.mappings.push({ sube_id: firm.sube_id, id: firm.id, komisyon_orani: firm.komisyon_orani })
      } else {
        customGroups.set(normalized, {
          label: firm.ad,
          mappings: [{ sube_id: firm.sube_id, id: firm.id, komisyon_orani: firm.komisyon_orani }],
          color: firm.color || "bg-indigo-500"
        })
      }
    })

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
        isShared: false,
        mappings: c.mappings
      })
    })

    return list
  }, [dbFirmalar])

  const filteredCompanies = useMemo(() => {
    if (!searchTerm.trim()) return availableCompanies
    const term = normalizeFirmaName(searchTerm)
    return availableCompanies.filter(comp => normalizeFirmaName(comp.label).includes(term))
  }, [availableCompanies, searchTerm])

  const selectedCompany = useMemo(() => {
    return availableCompanies.find(c => c.key === selectedCompanyKey) || availableCompanies[0]
  }, [availableCompanies, selectedCompanyKey])

  // Determine if trend chart should show daily details instead of monthly points
  const isDailyTrend = useMemo(() => {
    if (!startDate || !endDate) return true
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 45 // Show daily points if range is 1.5 months or less
  }, [startDate, endDate])

  // Helper function to resolve commission rate & amount for any row
  const getCommissionData = (company: CompanyOption, subeId: string, totalCiro: number) => {
    let rate = 10 // default custom commission
    if (company.type === "builtin") {
      rate = company.komisyonOrani ?? 10
    } else if (company.type === "custom" && company.mappings) {
      const mapping = company.mappings.find(m => m.sube_id === subeId)
      if (mapping && mapping.komisyon_orani !== null) {
        rate = Number(mapping.komisyon_orani)
      }
    }
    const komisyonTutarı = totalCiro * (rate / 100)
    const hakedis = totalCiro - komisyonTutarı
    return {
      rate,
      komisyonTutarı,
      hakedis
    }
  }

  // ============================================
  // TAB 1: FIRMA ODAKLI ANALİZ (Company Focused)
  // ============================================
  const firmaAnalyticsData = useMemo(() => {
    if (activeTab !== "firma" || !selectedCompany) return []

    return contextSubeler.map((sube) => {
      const subeRecords = filteredRecords.filter(r => r.sube_id === sube.id)
      let totalCiro = 0
      let recordCount = 0
      const uniqueDays = new Set<string>()

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

      const comm = getCommissionData(selectedCompany, sube.id, totalCiro)

      return {
        subeId: sube.id,
        subeAd: sube.ad,
        subeKod: sube.kod,
        totalCiro,
        recordCount,
        uniqueDaysCount: uniqueDays.size,
        komisyonOrani: comm.rate,
        komisyonTutari: comm.komisyonTutarı,
        hakedis: comm.hakedis,
        monthlyBreakdown
      }
    })
  }, [activeTab, contextSubeler, filteredRecords, selectedCompany])

  const filteredFirmaAnalytics = useMemo(() => {
    if (selectedSubeId === "all") return firmaAnalyticsData
    return firmaAnalyticsData.filter(d => d.subeId === selectedSubeId)
  }, [firmaAnalyticsData, selectedSubeId])

  // ============================================
  // TAB 2: ŞUBE ODAKLI ANALİZ (Branch Focused)
  // ============================================
  const currentBranchObject = useMemo(() => {
    const activeSubeId = selectedSubeId === "all" ? (contextSubeler[0]?.id || "") : selectedSubeId
    return contextSubeler.find(s => s.id === activeSubeId)
  }, [contextSubeler, selectedSubeId])

  const subeAnalyticsData = useMemo(() => {
    if (activeTab !== "sube" || !currentBranchObject) return []

    const branchRecords = filteredRecords.filter(r => r.sube_id === currentBranchObject.id)

    return availableCompanies.map((comp) => {
      let totalCiro = 0
      let recordCount = 0
      const uniqueDays = new Set<string>()
      const monthMap = new Map<string, { label: string; ciro: number; recordCount: number; uniqueDays: Set<string> }>()

      branchRecords.forEach((record) => {
        let val = 0
        if (comp.type === "builtin") {
          val = record[comp.key as keyof GelirRecord] as number || 0
        } else if (comp.type === "custom" && comp.mappings) {
          const mapping = comp.mappings.find(m => m.sube_id === currentBranchObject.id)
          if (mapping) {
            val = Number(record.custom_values?.[`firma_${mapping.id}`]) || 0
          }
        }

        if (val > 0) {
          totalCiro += val
          recordCount++
          uniqueDays.add(record.tarih)

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

      const comm = getCommissionData(comp, currentBranchObject.id, totalCiro)

      return {
        companyKey: comp.key,
        companyLabel: comp.label,
        type: comp.type,
        color: comp.color,
        isShared: comp.isShared,
        totalCiro,
        recordCount,
        uniqueDaysCount: uniqueDays.size,
        komisyonOrani: comm.rate,
        komisyonTutari: comm.komisyonTutarı,
        hakedis: comm.hakedis,
        monthlyBreakdown
      }
    }).filter(d => d.totalCiro > 0)
  }, [activeTab, currentBranchObject, filteredRecords, availableCompanies])

  // ============================================
  // COMBINED STATS & SUMMARY DATA (KPIs)
  // ============================================
  const kpiData = useMemo(() => {
    let totalCiro = 0
    let totalActiveDays = 0
    let activeElementsCount = 0
    let topElement = { name: "-", ciro: 0, share: 0 }

    if (activeTab === "firma") {
      firmaAnalyticsData.forEach((subeData) => {
        totalCiro += subeData.totalCiro
        totalActiveDays += subeData.uniqueDaysCount
        if (subeData.totalCiro > 0) activeElementsCount++
      })

      let maxCiro = 0
      let bestName = "-"
      firmaAnalyticsData.forEach((subeData) => {
        if (subeData.totalCiro > maxCiro) {
          maxCiro = subeData.totalCiro
          bestName = subeData.subeAd
        }
      })
      if (totalCiro > 0 && maxCiro > 0) {
        topElement = { name: bestName, ciro: maxCiro, share: (maxCiro / totalCiro) * 100 }
      }
    } else {
      subeAnalyticsData.forEach((compData) => {
        totalCiro += compData.totalCiro
        totalActiveDays += compData.uniqueDaysCount
        if (compData.totalCiro > 0) activeElementsCount++
      })

      let maxCiro = 0
      let bestName = "-"
      subeAnalyticsData.forEach((compData) => {
        if (compData.totalCiro > maxCiro) {
          maxCiro = compData.totalCiro
          bestName = compData.companyLabel
        }
      })
      if (totalCiro > 0 && maxCiro > 0) {
        topElement = { name: bestName, ciro: maxCiro, share: (maxCiro / totalCiro) * 100 }
      }
    }

    return {
      totalCiro,
      activeElementsCount,
      topElement,
      dailyAverage: totalActiveDays > 0 ? totalCiro / totalActiveDays : 0
    }
  }, [activeTab, firmaAnalyticsData, subeAnalyticsData])

  // ============================================
  // COMBINED CHARTS GENERATOR (Multi-branch Lines)
  // ============================================
  const chartsData = useMemo(() => {
    // 1. Doughnut & Horizontal Bar Comparison Data
    const comparison = (activeTab === "firma" ? firmaAnalyticsData : subeAnalyticsData)
      .map(d => {
        const name = activeTab === "firma" ? (d as any).subeAd : (d as any).companyLabel
        const ciro = d.totalCiro
        return {
          name,
          ciro,
          formattedCiro: formatMoney(ciro)
        }
      })
      .filter(d => d.ciro > 0)
      .sort((a, b) => b.ciro - a.ciro)

    // 2. Trend Data Aggregator: Handles multi-branch lines if selectedSubeId === "all"
    const trendMap = new Map<string, { label: string; ciro: number; [key: string]: any }>()

    if (isDailyTrend) {
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateString(d)
          const dateObj = new Date(dateStr)
          const day = dateObj.getDate()
          const monthShort = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(dateObj)
          
          const defaultObj: any = { label: `${day} ${monthShort}`, ciro: 0 }
          if (activeTab === "firma" && selectedSubeId === "all") {
            contextSubeler.forEach(sube => {
              defaultObj[`sube_${sube.id}`] = 0
            })
          }
          trendMap.set(dateStr, defaultObj)
        }
      }

      filteredRecords.forEach((record) => {
        if (activeTab === "firma") {
          if (selectedSubeId !== "all" && record.sube_id !== selectedSubeId) return
        } else {
          if (record.sube_id !== currentBranchObject?.id) return
        }

        // Get value
        let val = 0
        if (activeTab === "firma") {
          if (selectedCompany.type === "builtin") {
            val = record[selectedCompany.key as keyof GelirRecord] as number || 0
          } else if (selectedCompany.type === "custom" && selectedCompany.mappings) {
            const mapping = selectedCompany.mappings.find(m => m.sube_id === record.sube_id)
            if (mapping) {
              val = Number(record.custom_values?.[`firma_${mapping.id}`]) || 0
            }
          }
        } else {
          availableCompanies.forEach((comp) => {
            if (comp.type === "builtin") {
              val += record[comp.key as keyof GelirRecord] as number || 0
            } else if (comp.type === "custom" && comp.mappings) {
              const mapping = comp.mappings.find(m => m.sube_id === currentBranchObject?.id)
              if (mapping) {
                val += Number(record.custom_values?.[`firma_${mapping.id}`]) || 0
              }
            }
          })
        }

        if (val > 0) {
          const current = trendMap.get(record.tarih) || { label: record.tarih, ciro: 0 }
          current.ciro += val
          
          if (activeTab === "firma" && selectedSubeId === "all") {
            const key = `sube_${record.sube_id}`
            current[key] = (current[key] || 0) + val
          }
          trendMap.set(record.tarih, current)
        }
      })
    } else {
      // Monthly points aggregation
      const listData = activeTab === "firma" ? firmaAnalyticsData : subeAnalyticsData
      
      listData.forEach((item) => {
        if (activeTab === "firma") {
          if (selectedSubeId !== "all" && item.subeId !== selectedSubeId) return
        }
        item.monthlyBreakdown.forEach((m) => {
          const current = trendMap.get(m.monthSortKey) || { label: m.monthLabel, ciro: 0 }
          current.ciro += m.ciro
          if (activeTab === "firma" && selectedSubeId === "all") {
            const key = `sube_${item.subeId}`
            current[key] = (current[key] || 0) + m.ciro
          }
          trendMap.set(m.monthSortKey, current)
        })
      })
    }

    const trend = Array.from(trendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        sortKey: key,
        ...value,
        formattedCiro: formatMoney(value.ciro)
      }))

    return {
      comparison,
      trend
    }
  }, [activeTab, firmaAnalyticsData, subeAnalyticsData, filteredRecords, selectedCompany, selectedSubeId, currentBranchObject, isDailyTrend, startDate, endDate, availableCompanies, contextSubeler])

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
      <style>{`
        .recharts-pie-sector,
        .recharts-sector,
        path:focus,
        g:focus,
        svg:focus,
        .recharts-wrapper *:focus {
          outline: none !important;
        }
      `}</style>
      
      {/* HEADER SECTION */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-inner group hover:scale-105 transition-transform">
            <BarChart3 className="h-6 w-6 group-hover:animate-[bounce_0.6s_ease-in-out_infinite]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Performans & Rapor Analizi</h1>
            <p className="text-sm text-muted-foreground">Şubeler ve firmalar bazında detaylı ciro dağılımları ve trend analizleri.</p>
          </div>
        </div>

        {/* Filters Panel */}
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

          {/* Sube Selector */}
          {activeTab === "firma" ? (
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
          ) : (
            <Select value={selectedSubeId === "all" ? (contextSubeler[0]?.id || "") : selectedSubeId} onValueChange={setSelectedSubeId}>
              <SelectTrigger className="w-[180px] h-11 rounded-xl bg-card border shadow-sm">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Şube seçin" />
              </SelectTrigger>
              <SelectContent>
                {contextSubeler.map((sube) => (
                  <SelectItem key={sube.id} value={sube.id}>
                    Şube {sube.ad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Shift (Vardiya) Selector with smart autoselect */}
          <div className="flex items-center gap-1.5">
            <Select 
              disabled={!branchHasShifts} 
              value={selectedVardiya} 
              onValueChange={setSelectedVardiya}
            >
              <SelectTrigger className="w-[150px] h-11 rounded-xl bg-card border shadow-sm">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Vardiya" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Vardiyalar</SelectItem>
                <SelectItem value="Sabah">Sabah</SelectItem>
                <SelectItem value="Akşam">Akşam</SelectItem>
              </SelectContent>
            </Select>
            {!branchHasShifts && selectedSubeId !== "all" && (
              <Badge variant="outline" className="h-9 px-2.5 text-[10px] border-amber-500/20 text-amber-600 dark:text-amber-400 bg-amber-500/5 rounded-lg flex items-center justify-center font-bold tracking-wider uppercase">
                Tek Vardiya
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* TAB SELECTOR BUTTONS */}
      <div className="flex items-center justify-start p-1 bg-muted/40 rounded-2xl w-fit border border-border/40">
        <button
          onClick={() => {
            setActiveTab("firma")
            setExpandedSubeId(null)
            setExpandedCompanyKey(null)
          }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
            activeTab === "firma"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Target className="h-4.5 w-4.5 text-indigo-500" />
          Firma Analizi
        </button>
        <button
          onClick={() => {
            setActiveTab("sube")
            setExpandedSubeId(null)
            setExpandedCompanyKey(null)
          }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${
            activeTab === "sube"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Building2 className="h-4.5 w-4.5 text-indigo-500" />
          Şube Analizi
        </button>
      </div>

      {/* VIEW PANEL: FIRMA ANALİZİ */}
      {activeTab === "firma" && (
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
                {/* Ortak Firmalar */}
                {(!searchTerm.trim() || filteredCompanies.some(c => c.isShared)) && (
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3.5 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Ortak Firmalar (Ana Hatlar)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {filteredCompanies.filter(c => c.isShared).map((comp) => {
                        const isSelected = selectedCompanyKey === comp.key
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
                                  isSelected ? "bg-white/20 text-white" : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
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

                {/* Diğer Firmalar */}
                {(!searchTerm.trim() || filteredCompanies.some(c => !c.isShared)) && (
                  <div className="border-t border-dashed pt-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-3 flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                      Diğer Firmalar
                    </div>
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
                              isSelected ? "bg-white animate-pulse" : isCustom ? "bg-indigo-400 dark:bg-indigo-500" : comp.color
                            } shrink-0`} />
                            <span className="font-medium">{comp.label}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] px-1 py-0 border-none rounded-md leading-none ${
                                isSelected 
                                  ? "bg-white/20 text-white" 
                                  : isCustom ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
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
      )}

      {/* VIEW PANEL: ŞUBE ANALİZİ */}
      {activeTab === "sube" && (
        <Card className="border border-border/60 bg-card/65 backdrop-blur-md shadow-sm rounded-2xl">
          <CardHeader className="py-4 border-b">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-indigo-500" />
              <div>
                <CardTitle className="text-lg font-bold">
                  Şube Detay Analizi
                </CardTitle>
                <CardDescription>
                  Şube <strong>{currentBranchObject?.ad || "-"}</strong> bünyesindeki tüm firmaların ciro dağılımları.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 font-sans">
            <div className="text-sm text-muted-foreground">
              Analiz edilen şubeyi, vardiyayı ve tarih periyodunu yukarıdaki sağ panelden değiştirebilirsiniz. Aşağıdaki tabloda şubeye ciro kaydetmiş olan tüm ortak ve şubeye özel firmaların detaylı dağılımları, komisyon oranları ve net hakedişleri listelenmektedir.
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 font-sans">
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
                  Seçilen filtrelere ait toplam ciro.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-indigo-200 dark:text-indigo-950/40">
                  <TrendingUp className="h-full w-full" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-emerald-50/40 via-card to-card dark:from-emerald-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeTab === "firma" ? "En Başarılı Şube" : "En Başarılı Firma"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {kpiData.topElement.name}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <BadgePercent className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{formatMoney(kpiData.topElement.ciro)} TL (%{kpiData.topElement.share.toFixed(1)}) pay.</span>
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-emerald-200 dark:text-emerald-950/40">
                  {activeTab === "firma" ? <Building className="h-full w-full" /> : <Target className="h-full w-full" />}
                </div>
              </CardContent>
            </Card>

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
                  Aktif olunan takvim günlerinin günlük ciro ortalaması.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-amber-200 dark:text-amber-950/40">
                  <Sparkles className="h-full w-full" />
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-purple-50/40 via-card to-card dark:from-purple-950/10 dark:via-card dark:to-card shadow-sm rounded-2xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {activeTab === "firma" ? "Aktif Şube Sayısı" : "Aktif Firma Sayısı"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400 font-mono">
                  {kpiData.activeElementsCount} / {activeTab === "firma" ? contextSubeler.length : availableCompanies.length}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3 shrink-0" />
                  Ciro kaydı bulunan aktif elemanlar.
                </p>
                <div className="absolute right-4 bottom-4 h-12 w-12 text-purple-200 dark:text-purple-950/40">
                  <Layers className="h-full w-full" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* VISUAL ANALYTICS VERTICAL STACK (Full Width Charts) */}
          <div className="flex flex-col gap-6">
            
            {/* Chart 1: Distribution comparison (Full Width) */}
            <Card className="border border-border/60 bg-card/75 backdrop-blur-md shadow-sm rounded-2xl w-full">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PieIcon className="h-4.5 w-4.5 text-indigo-500" />
                  {activeTab === "firma" ? "Şube Performans Dağılımı" : "Firma Ciro Dağılımı"}
                </CardTitle>
                <CardDescription>
                  {activeTab === "firma" 
                    ? "Şubelerin toplam cirodaki payları ve karşılaştırmaları." 
                    : `Şube ${currentBranchObject?.ad || ""} içerisindeki firmaların ciro dağılımları.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {chartsData.comparison.length === 0 ? (
                  <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                    Bu periyotta ciro kaydı bulunmamaktadır.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-center">
                    
                    {/* Doughnut Chart */}
                    <div className="col-span-1 md:col-span-2 h-[260px] relative flex justify-center items-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartsData.comparison}
                            dataKey="ciro"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={85}
                            paddingAngle={3}
                            stroke="none"
                            style={{ outline: "none" }}
                            animationDuration={800}
                          >
                            {chartsData.comparison.map((entry, index) => {
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
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                              borderRadius: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
                            }}
                            labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                            itemStyle={{ color: "var(--foreground)" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute text-center">
                        <span className="block text-[10px] uppercase font-bold text-muted-foreground leading-none">Toplam</span>
                        <span className="block text-sm font-black text-foreground mt-0.5">{formatMoney(kpiData.totalCiro).split(",")[0]} TL</span>
                      </div>
                    </div>

                    {/* Horizontal Bar Chart comparison */}
                    <div className="col-span-1 md:col-span-3 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartsData.comparison}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" horizontal={false} />
                          <XAxis type="number" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} fontSize={10} stroke="rgba(128,128,128,0.4)" />
                          <YAxis dataKey="name" type="category" width={75} fontSize={10} stroke="rgba(128,128,128,0.4)" />
                          <Tooltip
                            formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                            contentStyle={{
                              backgroundColor: "var(--card)",
                              borderColor: "var(--border)",
                              color: "var(--foreground)",
                              borderRadius: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
                            }}
                            labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                            itemStyle={{ color: "var(--foreground)" }}
                          />
                          <Bar dataKey="ciro" radius={[0, 8, 8, 0]} animationDuration={800}>
                            {chartsData.comparison.map((entry, index) => {
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

            {/* Chart 2: Zaman Serisi Trendi (Full Width with multi-branch rendering) */}
            <Card className="border border-border/60 bg-card/75 backdrop-blur-md shadow-sm rounded-2xl w-full">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-indigo-500" />
                  Ciro Trendi (Zaman Serisi)
                </CardTitle>
                <CardDescription>
                  {activeTab === "firma" ? (
                    selectedSubeId === "all" ? `Her şubenin ${isDailyTrend ? "günlük" : "aylık"} ciro karşılaştırma serisi.` : `Şube ${contextSubeler.find(s => s.id === selectedSubeId)?.ad || ""} ${isDailyTrend ? "günlük" : "aylık"} ciro kırılımı.`
                  ) : (
                    `Şube ${currentBranchObject?.ad || ""} ${isDailyTrend ? "günlük" : "aylık"} genel ciro trendi.`
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {chartsData.trend.length === 0 ? (
                  <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                    Bu periyotta ciro trendi oluşturacak veri bulunmamaktadır.
                  </div>
                ) : (
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartsData.trend}
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
                          formatter={(value: number, name: string) => [`${formatMoney(value)} TL`, name]}
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                            color: "var(--foreground)",
                            borderRadius: "12px",
                            boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)"
                          }}
                          labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                          itemStyle={{ color: "var(--foreground)" }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        
                        {/* Render multiple lines if all branches selected, otherwise just render the single main line */}
                        {activeTab === "firma" && selectedSubeId === "all" ? (
                          contextSubeler.map((sube, index) => {
                            const colors = [
                              "rgb(79, 70, 229)", // Indigo 500
                              "rgb(16, 185, 129)", // Emerald 500
                              "rgb(245, 158, 11)", // Amber 500
                              "rgb(239, 68, 68)",  // Red 500
                              "rgb(168, 85, 247)", // Purple 500
                              "rgb(6, 182, 212)"   // Cyan 500
                            ];
                            const color = colors[index % colors.length];
                            return (
                              <Area
                                key={sube.id}
                                type="monotone"
                                dataKey={`sube_${sube.id}`}
                                name={`Şube ${sube.ad}`}
                                stroke={color}
                                fill={color}
                                fillOpacity={0.03}
                                strokeWidth={2.5}
                                animationDuration={800}
                              />
                            );
                          })
                        ) : (
                          <Area 
                            type="monotone" 
                            dataKey="ciro" 
                            name="Toplam Ciro"
                            stroke="rgb(99, 102, 241)" 
                            strokeWidth={3} 
                            fillOpacity={1} 
                            fill="url(#colorCiro)" 
                            animationDuration={900}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

          {/* DETAILED SUMMARY TABLE CARD: FIRMA ODAKLI GÖRÜNÜM */}
          {activeTab === "firma" && (
            <Card className="border border-border/60 bg-card/65 backdrop-blur-md shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-indigo-500" />
                  Şube Bazlı Hakediş Raporu
                </CardTitle>
                <CardDescription>
                  Şubelerin toplam satış ciroları, komisyon oranları ve kalan net hakedişleri. Satırlara tıklayarak vardiya geçmişini inceleyebilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                        <th className="p-4 w-12">Detay</th>
                        <th className="p-4">Şube Adı</th>
                        <th className="p-4 text-right">Bilet Cirosu</th>
                        <th className="p-4 text-right">Komisyon Oranı</th>
                        <th className="p-4 text-right text-emerald-600 dark:text-emerald-400">Komisyon Tutarı</th>
                        <th className="p-4 text-right text-indigo-600 dark:text-indigo-400">Net Hakediş</th>
                        <th className="p-4 text-right hidden sm:table-cell">Aktif Gün</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredFirmaAnalytics
                        .sort((a, b) => b.totalCiro - a.totalCiro)
                        .map((row) => {
                          const hasCiro = row.totalCiro > 0
                          const isExpanded = expandedSubeId === row.subeId

                          return (
                            <Fragment key={row.subeId}>
                              {/* Main Row */}
                              <tr
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
                                <td className="p-4 font-semibold text-foreground">
                                  Şube {row.subeAd}
                                </td>
                                <td className="p-4 text-right font-bold text-foreground font-mono">
                                  {formatMoney(row.totalCiro)} TL
                                </td>
                                <td className="p-4 text-right text-muted-foreground font-mono font-semibold">
                                  %{row.komisyonOrani}
                                </td>
                                <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                  {formatMoney(row.komisyonTutari)} TL
                                </td>
                                <td className="p-4 text-right text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                  {formatMoney(row.hakedis)} TL
                                </td>
                                <td className="p-4 text-right hidden sm:table-cell">
                                  <div className="font-bold text-foreground">{row.uniqueDaysCount} Gün</div>
                                  <div className="text-[10px] text-muted-foreground font-medium">{row.recordCount} Vardiya</div>
                                </td>
                              </tr>

                              {/* Expanded Accordion Row for Monthly Breakdown */}
                              {isExpanded && hasCiro && (
                                <tr className="bg-muted/10 border-b">
                                  <td colSpan={7} className="p-4 sm:px-8">
                                    <div className="space-y-3 p-4 bg-background/55 border rounded-2xl animate-in slide-in-from-top-4 duration-300 shadow-inner">
                                      <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <TrendingUp className="h-4 w-4" />
                                        Şube {row.subeAd} - Aylık Ciro Kırılımı
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        
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

                                        <div className="h-[140px] w-full">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={row.monthlyBreakdown}>
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.06)" />
                                              <XAxis dataKey="monthLabel" fontSize={8} tickLine={false} />
                                              <YAxis fontSize={8} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={24} />
                                              <Tooltip
                                                formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                                                contentStyle={{
                                                  backgroundColor: "var(--card)",
                                                  borderColor: "var(--border)",
                                                  color: "var(--foreground)",
                                                  borderRadius: "8px",
                                                  fontSize: "10px"
                                                }}
                                                labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                                                itemStyle={{ color: "var(--foreground)" }}
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
                            </Fragment>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* DETAILED SUMMARY TABLE CARD: ŞUBE ODAKLI GÖRÜNÜM */}
          {activeTab === "sube" && (
            <Card className="border border-border/60 bg-card/65 backdrop-blur-md shadow-sm rounded-2xl">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-indigo-500" />
                  Firma Bazlı Hakediş Raporu (Şube: {currentBranchObject?.ad || "-"})
                </CardTitle>
                <CardDescription>
                  Seçilen şubedeki firmaların toplam ciroları, komisyon oranları ve kalan net hakediş tutarları.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse font-sans">
                    <thead>
                      <tr className="border-b bg-muted/30 text-xs font-semibold text-muted-foreground uppercase">
                        <th className="p-4 w-12">Detay</th>
                        <th className="p-4">Firma Adı</th>
                        <th className="p-4">Türü</th>
                        <th className="p-4 text-right">Bilet Cirosu</th>
                        <th className="p-4 text-right">Komisyon Oranı</th>
                        <th className="p-4 text-right text-emerald-600 dark:text-emerald-400">Komisyon Tutarı</th>
                        <th className="p-4 text-right text-indigo-600 dark:text-indigo-400">Net Hakediş</th>
                        <th className="p-4 text-right hidden sm:table-cell">Aktif Gün</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {subeAnalyticsData
                        .sort((a, b) => b.totalCiro - a.totalCiro)
                        .map((row) => {
                          const hasCiro = row.totalCiro > 0
                          const isExpanded = expandedCompanyKey === row.companyKey

                          return (
                            <Fragment key={row.companyKey}>
                              {/* Main Row */}
                              <tr
                                onClick={() => hasCiro && setExpandedCompanyKey(isExpanded ? null : row.companyKey)}
                                className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                                  isExpanded ? "bg-muted/15 font-semibold" : ""
                                }`}
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
                                <td className="p-4 font-bold text-foreground">
                                  {row.companyLabel}
                                </td>
                                <td className="p-4">
                                  {row.isShared ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none font-bold">
                                      Ortak Firma
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-none font-bold">
                                      Özel Firma
                                    </Badge>
                                  )}
                                </td>
                                <td className="p-4 text-right font-bold text-foreground font-mono">
                                  {formatMoney(row.totalCiro)} TL
                                </td>
                                <td className="p-4 text-right text-muted-foreground font-mono font-semibold">
                                  %{row.komisyonOrani}
                                </td>
                                <td className="p-4 text-right text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                  {formatMoney(row.komisyonTutari)} TL
                                </td>
                                <td className="p-4 text-right text-indigo-600 dark:text-indigo-400 font-mono font-bold">
                                  {formatMoney(row.hakedis)} TL
                                </td>
                                <td className="p-4 text-right hidden sm:table-cell">
                                  <div className="font-bold text-foreground">{row.uniqueDaysCount} Gün</div>
                                  <div className="text-[10px] text-muted-foreground font-medium">{row.recordCount} Vardiya</div>
                                </td>
                              </tr>

                              {/* Expanded Accordion Row for Monthly Breakdown */}
                              {isExpanded && hasCiro && (
                                <tr className="bg-muted/10 border-b">
                                  <td colSpan={8} className="p-4 sm:px-8">
                                    <div className="space-y-3 p-4 bg-background/55 border rounded-2xl animate-in slide-in-from-top-4 duration-300 shadow-inner">
                                      <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <TrendingUp className="h-4 w-4" />
                                        {row.companyLabel} - Aylık Ciro Kırılımı
                                      </div>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                        
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

                                        <div className="h-[140px] w-full">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={row.monthlyBreakdown}>
                                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.06)" />
                                              <XAxis dataKey="monthLabel" fontSize={8} tickLine={false} />
                                              <YAxis fontSize={8} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} width={24} />
                                              <Tooltip
                                                formatter={(value: number) => [`${formatMoney(value)} TL`, "Ciro"]}
                                                contentStyle={{
                                                  backgroundColor: "var(--card)",
                                                  borderColor: "var(--border)",
                                                  color: "var(--foreground)",
                                                  borderRadius: "8px",
                                                  fontSize: "10px"
                                                }}
                                                labelStyle={{ color: "var(--foreground)", fontWeight: "bold" }}
                                                itemStyle={{ color: "var(--foreground)" }}
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
                            </Fragment>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

    </div>
  )
}
