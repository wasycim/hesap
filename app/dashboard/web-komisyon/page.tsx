"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Globe,
  Loader2,
  Percent,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CurrencyInput, parseCurrencyInputValue } from "@/components/dashboard/currency-input"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { MONTHS, getInitialYear, makeYearWindow } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"
import {
  getColumnColorClass,
  getColumnColorStyle,
  getColumnTextColor,
} from "@/lib/table-column-settings"
import { cn } from "@/lib/utils"

interface Firma {
  id: string
  ad: string
  color?: string
  sira?: number
}

interface WebKomisyonRecord {
  id?: string
  sube_id?: string
  tarih: string
  ay_yil: string
  firma_degerleri: Record<string, number>
  toplam_komisyon: number
  notlar?: string | null
}

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function isSpreadsheetControl(element: Element | null): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLSelectElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return false
  }
  return !element.disabled && !(element instanceof HTMLInputElement && element.type === "hidden")
}

function findSpreadsheetControl(cell: Element | undefined) {
  const controls = Array.from(cell?.querySelectorAll("input, select, textarea") || [])
  return controls.find(isSpreadsheetControl) || null
}

function handleSpreadsheetKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  const control = e.target as HTMLElement
  if (!isSpreadsheetControl(control)) return

  const cell = control.closest("td")
  if (!cell) return
  const row = cell.parentElement // <tr>
  if (!row) return
  const tableBody = row.parentElement // <tbody>
  if (!tableBody) return

  const colIndex = Array.from(row.children).indexOf(cell)
  const rowIndex = Array.from(tableBody.children).indexOf(row)

  const isTextControl = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
  const atStart = !isTextControl || control.selectionStart === 0 || control.selectionStart === null
  const atEnd = !isTextControl || control.selectionEnd === (control.value || "").length || control.selectionEnd === null
  let targetControl: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null

  if (e.key === "ArrowUp") {
    let currRowIndex = rowIndex - 1
    while (currRowIndex >= 0) {
      const prevRow = tableBody.children[currRowIndex]
      const targetCell = prevRow?.children[colIndex]
      const foundControl = findSpreadsheetControl(targetCell)
      if (foundControl) {
        targetControl = foundControl
        break
      }
      currRowIndex--
    }
  } else if (e.key === "ArrowDown" || e.key === "Enter") {
    let currRowIndex = rowIndex + 1
    while (currRowIndex < tableBody.children.length) {
      const nextRow = tableBody.children[currRowIndex]
      const targetCell = nextRow?.children[colIndex]
      const foundControl = findSpreadsheetControl(targetCell)
      if (foundControl) {
        targetControl = foundControl
        break
      }
      currRowIndex++
    }
  } else if (e.key === "ArrowLeft") {
    if (atStart) {
      let currColIndex = colIndex - 1
      while (currColIndex >= 0) {
        const targetCell = row.children[currColIndex]
        const foundControl = findSpreadsheetControl(targetCell)
        if (foundControl) {
          targetControl = foundControl
          break
        }
        currColIndex--
      }
    }
  } else if (e.key === "ArrowRight") {
    if (atEnd) {
      let currColIndex = colIndex + 1
      while (currColIndex < row.children.length) {
        const targetCell = row.children[currColIndex]
        const foundControl = findSpreadsheetControl(targetCell)
        if (foundControl) {
          targetControl = foundControl
          break
        }
        currColIndex++
      }
    }
  }

  if (targetControl) {
    e.preventDefault()
    targetControl.focus()
    if (targetControl instanceof HTMLInputElement || targetControl instanceof HTMLTextAreaElement) {
      targetControl.select()
    }
  }
}

export default function WebKomisyonPage() {
  const [year, setYear] = useState<number>(getInitialYear())
  const [selectedMonth, setSelectedMonth] = useState<string>("ALL")
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [monthlyData, setMonthlyData] = useState<Record<string, { amounts: Record<string, string>; notlar: string }>>({})
  const [savedRecords, setSavedRecords] = useState<Record<string, WebKomisyonRecord>>({})
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [savingMonth, setSavingMonth] = useState<string | null>(null)

  const { currentSube, isAdmin, refreshKey } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)

  useEffect(() => {
    if (currentSube) {
      loadData()
    }
  }, [currentSube?.id, year, refreshKey])

  useEffect(() => {
    registerSaveHandler(saveAllData)
    return () => registerSaveHandler(null)
  }, [monthlyData, currentSube?.id, year])

  if (!isAdmin && !loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 p-6 text-center">
        <ShieldAlert className="h-14 w-14 animate-pulse text-destructive" />
        <h2 className="text-2xl font-black">Erişim Engellendi 🔒</h2>
        <p className="max-w-md text-sm font-medium text-muted-foreground">
          Web Komisyon sayfası <strong>sadece Yöneticiler (Admin) ve Developer</strong> hesaplarına özeldir.
        </p>
      </div>
    )
  }

  async function loadData() {
    if (!currentSube) return
    setLoading(true)

    try {
      const response = await fetch(`/api/dashboard/web-komisyon?subeId=${currentSube.id}&year=${year}`, {
        cache: "no-store",
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(data.error || "Web komisyon verileri yüklenemedi.")
        setLoading(false)
        return
      }

      setFirmalar(data.firmalar || [])

      const recordsMap: Record<string, WebKomisyonRecord> = {}
      const draftMap: Record<string, { amounts: Record<string, string>; notlar: string }> = {}

      // Initial draft state for all 12 months
      MONTHS.forEach((m) => {
        draftMap[`${m}-${year}`] = { amounts: {}, notlar: "" }
      })

      if (Array.isArray(data.records)) {
        data.records.forEach((rec: WebKomisyonRecord) => {
          recordsMap[rec.ay_yil] = rec

          const amountsStr: Record<string, string> = {}
          if (rec.firma_degerleri && typeof rec.firma_degerleri === "object") {
            Object.entries(rec.firma_degerleri).forEach(([fId, val]) => {
              if (val) amountsStr[fId] = String(val)
            })
          }

          draftMap[rec.ay_yil] = {
            amounts: amountsStr,
            notlar: rec.notlar || "",
          }
        })
      }

      setSavedRecords(recordsMap)
      setMonthlyData(draftMap)
      markClean()
    } catch {
      toast.error("Web komisyon verileri yüklenirken hata oluştu.")
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = (ayYil: string, firmaId: string, value: string) => {
    setMonthlyData((prev) => {
      const currentMonth = prev[ayYil] || { amounts: {}, notlar: "" }
      return {
        ...prev,
        [ayYil]: {
          ...currentMonth,
          amounts: {
            ...currentMonth.amounts,
            [firmaId]: value,
          },
        },
      }
    })
    markDirty()
  }

  const handleNotesChange = (ayYil: string, notes: string) => {
    setMonthlyData((prev) => {
      const currentMonth = prev[ayYil] || { amounts: {}, notlar: "" }
      return {
        ...prev,
        [ayYil]: {
          ...currentMonth,
          notlar: notes,
        },
      }
    })
    markDirty()
  }

  // Calculated Row Totals (Month Total)
  const getMonthTotal = (ayYil: string): number => {
    const mData = monthlyData[ayYil]
    if (!mData) return 0
    return Object.values(mData.amounts).reduce((sum, valStr) => {
      return sum + parseCurrencyInputValue(valStr)
    }, 0)
  }

  // Calculated Firm Column Totals (Annual Firm Total)
  const getFirmAnnualTotal = (firmaId: string): number => {
    return MONTHS.reduce((sum, m) => {
      const ayYil = `${m}-${year}`
      const valStr = monthlyData[ayYil]?.amounts?.[firmaId] || ""
      return sum + parseCurrencyInputValue(valStr)
    }, 0)
  }

  // Annual Grand Total
  const grandTotal = useMemo(() => {
    return MONTHS.reduce((sum, m) => {
      return sum + getMonthTotal(`${m}-${year}`)
    }, 0)
  }, [monthlyData, year])

  // Count of Months with Data
  const activeMonthsCount = useMemo(() => {
    return MONTHS.filter((m) => getMonthTotal(`${m}-${year}`) > 0).length
  }, [monthlyData, year])

  // Top Performing Firm
  const topFirm = useMemo(() => {
    if (firmalar.length === 0) return null
    let maxTotal = 0
    let bestFirma: Firma | null = null

    firmalar.forEach((f) => {
      const total = getFirmAnnualTotal(f.id)
      if (total > maxTotal) {
        maxTotal = total
        bestFirma = f
      }
    })

    return bestFirma ? { firma: bestFirma, total: maxTotal } : null
  }, [firmalar, monthlyData, year])

  async function saveMonth(ayYil: string, monthName: string, monthIndex: number) {
    if (!currentSube) return
    setSavingMonth(ayYil)

    const mData = monthlyData[ayYil] || { amounts: {}, notlar: "" }
    const firmaDegerleri: Record<string, number> = {}

    Object.entries(mData.amounts).forEach(([fId, valStr]) => {
      const num = parseCurrencyInputValue(valStr)
      if (num > 0) firmaDegerleri[fId] = num
    })

    const monthNumStr = String(monthIndex + 1).padStart(2, "0")
    const tarih = `${year}-${monthNumStr}-01`

    const payload = {
      subeId: currentSube.id,
      tarih,
      ay_yil: ayYil,
      firma_degerleri: firmaDegerleri,
      notlar: mData.notlar,
    }

    try {
      const response = await fetch("/api/dashboard/web-komisyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error(`${monthName} ${year} verileri kaydedilemedi: ` + (data.error || "Sunucu hatası"))
      } else {
        toast.success(`${monthName} ${year} Web komisyon verileri başarıyla kaydedildi.`)
        markClean()
        loadData()
      }
    } catch {
      toast.error(`${monthName} ${year} kaydetme işlemi başarısız.`)
    } finally {
      setSavingMonth(null)
    }
  }

  async function saveAllData() {
    if (!currentSube) return
    setSaving(true)

    const recordsToSave = MONTHS.map((m, idx) => {
      const ayYil = `${m}-${year}`
      const mData = monthlyData[ayYil] || { amounts: {}, notlar: "" }
      const firmaDegerleri: Record<string, number> = {}

      Object.entries(mData.amounts).forEach(([fId, valStr]) => {
        const num = parseCurrencyInputValue(valStr)
        if (num > 0) firmaDegerleri[fId] = num
      })

      const monthNumStr = String(idx + 1).padStart(2, "0")
      const tarih = `${year}-${monthNumStr}-01`

      return {
        tarih,
        ay_yil: ayYil,
        firma_degerleri: firmaDegerleri,
        notlar: mData.notlar,
      }
    })

    try {
      const response = await fetch("/api/dashboard/web-komisyon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subeId: currentSube.id,
          records: recordsToSave,
        }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        toast.error("Tüm veriler kaydedilemedi: " + (data.error || "Sunucu hatası"))
      } else {
        toast.success(`${year} Yılı Web Komisyon verileri toplu olarak kaydedildi.`)
        markClean()
        loadData()
      }
    } catch {
      toast.error("Toplu kaydetme işleminde hata oluştu.")
    } finally {
      setSaving(false)
    }
  }

  const handlePdfExport = () => {
    const tableColumns = [
      { key: "ay", label: "DÖNEM (AY)" },
      ...firmalar.map((f) => ({ key: `firma_${f.id}`, label: f.ad })),
      { key: "toplam", label: "TOPLAM KOMİSYON" },
      { key: "notlar", label: "AÇIKLAMA" },
    ]

    const tableRows = MONTHS.map((m) => {
      const ayYil = `${m}-${year}`
      const rowObj: Record<string, any> = {
        ay: `${m} ${year}`,
        toplam: `${formatMoney(getMonthTotal(ayYil))} ₺`,
        notlar: monthlyData[ayYil]?.notlar || "-",
      }

      firmalar.forEach((f) => {
        const num = parseCurrencyInputValue(monthlyData[ayYil]?.amounts?.[f.id] || "")
        rowObj[`firma_${f.id}`] = num > 0 ? `${formatMoney(num)} ₺` : "-"
      })

      return rowObj
    })

    openPdfReport({
      title: `${year} Yılı Web Komisyon Raporu`,
      subtitle: `${currentSube?.ad || "Genel"} Şubesi - 14 No Firmaları Web Komisyon Gelirleri`,
      headers: tableColumns.map((c) => c.label),
      rows: tableRows.map((r) => tableColumns.map((c) => r[c.key])),
    })
  }

  const visibleMonths = selectedMonth === "ALL"
    ? MONTHS
    : MONTHS.filter((m) => m === selectedMonth)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        <span className="font-medium">Web komisyon verileri yükleniyor...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header Banner - Sleek Emerald/Slate Financial Theme */}
      <div className="flex flex-col gap-4 rounded-xl bg-gradient-to-r from-emerald-800 via-teal-700 to-slate-900 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-white/10 backdrop-blur">
            <Globe className="h-7 w-7 text-emerald-200 transition-transform duration-300 hover:rotate-12 hover:scale-110" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Web Komisyon Tablosu</h1>
            <p className="text-xs text-emerald-100 sm:text-sm">
              14 No Firmalarının Aylık Web Komisyon Girişleri ve Gelir Hesaplamaları
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-slate-950/40 p-1 border border-emerald-500/30">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setYear(year - 1)}
              className="h-8 w-8 text-white hover:bg-emerald-600/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
              <SelectTrigger className="h-8 w-24 border-0 bg-transparent text-white font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} Yılı
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setYear(year + 1)}
              className="h-8 w-8 text-white hover:bg-emerald-600/50"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 w-36 border-emerald-500/40 bg-slate-950/40 text-white font-medium">
              <SelectValue placeholder="Dönem Seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tüm Yıl Tablosu</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m} Ayı
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handlePdfExport}
            variant="outline"
            size="sm"
            className="h-9 border-emerald-400/40 bg-white/10 text-white hover:bg-white/20"
          >
            <Download className="mr-1.5 h-4 w-4" />
            PDF Rapor
          </Button>

          <Button
            onClick={saveAllData}
            disabled={saving}
            size="sm"
            className="h-9 bg-emerald-600 font-semibold text-white hover:bg-emerald-500 shadow-md"
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Tümünü Kaydet
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-600 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Yıllık Toplam Web Komisyon
            </CardTitle>
            <Wallet className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formatMoney(grandTotal)} ₺</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {year} Yılı Toplam Geliri ({activeMonthsCount} ay dolu)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Aylık Ortalama Komisyon
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-teal-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {formatMoney(activeMonthsCount > 0 ? grandTotal / activeMonthsCount : 0)} ₺
            </div>
            <p className="mt-1 text-xs text-muted-foreground">İşlem Yapılan Aylar Ortalaması</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lider 14 No Firması
            </CardTitle>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-foreground truncate">
              {topFirm ? topFirm.firma.ad : "Henüz Veri Yok"}
            </div>
            <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              {topFirm ? `${formatMoney(topFirm.total)} ₺ Toplam` : "Veri girilince gösterilir"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              14 No Firma Sayısı
            </CardTitle>
            <BarChart3 className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{firmalar.length} Firma</div>
            <p className="mt-1 text-xs text-muted-foreground">Sistemdeki Aktif 14 No Firmaları</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Income Statement Table with Arrow Keys Navigation & Dynamic Firm Colors */}
      <Card className="overflow-hidden border shadow-md">
        <CardHeader className="bg-muted/40 border-b p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold">14 No Firmaları Web Komisyon Gelir Tablosu ({year})</h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              ⌨️ Yön tuşları (⬆️⬇️⬅️➡️) ile hücreler arasında rahatça dolaşabilirsiniz.
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {firmalar.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              14 No Şubesinde tanımlı firma bulunamadı. Genel Ayarlar'dan firma ekleyebilirsiniz.
            </div>
          ) : (
            <table
              onKeyDown={handleSpreadsheetKeyDown}
              className="w-full text-left border-collapse text-xs sm:text-sm select-none"
            >
              <thead>
                <tr className="border-b bg-slate-900 text-white font-bold">
                  <th className="p-3 w-32 border-r border-slate-800">DÖNEM (AY)</th>
                  {firmalar.map((firma) => {
                    const colorClass = getColumnColorClass(firma.color || "")
                    const colorStyle = getColumnColorStyle(firma.color || "")
                    const textColor = getColumnTextColor(firma.color || "")

                    return (
                      <th
                        key={firma.id}
                        className="p-3 min-w-[140px] border-r border-slate-800 text-center"
                      >
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded text-xs font-black uppercase tracking-wider shadow-sm",
                            colorClass || "bg-amber-500",
                            textColor
                          )}
                          style={colorStyle}
                        >
                          {firma.ad}
                        </span>
                      </th>
                    )
                  })}
                  <th className="p-3 w-44 border-r border-slate-800 text-right bg-emerald-950 text-emerald-200 font-black">
                    TOPLAM KOMİSYON
                  </th>
                  <th className="p-3 min-w-[160px] border-r border-slate-800">AÇIKLAMA</th>
                  <th className="p-3 w-28 text-center">İŞLEM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleMonths.map((m, monthIdx) => {
                  const ayYil = `${m}-${year}`
                  const monthTotal = getMonthTotal(ayYil)
                  const isSaved = Boolean(savedRecords[ayYil])
                  const isSavingThis = savingMonth === ayYil

                  return (
                    <tr key={ayYil} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition-colors">
                      {/* Month Label */}
                      <td className="p-3 font-bold border-r bg-muted/20 text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-emerald-600" />
                          <span>{m} {year}</span>
                        </div>
                      </td>

                      {/* Firm Columns Input Fields */}
                      {firmalar.map((firma) => {
                        const rawVal = monthlyData[ayYil]?.amounts?.[firma.id] ?? ""
                        const numVal = parseCurrencyInputValue(rawVal)

                        return (
                          <td key={firma.id} className="p-1.5 border-r min-w-[140px]">
                            <CurrencyInput
                              value={rawVal}
                              onChange={(e) => handleAmountChange(ayYil, firma.id, e.target.value)}
                              placeholder="0"
                              showCurrencySymbol={true}
                              containerClassName={cn(
                                "h-9 w-full rounded-md border px-2 transition-all focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/40",
                                numVal > 0
                                  ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/40 dark:border-emerald-800"
                                  : "border-muted-foreground/20 bg-background"
                              )}
                              inputClassName={cn(
                                "text-right font-semibold text-xs sm:text-sm",
                                numVal > 0 ? "font-black text-emerald-800 dark:text-emerald-300" : ""
                              )}
                            />
                          </td>
                        )
                      })}

                      {/* Calculated Month Total */}
                      <td className="p-3 font-black text-right border-r bg-emerald-100/60 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200 text-sm">
                        {formatMoney(monthTotal)} ₺
                      </td>

                      {/* Notes Input */}
                      <td className="p-1.5 border-r">
                        <Input
                          type="text"
                          placeholder="Not ekle..."
                          value={monthlyData[ayYil]?.notlar || ""}
                          onChange={(e) => handleNotesChange(ayYil, e.target.value)}
                          className="h-9 text-xs border-muted-foreground/20 focus-visible:ring-emerald-600"
                        />
                      </td>

                      {/* Save Row Button */}
                      <td className="p-2 text-center whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => saveMonth(ayYil, m, MONTHS.indexOf(m))}
                          disabled={isSavingThis}
                          className={cn(
                            "h-8 px-2.5 text-xs font-semibold transition-all",
                            isSaved
                              ? "text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950/50"
                              : "text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                        >
                          {isSavingThis ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Save className="mr-1 h-3.5 w-3.5" />
                              {isSaved ? "Güncelle" : "Kaydet"}
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Table Footer: Firm Column Annual Totals & Grand Total */}
              {selectedMonth === "ALL" && (
                <tfoot>
                  <tr className="border-t-2 border-slate-900 bg-slate-900 text-white font-black">
                    <td className="p-3 border-r border-slate-800">YILLIK TOPLAM</td>
                    {firmalar.map((firma) => {
                      const firmTotal = getFirmAnnualTotal(firma.id)
                      return (
                        <td key={firma.id} className="p-3 border-r border-slate-800 text-right">
                          {formatMoney(firmTotal)} ₺
                        </td>
                      )
                    })}
                    <td className="p-3 border-r border-slate-800 text-right bg-emerald-600 text-white text-base">
                      {formatMoney(grandTotal)} ₺
                    </td>
                    <td className="p-3 border-r border-slate-800 text-xs font-normal text-slate-300">
                      Tüm 14 No Firmaları Yıllık Toplamı
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        onClick={saveAllData}
                        disabled={saving}
                        className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm"
                      >
                        Kaydet
                      </Button>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
