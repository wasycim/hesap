"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FileText, Plus, Save, Trash2, X } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  FIRMALAR_GROUP_KEY,
  ON_DORT_FIRMALAR_KEY,
  ON_DORT_FIRMA_DETAYLARI_KEY,
  TableColumnSetting,
  getColumnTextColor,
  mergeColumnSettings,
} from "@/lib/table-column-settings"
import { getLastMissingDateWithinMonth, getMonthYearFromDate, isDateInSelectedMonth } from "@/lib/date-navigation"
import { logSecurityEvent } from "@/lib/audit-log"
import { openPdfReport } from "@/lib/pdf-report"
import { getShiftBusinessDate } from "@/lib/shift-business-date"

interface GelirRow {
  id?: string
  user_id?: string
  sube_id?: string
  tarih: string
  vardiya: string
  pamukkale_turizm: number
  anadolu_ulasim: number
  inegol_seyahat: number
  alasehir_turizm: number
  unlu_1: number
  unlu_2: number
  pamukkale_kargo: number
  diger_komisyon: number
  kasa_gelen: number
  toplam: number
  giderler: number
  kalan: number
  durum: string
  custom_values: Record<string, any>
}

interface GelirSpreadsheetProps {
  month: string
  year: number
}

interface GelirFirma {
  id: string
  ad: string
  color?: string
}

interface OnDortFirma {
  id: string
  ad: string
  color?: string
}

const HEADER_COLORS: Record<string, string> = {
  tarih: "bg-green-600",
  vardiya: "bg-blue-600",
  pamukkale_turizm: "bg-yellow-500",
  anadolu_ulasim: "bg-yellow-500",
  inegol_seyahat: "bg-yellow-500",
  alasehir_turizm: "bg-yellow-500",
  unlu_1: "bg-yellow-500",
  unlu_2: "bg-yellow-500",
  pamukkale_kargo: "bg-yellow-500",
  [ON_DORT_FIRMALAR_KEY]: "bg-lime-600",
  diger_komisyon: "bg-gray-500",
  kasa_gelen: "bg-purple-600",
  toplam: "bg-green-600",
  giderler: "bg-red-600",
  kalan: "bg-gray-700",
  durum: "bg-orange-200",
}

const HEADER_LABELS: Record<string, string> = {
  tarih: "TARİH",
  vardiya: "VARDİYA",
  pamukkale_turizm: "PAMUKKALE TURİZM",
  anadolu_ulasim: "ANADOLU ULAŞIM",
  inegol_seyahat: "İNEGÖL SEYAHAT",
  alasehir_turizm: "ALAŞEHİR TURİZM",
  unlu_1: "ÜNLÜ",
  unlu_2: "ÜNLÜ",
  pamukkale_kargo: "PAMUKKALE KARGO",
  [ON_DORT_FIRMALAR_KEY]: "14 NO FİRMALAR",
  diger_komisyon: "DİĞER KOMİSYON",
  kasa_gelen: "KASA-GELEN",
  toplam: "TOPLAM",
  giderler: "GİDERLER",
  kalan: "KALAN",
  durum: "DURUM",
}

const COLUMNS = [
  "tarih", "vardiya", "pamukkale_turizm", "anadolu_ulasim", "inegol_seyahat", 
  "alasehir_turizm", "unlu_1", "unlu_2", "pamukkale_kargo",
  ON_DORT_FIRMALAR_KEY, "diger_komisyon", "kasa_gelen", "toplam", "giderler", "kalan", "durum"
]

const VARDIYASIZ_SUBELER = ["carsi", "darica"]
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

function compareDateVardiya(a: Pick<GelirRow, "tarih" | "vardiya">, b: Pick<GelirRow, "tarih" | "vardiya">) {
  const dateCompare = b.tarih.localeCompare(a.tarih)
  if (dateCompare !== 0) return dateCompare
  return (VARDIYA_SIRASI[a.vardiya] ?? 99) - (VARDIYA_SIRASI[b.vardiya] ?? 99)
}

function getOnDortFirmaDetails(row: GelirRow): Record<string, number> {
  const value = row.custom_values?.[ON_DORT_FIRMA_DETAYLARI_KEY]
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value).map(([key, amount]) => [key, Number(amount) || 0]),
  )
}

function handleSpreadsheetKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  const input = e.currentTarget
  const cell = input.parentElement // <td>
  if (!cell) return
  const row = cell.parentElement // <tr>
  if (!row) return
  const tableBody = row.parentElement // <tbody>
  if (!tableBody) return

  const colIndex = Array.from(row.children).indexOf(cell)
  const rowIndex = Array.from(tableBody.children).indexOf(row)

  let targetInput: HTMLInputElement | null = null

  if (e.key === "ArrowUp") {
    let currRowIndex = rowIndex - 1
    while (currRowIndex >= 0) {
      const prevRow = tableBody.children[currRowIndex]
      const targetCell = prevRow?.children[colIndex]
      const foundInput = targetCell?.querySelector("input")
      if (foundInput && !foundInput.disabled && foundInput.type !== "hidden") {
        targetInput = foundInput as HTMLInputElement
        break
      }
      currRowIndex--
    }
  } else if (e.key === "ArrowDown") {
    let currRowIndex = rowIndex + 1
    while (currRowIndex < tableBody.children.length) {
      const nextRow = tableBody.children[currRowIndex]
      const targetCell = nextRow?.children[colIndex]
      const foundInput = targetCell?.querySelector("input")
      if (foundInput && !foundInput.disabled && foundInput.type !== "hidden") {
        targetInput = foundInput as HTMLInputElement
        break
      }
      currRowIndex++
    }
  } else if (e.key === "ArrowLeft") {
    if (input.selectionStart === 0 || input.selectionStart === null) {
      let currColIndex = colIndex - 1
      while (currColIndex >= 0) {
        const targetCell = row.children[currColIndex]
        const foundInput = targetCell?.querySelector("input")
        if (foundInput && !foundInput.disabled && foundInput.type !== "hidden") {
          targetInput = foundInput as HTMLInputElement
          break
        }
        currColIndex--
      }
    }
  } else if (e.key === "ArrowRight") {
    if (input.selectionEnd === (input.value || "").length || input.selectionEnd === null) {
      let currColIndex = colIndex + 1
      while (currColIndex < row.children.length) {
        const targetCell = row.children[currColIndex]
        const foundInput = targetCell?.querySelector("input")
        if (foundInput && !foundInput.disabled && foundInput.type !== "hidden") {
          targetInput = foundInput as HTMLInputElement
          break
        }
        currColIndex++
      }
    }
  }

  if (targetInput) {
    e.preventDefault()
    targetInput.focus()
    targetInput.select()
  }
}

function calculateOnDortFirmalarTotal(details: Record<string, number>) {
  return Object.values(details).reduce((sum, amount) => sum + (Number(amount) || 0), 0)
}

function getCustomNumericTotal(customValues: Record<string, any> | null | undefined) {
  return Object.entries(customValues || {}).reduce((sum, [key, value]) => {
    if (key === ON_DORT_FIRMA_DETAYLARI_KEY) return sum
    if (value && typeof value === "object") return sum
    return sum + (Number(value) || 0)
  }, 0)
}

function recalculateGelirRow(row: GelirRow): GelirRow {
  const onDortDetails = getOnDortFirmaDetails(row)
  const onDortTotal = calculateOnDortFirmalarTotal(onDortDetails)
  const customValues = {
    ...(row.custom_values || {}),
    [ON_DORT_FIRMA_DETAYLARI_KEY]: onDortDetails,
    [ON_DORT_FIRMALAR_KEY]: onDortTotal,
  }
  const toplam =
    row.pamukkale_turizm +
    row.anadolu_ulasim +
    row.inegol_seyahat +
    row.alasehir_turizm +
    row.unlu_1 +
    row.unlu_2 +
    row.pamukkale_kargo +
    row.diger_komisyon +
    row.kasa_gelen +
    getCustomNumericTotal(customValues)

  return {
    ...row,
    custom_values: customValues,
    toplam,
    kalan: toplam - row.giderler,
  }
}

export function GelirSpreadsheet({ month, year }: GelirSpreadsheetProps) {
  const [rows, setRows] = useState<GelirRow[]>([])
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("gelir", []))
  const [firmalar, setFirmalar] = useState<GelirFirma[]>([])
  const [onDortFirmalar, setOnDortFirmalar] = useState<OnDortFirma[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offlineLoaded, setOfflineLoaded] = useState(false)
  const { currentSube, isAdmin, refreshKey, userVardiya } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  
  const ayYil = `${month}-${year}`
  const isVardiyasizSube = currentSube
    ? VARDIYASIZ_SUBELER.includes(normalizeSubeName(currentSube.ad))
    : false
  const isTekVardiya = isVardiyasizSube || (!isAdmin && (!userVardiya || userVardiya === "T"))
  const activeColumnSettings = columnSettings.filter(col => col.aktif && (!isTekVardiya || col.column_key !== "vardiya"))
  const visibleColumnItems = activeColumnSettings.flatMap(col => {
    if (col.column_key === FIRMALAR_GROUP_KEY) {
      return firmalar.map(firma => ({
        column_key: `firma_${firma.id}`,
        label: firma.ad.toLocaleUpperCase("tr-TR"),
        color: firma.color || col.color,
      }))
    }
    return [col]
  })
  const visibleColumns = visibleColumnItems.map(col => col.column_key)
  const columnColorMap = Object.fromEntries(visibleColumnItems.map(col => [col.column_key, col.color]))
  const columnLabelMap = Object.fromEntries(visibleColumnItems.map(col => [col.column_key, col.label]))

  useEffect(() => {
    // Şube değiştiğinde önce mevcut verileri temizle
    setRows([])
    
    if (currentSube) {
      loadData()
    } else {
      setLoading(false)
    }
  }, [month, year, currentSube?.id, refreshKey])

  useEffect(() => {
    registerSaveHandler(saveData)
    return () => registerSaveHandler(null)
  }, [rows, currentSube?.id, ayYil, userVardiya, isAdmin, registerSaveHandler])

  async function loadData() {
    setLoading(true)
    if (!currentSube) {
      setLoading(false)
      return
    }

    const params = new URLSearchParams({
      subeId: currentSube.id,
      month,
      year: String(year),
      ayYil,
    })

    try {
      const response = await fetch(`/api/dashboard/gelir?${params.toString()}`, { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      const fromOfflineCache = response.headers.get("X-Hesap-Offline-Cache") === "1" || response.headers.get("X-Hesap-Offline") === "1" || data?.offline === true
      setOfflineLoaded(fromOfflineCache)

      if (!response.ok) {
        toast.error(data.error || "Gelir tablosu yuklenemedi.")
        setLoading(false)
        return
      }

      setColumnSettings(mergeColumnSettings("gelir", data.columnSettings as TableColumnSetting[] | null))
      setFirmalar(data.firmalar || [])
      setOnDortFirmalar(data.onDortFirmalar || [])
      setRows(((data.rows || []) as GelirRow[])
        .filter(row => isDateInSelectedMonth(row.tarih, month, year))
        .map(row => recalculateGelirRow({ ...row, custom_values: row.custom_values || {} }))
        .sort(compareDateVardiya))
    } catch {
      toast.warning("Gelir tablosu offline cache bulunamadigi icin bos acildi.")
      setOfflineLoaded(true)
    } finally {
      setLoading(false)
    }
  }

  function getNextAdminDate(requiredVardiyalar: string[]): string {
    const completeDates = rows
      .filter(row => isDateInSelectedMonth(row.tarih, month, year))
      .map(row => row.tarih)
      .filter((date, index, dates) => dates.indexOf(date) === index)
      .filter(date => requiredVardiyalar.every(vardiya => rows.some(row => row.tarih === date && row.vardiya === vardiya)))

    return getLastMissingDateWithinMonth(completeDates, month, year) || ""
  }

  function addRow() {
    const businessDate = getShiftBusinessDate(userVardiya)
    const todayMonthYear = getMonthYearFromDate(businessDate)
    const vardiyalarToAdd = isTekVardiya ? [""] : (isAdmin ? ["S", "A"] : [userVardiya || "S"])
    const nextDate = isAdmin ? getNextAdminDate(vardiyalarToAdd) : businessDate

    if (!nextDate || !isDateInSelectedMonth(nextDate, month, year)) {
      toast.error(`${month} ${year} ayı için eklenecek yeni gün kalmadı.`)
      return
    }

    if (!isAdmin && (month !== todayMonthYear.month || year !== todayMonthYear.year)) {
      toast.error("Normal kullanıcılar sadece bugünün olduğu ayda satır ekleyebilir.")
      return
    }
    
    // Vardiyasız şubelerde tek satır, vardiyalı şubelerde admin için S ve A eklenir.
    if (!isAdmin && vardiyalarToAdd.some(vardiya => rows.some(row => row.tarih === nextDate && row.vardiya === vardiya))) {
      toast.error("Bu iş günü için zaten bir satır var.")
      return
    }
    
    const vardiyalarToCreate = isAdmin
      ? vardiyalarToAdd.filter(vardiya => !rows.some(row => row.tarih === nextDate && row.vardiya === vardiya))
      : vardiyalarToAdd

    if (vardiyalarToCreate.length === 0) {
      toast.error("Bu gun icin eklenecek eksik vardiya yok.")
      return
    }

    const newRowsToAdd: GelirRow[] = vardiyalarToCreate.map(vardiya => ({
      tarih: nextDate,
      vardiya,
      pamukkale_turizm: 0,
      anadolu_ulasim: 0,
      inegol_seyahat: 0,
      alasehir_turizm: 0,
      unlu_1: 0,
      unlu_2: 0,
      pamukkale_kargo: 0,
      diger_komisyon: 0,
      kasa_gelen: 0,
      toplam: 0,
      giderler: 0,
      kalan: 0,
      durum: "KONTROL EDİLMEDİ",
      custom_values: {},
    }))
    
    // Yeni satırı ekle ve tarihe + vardiyaya göre sırala (S önce, A sonra)
    const newRows = [...rows, ...newRowsToAdd].sort(compareDateVardiya)
    
    setRows(newRows)
    markDirty()
  }

  function deleteRow(index: number) {
    const newRows = [...rows]
    const deletedRow = newRows[index]
    newRows.splice(index, 1)
    setRows(newRows)
    markDirty()
    logSecurityEvent("row_delete", {
      table: "gelir_kayitlari",
      sube_id: currentSube?.id,
      tarih: deletedRow?.tarih,
      vardiya: deletedRow?.vardiya,
    })
  }

  function updateCell(rowIndex: number, column: string, value: string | number) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    
    const isCustomColumn = column.startsWith("custom_") || column.startsWith("firma_")

    if (isCustomColumn) {
      row.custom_values = { ...row.custom_values, [column]: Number(value) || 0 }
    } else if (column === "durum") {
      row.durum = value as string
    } else if (column !== "tarih" && column !== "toplam" && column !== "giderler" && column !== "kalan") {
      (row as any)[column] = Number(value) || 0
    }
    
    newRows[rowIndex] = recalculateGelirRow(row)
    setRows(newRows)
    markDirty()
  }

  function updateOnDortFirmaAmount(rowIndex: number, firmaId: string, value: string | number) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex], custom_values: { ...(newRows[rowIndex].custom_values || {}) } }
    const details = getOnDortFirmaDetails(row)
    details[firmaId] = Number(value) || 0
    row.custom_values[ON_DORT_FIRMA_DETAYLARI_KEY] = details
    newRows[rowIndex] = recalculateGelirRow(row)
    setRows(newRows)
    markDirty()
  }

  function removeOnDortFirma(rowIndex: number, firmaId: string) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex], custom_values: { ...(newRows[rowIndex].custom_values || {}) } }
    const details = getOnDortFirmaDetails(row)
    delete details[firmaId]
    row.custom_values[ON_DORT_FIRMA_DETAYLARI_KEY] = details
    newRows[rowIndex] = recalculateGelirRow(row)
    setRows(newRows)
    markDirty()
  }

  async function saveData() {
    setSaving(true)
    if (!currentSube) {
      setSaving(false)
      return false
    }

    // Sadece düzenleyebildiğim vardiyaları filtrele
    // userVardiya null ise hepsini, değilse sadece kendi vardiyamı kaydedebilirim
    const businessDate = getShiftBusinessDate(userVardiya)
    const editableRows = rows.filter(row => {
      if (!isAdmin && row.tarih !== businessDate) return false
      // Admin veya vardiyası olmayan kullanıcı her şeyi kaydedebilir
      if (isTekVardiya || isAdmin) return true
      // Sadece kendi vardiyamı kaydedebilirim
      return row.vardiya === userVardiya
    })

    const invalidDateIndex = editableRows.findIndex(row => !isDateInSelectedMonth(row.tarih, month, year))
    if (invalidDateIndex !== -1) {
      toast.error(`${invalidDateIndex + 1}. satır ${month} ${year} dışında olduğu için kaydedilemez.`)
      setSaving(false)
      return false
    }

    const response = await fetch("/api/dashboard/gelir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subeId: currentSube.id,
        month,
        year,
        ayYil,
        rows: editableRows,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok && !result.queued) {
      toast.error(result.error || "Gelir kaydedilemedi.")
      setSaving(false)
      return false
    }

    setSaving(false)
    markClean()
    if (result.queued || response.status === 202) {
      toast.success("Gelir kaydi offline kuyruğa alindi. Internet gelince senkronize edilecek.")
    } else {
      toast.success("Değişiklikler kaydedildi ✅")
      loadData()
    }
    return true
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function getCellValue(row: GelirRow, col: string) {
    if (col === ON_DORT_FIRMALAR_KEY) {
      return Number(row.custom_values?.[ON_DORT_FIRMALAR_KEY]) || calculateOnDortFirmalarTotal(getOnDortFirmaDetails(row))
    }
    return col.startsWith("custom_") || col.startsWith("firma_") ? row.custom_values?.[col] : (row as any)[col]
  }

  // Sütun toplamları
  const columnTotals = visibleColumns.reduce((acc, col) => {
    if (col !== "tarih" && col !== "durum" && col !== "vardiya") {
      acc[col] = rows.reduce((sum, row) => sum + (getCellValue(row, col) || 0), 0)
    }
    return acc
  }, {} as Record<string, number>)

  function exportPdf() {
    openPdfReport({
      title: "Gelir Tablosu Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Gelir", value: `${formatNumber(columnTotals.toplam || 0)} TL` },
        { label: "Toplam Gider", value: `${formatNumber(columnTotals.giderler || 0)} TL` },
        { label: "Kalan", value: `${formatNumber(columnTotals.kalan || 0)} TL` },
      ],
      tables: [{
        title: "Aylık Gelir Detayı",
        headers: visibleColumns.map(col => columnLabelMap[col] || HEADER_LABELS[col] || col),
        firstColumnWidth: "58px",
        rows: [
          ...rows.map(row => visibleColumns.map(col => {
            if (col === "tarih") return formatDate(row.tarih)
            if (col === "vardiya") return row.vardiya || "Tek"
            if (col === "durum") return row.durum
            return `${formatNumber(Number(getCellValue(row, col)) || 0)} TL`
          })),
          visibleColumns.map(col => {
            if (col === "tarih") return "TOPLAM"
            if (col === "vardiya" || col === "durum") return ""
            return `${formatNumber(columnTotals[col] || 0)} TL`
          }),
        ],
      }],
    })
    return

    const identityColumns = visibleColumns.filter(col => col === "tarih" || col === "vardiya")
    const dataColumns = visibleColumns.filter(col => col !== "tarih" && col !== "vardiya")
    const columnGroups = Array.from({ length: Math.ceil(dataColumns.length / 6) }, (_, index) => dataColumns.slice(index * 6, index * 6 + 6))
    const tables = columnGroups.map((group, index) => {
      const groupColumns = [...identityColumns, ...group]
      return {
        title: `Aylık Gelir Detayı ${columnGroups.length > 1 ? `(${index + 1}/${columnGroups.length})` : ""}`,
        headers: groupColumns.map(col => columnLabelMap[col] || HEADER_LABELS[col] || col),
        firstColumnWidth: "82px",
        rows: [
          ...rows.map(row => groupColumns.map(col => {
            if (col === "tarih") return formatDate(row.tarih)
            if (col === "vardiya") return row.vardiya || "Tek"
            if (col === "durum") return row.durum
            return `${formatNumber(Number(getCellValue(row, col)) || 0)} TL`
          })),
          groupColumns.map(col => {
            if (col === "tarih") return "TOPLAM"
            if (col === "vardiya" || col === "durum") return ""
            return `${formatNumber(columnTotals[col] || 0)} TL`
          }),
        ],
      }
    })

    openPdfReport({
      title: "Gelir Tablosu Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Gelir", value: `${formatNumber(columnTotals.toplam || 0)} TL` },
        { label: "Toplam Gider", value: `${formatNumber(columnTotals.giderler || 0)} TL` },
        { label: "Kalan", value: `${formatNumber(columnTotals.kalan || 0)} TL` },
      ],
      tables,
    })
  }

  function renderOnDortFirmaCell(row: GelirRow, rowIndex: number, canEdit: boolean) {
    const details = getOnDortFirmaDetails(row)
    const selectedEntries = Object.entries(details)
    const selectedIds = new Set(selectedEntries.map(([firmaId]) => firmaId))
    const availableFirmalar = onDortFirmalar.filter(firma => !selectedIds.has(firma.id))
    const total = calculateOnDortFirmalarTotal(details)

    return (
      <div className="flex min-w-[360px] items-center gap-2 p-1">
        {canEdit ? (
          <select
            value=""
            onChange={(event) => {
              const firmaId = event.target.value
              if (!firmaId) return
              updateOnDortFirmaAmount(rowIndex, firmaId, details[firmaId] || 0)
            }}
            disabled={availableFirmalar.length === 0}
            className="h-8 min-w-0 flex-1 rounded border bg-background px-2 text-xs text-foreground outline-none focus:border-lime-500"
          >
            <option value="">14 No firma seç</option>
            {availableFirmalar.map(firma => (
              <option key={firma.id} value={firma.id}>{firma.ad}</option>
            ))}
          </select>
        ) : null}

        {selectedEntries.length > 0 ? (
          <div className="flex max-w-[520px] flex-wrap gap-1">
            {selectedEntries.map(([firmaId, amount]) => {
              const firma = onDortFirmalar.find(item => item.id === firmaId)
              return (
                <label key={firmaId} className="flex items-center gap-1 rounded border bg-muted/40 px-1 py-0.5 text-xs">
                  <span className="max-w-20 truncate font-medium text-foreground">
                    {firma?.ad || firmaId}
                  </span>
                  {canEdit ? (
                    <>
                      <input
                        type="number"
                        value={amount || ""}
                        onChange={(event) => updateOnDortFirmaAmount(rowIndex, firmaId, event.target.value)}
                        className="h-7 w-20 bg-transparent text-right outline-none"
                        placeholder="TL"
                        title="14 No firma tutarı"
                      />
                      <button
                        type="button"
                        onClick={() => removeOnDortFirma(rowIndex, firmaId)}
                        className="rounded p-0.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20"
                        aria-label="Firmayı kaldır"
                        title="Firmayı satırdan kaldır"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-foreground">{formatNumber(amount)} ₺</span>
                  )}
                </label>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Firma yok</span>
        )}

        <span className="min-w-24 text-right text-xs font-bold text-lime-700 dark:text-lime-300">
          {formatNumber(total)} TL
        </span>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={addRow} size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-1" /> Satır Ekle
        </Button>
        <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button onClick={exportPdf} size="sm" variant="outline" disabled={rows.length === 0}>
          <FileText className="w-4 h-4 mr-1" /> PDF
        </Button>
        {offlineLoaded ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
            Offline cache
          </span>
        ) : null}
      </div>

      <div className="sticky-table-scroll rounded-lg border bg-card">
        <table className="sticky-table min-w-max text-sm">
          <thead>
            <tr>
              <th className="w-10 border bg-muted p-2 text-muted-foreground">#</th>
              {visibleColumns.map(col => (
                <th 
                  key={col} 
                  className={`p-2 border font-semibold whitespace-nowrap ${columnColorMap[col] || HEADER_COLORS[col]} ${getColumnTextColor(columnColorMap[col] || HEADER_COLORS[col])}`}
                >
                  {columnLabelMap[col] || HEADER_LABELS[col] || col}
                </th>
              ))}
              <th className="w-10 border bg-muted p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Vardiya kontrolü: userVardiya null ise hepsini düzenleyebilir, değilse sadece kendi vardiyasını
              const canEditVardiya = isAdmin || (row.tarih === getShiftBusinessDate(userVardiya) && (isTekVardiya || userVardiya === row.vardiya))
              const canEdit = canEditVardiya
              
              return (
              <tr key={rowIndex} className={`hover:bg-muted/50 ${!canEditVardiya ? "bg-muted/50 opacity-70" : ""}`}>
                <td className="border p-1 text-center text-muted-foreground">{rowIndex + 1}</td>
                {visibleColumns.map(col => (
                  <td key={col} className="p-0 border">
                    {col === "tarih" ? (
                      <div className="bg-muted px-2 py-1 text-center font-medium text-foreground">
                        {formatDate(row.tarih)}
                      </div>
                    ) : col === "vardiya" ? (
                      <div className={`px-2 py-1 text-center font-bold ${
                        row.vardiya === "S" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" : "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200"
                      }`}>
                        {row.vardiya}
                      </div>
                    ) : col === ON_DORT_FIRMALAR_KEY ? (
                      renderOnDortFirmaCell(row, rowIndex, canEdit)
                    ) : col === "toplam" || col === "kalan" ? (
                      <div className={`px-2 py-1 text-right font-semibold ${
                        col === "kalan" ? (row.kalan >= 0 ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200") : "bg-muted text-foreground"
                      }`}>
                        {formatNumber(getCellValue(row, col))} ₺
                      </div>
                    ) : col === "durum" ? (
                      isAdmin ? (
                        <select
                          value={row.durum}
                          onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                          className={`w-full px-2 py-1.5 text-center font-medium cursor-pointer border-0 ${
                            row.durum === "KONTROL EDİLDİ" 
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" 
                              : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                          }`}
                        >
                          <option value="KONTROL EDİLMEDİ" className="bg-red-100 text-red-700">KONTROL EDİLMEDİ</option>
                          <option value="KONTROL EDİLDİ" className="bg-emerald-100 text-emerald-700">KONTROL EDİLDİ</option>
                        </select>
                      ) : (
                        <div className={`w-full px-2 py-1.5 text-center font-medium ${
                          row.durum === "KONTROL EDİLDİ" 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200" 
                            : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200"
                        }`}>
                          {row.durum}
                        </div>
                      )
                    ) : col === "giderler" ? (
                      <div className="bg-red-50 px-2 py-1 text-right font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200">
                        {formatNumber(row.giderler)} ₺
                      </div>
                    ) : canEdit ? (
                      <input
                        type="number"
                        value={getCellValue(row, col) || ""}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        onKeyDown={handleSpreadsheetKeyDown}
                        className="w-full bg-transparent px-2 py-1 text-right text-foreground focus:bg-blue-50 focus:outline-none dark:focus:bg-blue-500/20"
                        placeholder="0,00"
                      />
                    ) : (
                      <div className="px-2 py-1 text-right text-muted-foreground">
                        {formatNumber(getCellValue(row, col) || 0)} ₺
                      </div>
                    )}
                  </td>
                ))}
                <td className="p-1 border">
                  {canEdit && (
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            )})}
            
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="p-8 text-center text-muted-foreground">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted font-semibold text-foreground">
                <td className="p-2 border"></td>
                <td className="p-2 border text-center">TOPLAM</td>
                {visibleColumns.slice(1).map(col => (
                  <td key={col} className="p-2 border text-right">
                    {col !== "durum" && col !== "vardiya" && columnTotals[col] !== undefined 
                      ? `${formatNumber(columnTotals[col])} ₺` 
                      : ""}
                  </td>
                ))}
                <td className="p-2 border"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
