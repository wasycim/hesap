"use client"

import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { FileText, Plus, Save, Trash2, ChevronLeft, ChevronRight, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  compareDateDescending,
  getLastMissingDateWithinMonth,
  getLatestEditableDateWithinMonth,
  getLocalDateString,
  getMonthEndDate,
  getMonthStartDate,
  getMonthYearFromDate,
  isDateInSelectedMonth,
  makeYearWindow,
} from "@/lib/date-navigation"
import { getEveningCutoffBusinessDate } from "@/lib/evening-cutoff-business-date"
import { openPdfReport } from "@/lib/pdf-report"
import { CurrencyInput, parseCurrencyInputValue } from "@/components/dashboard/currency-input"
import { handleSpreadsheetKeyDown } from "@/components/dashboard/spreadsheet-navigation"

interface KargoRow {
  id?: string
  tarih: string
  fis_no: string
  gonderilen_yer: string
  alinan_tutar: number
  satilan_tutar: number
  kalan_kar: number
}

interface KargoFirma {
  id: string
  ad: string
  kdv_dahil?: boolean | null
}

interface KargoFirmaNotu {
  id?: string
  tarih: string
  not_metni: string
  created_at?: string | null
}

interface OdemeHareketi {
  id: string
  tarih: string
  ay_yil: string | null
  toplam_borc: number
  odenen: number
  kalan_borc: number
  notlar: string
  created_at: string | null
}

const currentDate = new Date()

const HEADER_COLORS: Record<string, string> = {
  tarih: "bg-green-600 text-white",
  fis_no: "bg-muted text-foreground",
  gonderilen_yer: "bg-gray-500 text-white",
  alinan_tutar: "bg-yellow-500 text-white",
  satilan_tutar: "bg-green-600 text-white",
  kalan_kar: "bg-orange-500 text-white",
}

const HEADER_LABELS: Record<string, string> = {
  tarih: "TARİH",
  fis_no: "FİŞ NO",
  gonderilen_yer: "GÖNDERİLEN YER",
  alinan_tutar: "ALINAN TUTAR",
  satilan_tutar: "SATILAN TUTAR",
  kalan_kar: "KALAN KAR",
}

const COLUMNS = ["tarih", "fis_no", "gonderilen_yer", "alinan_tutar", "satilan_tutar", "kalan_kar"]
const KDV_RATE = 0.20
const PREVIOUS_MONTH_DEBT_PDF_KEY = "kargo-cari-previous-month-debt-pdf"

export default function KargoCariPage({ params }: { params: Promise<{ firmaId: string }> }) {
  const resolvedParams = use(params)
  const [firma, setFirma] = useState<KargoFirma | null>(null)
  const [rows, setRows] = useState<KargoRow[]>([])
  const [notlar, setNotlar] = useState<KargoFirmaNotu[]>([])
  const [deletedNotIds, setDeletedNotIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [customerPdf, setCustomerPdf] = useState(false)
  const [withKdv, setWithKdv] = useState(false)
  const [includePreviousMonthDebtDetails, setIncludePreviousMonthDebtDetails] = useState(() => {
    if (typeof window === "undefined") return false
    return window.localStorage.getItem(PREVIOUS_MONTH_DEBT_PDF_KEY) === "true"
  })
  const [month, setMonth] = useState(MONTHS[currentDate.getMonth()])
  const [year, setYear] = useState(currentDate.getFullYear())
  const years = makeYearWindow(year)
  const supabase = createClient()
  const { currentSube, isAdmin, userVardiya } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()

  const ayYil = `${month}-${year}`
  const selectedMonthStart = getMonthStartDate(month, year)
  const selectedMonthEnd = getMonthEndDate(month, year)
  const selectedMonthIndex = MONTHS.findIndex(item => item === month)

  useEffect(() => {
    if (currentSube) {
      fetchFirma()
    }
  }, [resolvedParams.firmaId, currentSube?.id])

  useEffect(() => {
    if (firma) {
      loadData()

      const channel = supabase
        .channel(`kargo_cari_changes_${currentSube?.id || "none"}_${firma.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kargo_cari_kayitlar',
            filter: `firma_id=eq.${firma.id}`,
          },
          () => {
            loadData()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [firma, month, year, currentSube?.id])

  useEffect(() => {
    registerSaveHandler(saveData)
    return () => registerSaveHandler(null)
  }, [rows, firma?.id, currentSube?.id, month, year, isAdmin, userVardiya])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(PREVIOUS_MONTH_DEBT_PDF_KEY, includePreviousMonthDebtDetails ? "true" : "false")
  }, [includePreviousMonthDebtDetails])

  async function fetchFirma() {
    if (!currentSube) {
      setLoading(false)
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad, kdv_dahil")
      .eq("id", resolvedParams.firmaId)
      .eq("sube_id", currentSube.id)
      .single()

    if (!error && data) {
      setFirma(data)
    } else {
      setFirma(null)
      setRows([])
    }

    setLoading(false)
  }

  function mapKargoRow(row: any): KargoRow {
    return {
      id: row.id,
      tarih: row.tarih,
      fis_no: row.fis_no || "",
      gonderilen_yer: row.gonderilen_yer || "",
      alinan_tutar: Number(row.alinan_tutar) || 0,
      satilan_tutar: Number(row.satilan_tutar) || 0,
      kalan_kar: Number(row.kalan_kar) || 0,
    }
  }

  async function loadData() {
    if (!firma) return false
    
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    const [{ data, error }, notlarResult] = await Promise.all([
      supabase
        .from("kargo_cari_kayitlar")
        .select("*")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: false }),
      supabase
        .from("kargo_cari_notlari")
        .select("id, tarih, not_metni, created_at")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)
        .gte("tarih", selectedMonthStart)
        .lte("tarih", selectedMonthEnd)
        .order("tarih", { ascending: false })
        .order("created_at", { ascending: false }),
    ])

    if (!error && data) {
      setRows(data.filter(row => isDateInSelectedMonth(row.tarih, month, year)).map(mapKargoRow).sort(compareDateDescending))
    }

    if (!notlarResult.error) {
      setNotlar((notlarResult.data || []).map(item => ({
        id: item.id,
        tarih: item.tarih,
        not_metni: item.not_metni || "",
        created_at: item.created_at,
      })))
      setDeletedNotIds([])
    } else if (notlarResult.error.code === "42P01") {
      toast.error("Firma notları tablosu yok. 020 migration dosyasını uygulayın.")
    } else {
      toast.error("Firma notları okunamadı: " + notlarResult.error.message)
    }
    setLoading(false)
  }

  function formatEditableDate(value: string): string {
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!isoMatch) return value
    return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`
  }

  function normalizeEditableDate(value: string): string | null {
    const raw = value.trim()
    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    const shortMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/)

    let dateYear: number
    let dateMonth: number
    let dateDay: number

    if (isoMatch) {
      dateYear = Number(isoMatch[1])
      dateMonth = Number(isoMatch[2])
      dateDay = Number(isoMatch[3])
    } else if (shortMatch) {
      dateDay = Number(shortMatch[1])
      dateMonth = Number(shortMatch[2])
      dateYear = shortMatch[3] ? Number(shortMatch[3]) : year
      if (dateYear < 100) dateYear += 2000
    } else {
      return null
    }

    const parsed = new Date(dateYear, dateMonth - 1, dateDay)
    if (
      parsed.getFullYear() !== dateYear ||
      parsed.getMonth() !== dateMonth - 1 ||
      parsed.getDate() !== dateDay
    ) {
      return null
    }

    return `${dateYear}-${String(dateMonth).padStart(2, "0")}-${String(dateDay).padStart(2, "0")}`
  }

  function commitDateCell(rowIndex: number, value: string) {
    const normalized = normalizeEditableDate(value)
    if (!normalized) {
      toast.error("Tarih formatı geçersiz. Örnek: 12.06 veya 12.06.2026")
      return
    }
    updateCell(rowIndex, "tarih", normalized)
  }

  function normalizeRowsBeforeSave(): KargoRow[] | null {
    const normalizedRows: KargoRow[] = []

    for (const [index, row] of rows.entries()) {
      const normalizedDate = normalizeEditableDate(row.tarih)
      if (!normalizedDate) {
        toast.error(`${index + 1}. satırdaki tarih geçersiz. Örnek: 12.06 veya 12.06.2026`)
        return null
      }
      normalizedRows.push({ ...row, tarih: normalizedDate })
    }

    return normalizedRows
  }

  function addRow() {
    if (!isAdmin) {
      const editableDate = getEveningCutoffBusinessDate(userVardiya)
      const editableMonthYear = getMonthYearFromDate(editableDate)

      if (month !== editableMonthYear.month || year !== editableMonthYear.year) {
        toast.error("Normal kullanıcılar sadece aktif kargo cari iş gününün olduğu ayda satır ekleyebilir.")
        return
      }

      const newRow: KargoRow = {
        tarih: editableDate,
        fis_no: "",
        gonderilen_yer: "",
        alinan_tutar: 0,
        satilan_tutar: 0,
        kalan_kar: 0,
      }
      setRows([...rows, newRow].sort(compareDateDescending))
      markDirty()
      return
    }

    const suggestedDate = getLastMissingDateWithinMonth(rows.map(row => row.tarih), month, year)
      || getLatestEditableDateWithinMonth(month, year)
      || selectedMonthEnd
    const newRow: KargoRow = {
      tarih: suggestedDate,
      fis_no: "",
      gonderilen_yer: "",
      alinan_tutar: 0,
      satilan_tutar: 0,
      kalan_kar: 0,
    }
    setRows([...rows, newRow].sort(compareDateDescending))
    markDirty()
  }

  function deleteRow(index: number) {
    const row = rows[index]
    const editableDate = getEveningCutoffBusinessDate(userVardiya)
    if (!isAdmin && row?.tarih !== editableDate) {
      toast.error("Bu satır aktif kargo cari iş gününe ait olmadığı için silinemez.")
      return
    }

    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
    markDirty()
  }

  // Fiş No'yu 6 haneli formata çevir
  function addNote() {
    const today = getLocalDateString()
    setNotlar(prev => [{ tarih: isDateInSelectedMonth(today, month, year) ? today : selectedMonthStart, not_metni: "" }, ...prev])
  }

  function updateNote(index: number, patch: Partial<KargoFirmaNotu>) {
    setNotlar(prev => prev.map((note, noteIndex) => (
      noteIndex === index ? { ...note, ...patch } : note
    )))
  }

  function deleteNote(index: number) {
    const note = notlar[index]
    if (note?.id) {
      setDeletedNotIds(prev => [...prev, note.id!])
    }
    setNotlar(prev => prev.filter((_, noteIndex) => noteIndex !== index))
  }

  async function saveNotes() {
    if (!firma || !currentSube) return false

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false

    const invalidIndex = notlar.findIndex(note => !note.tarih || !note.not_metni.trim())
    if (invalidIndex !== -1) {
      toast.error(`${invalidIndex + 1}. not için tarih ve not alanı zorunludur.`)
      return false
    }

    const invalidMonthIndex = notlar.findIndex(note => !isDateInSelectedMonth(note.tarih, month, year))
    if (invalidMonthIndex !== -1) {
      toast.error(`${invalidMonthIndex + 1}. not seçili ayın dışında.`)
      return false
    }

    setSavingNotes(true)

    try {
      if (deletedNotIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("kargo_cari_notlari")
          .delete()
          .in("id", deletedNotIds)

        if (deleteError) throw deleteError
      }

      for (const note of notlar) {
        if (note.id) {
          const { error } = await supabase
            .from("kargo_cari_notlari")
            .update({
              tarih: note.tarih,
              not_metni: note.not_metni.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", note.id)

          if (error) throw error
        } else {
          const { error } = await supabase
            .from("kargo_cari_notlari")
            .insert({
              user_id: user.id,
              sube_id: currentSube.id,
              firma_id: firma.id,
              tarih: note.tarih,
              not_metni: note.not_metni.trim(),
            })

          if (error) throw error
        }
      }

      setDeletedNotIds([])
      await loadData()
      toast.success("Firma notları kaydedildi.")
      setSavingNotes(false)
      return true
    } catch (error: any) {
      toast.error(error?.message || "Firma notları kaydedilemedi.")
      setSavingNotes(false)
      return false
    }
  }

  function formatFisNo(value: string): string {
    // Sadece rakamları al
    const numericValue = value.replace(/\D/g, "")
    if (!numericValue) return ""
    // 6 haneli formata çevir
    return numericValue.padStart(6, "0").slice(-6)
  }

  function updateCell(rowIndex: number, column: string, value: string | number) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    const editableDate = getEveningCutoffBusinessDate(userVardiya)

    if (!isAdmin && row.tarih !== editableDate) {
      toast.error("Normal kullanıcılar sadece aktif kargo cari iş gününü düzenleyebilir.")
      return
    }

    if (column === "tarih") {
      row.tarih = String(value)
    } else if (column === "fis_no") {
      // Fiş no için sadece sayı girişi
      const numericValue = String(value).replace(/\D/g, "")
      row.fis_no = numericValue
    } else if (column === "gonderilen_yer") {
      row.gonderilen_yer = value as string
    } else if (column !== "tarih" && column !== "kalan_kar") {
      (row as any)[column] = Number(value) || 0
    }

    // Kalan Kar = Alinan Tutar - Satilan Tutar (kar = aldığımız - sattığımız)
    row.kalan_kar = row.alinan_tutar - row.satilan_tutar

    newRows[rowIndex] = row
    setRows(newRows)
    markDirty()
  }

  async function saveData() {
    if (!firma) return

    const normalizedRows = normalizeRowsBeforeSave()
    if (!normalizedRows) return false

    const editableDate = getEveningCutoffBusinessDate(userVardiya)
    const rowsToSave = isAdmin ? normalizedRows : normalizedRows.filter(row => row.tarih === editableDate)

    if (!isAdmin && !isDateInSelectedMonth(editableDate, month, year)) {
      toast.error("Kaydetmek için aktif kargo cari iş gününün olduğu ayı seçmelisiniz.")
      return false
    }

    const invalidDateIndex = rowsToSave.findIndex(row => !isDateInSelectedMonth(row.tarih, month, year))
    if (invalidDateIndex !== -1) {
      toast.error(`${invalidDateIndex + 1}. satır ${month} ${year} dışında olduğu için kaydedilemez.`)
      return false
    }

    const missingFisIndex = rowsToSave.findIndex(row => !row.fis_no?.trim())
    if (missingFisIndex !== -1) {
      toast.error(`${missingFisIndex + 1}. satır için fiş no zorunludur.`)
      return false
    }
    
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return false
    }

    // Admin tüm ayı, normal kullanıcı sadece aktif kargo cari iş gününü yeniler.
    let deleteQuery = supabase
      .from("kargo_cari_kayitlar")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("firma_id", firma.id)
      .eq("ay_yil", ayYil)

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("tarih", editableDate)
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.log("Kargo cari silme hatası:", deleteError)
      toast.error("Kargo cari silinemedi: " + deleteError.message)
      setSaving(false)
      return false
    }

    // Yeni kayıtları ekle
    if (rowsToSave.length > 0) {
      const insertData = rowsToSave.map(row => ({
        user_id: user.id,
        sube_id: currentSube.id,
        firma_id: firma.id,
        ay_yil: ayYil,
        tarih: row.tarih,
        fis_no: row.fis_no,
        gonderilen_yer: row.gonderilen_yer,
        alinan_tutar: row.alinan_tutar,
        satilan_tutar: row.satilan_tutar,
        kalan_kar: row.kalan_kar,
      }))

      const { error: insertError } = await supabase.from("kargo_cari_kayitlar").insert(insertData)

      if (insertError) {
        console.log("Kargo cari kaydetme hatası:", insertError)
        toast.error("Kargo cari kaydedilemedi: " + insertError.message)
        setSaving(false)
        return false
      }
    }

    setSaving(false)
    markClean()
    setRows(normalizedRows.sort(compareDateDescending))
    await loadData()
    toast.success("Kargo cari kaydedildi.")
    return true
  }

  const prevMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(MONTHS[11])
        setYear(year - 1)
      }
    } else {
      if (year === START_YEAR && currentIndex <= START_MONTH_INDEX) return
      setMonth(MONTHS[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 11) {
      setMonth(MONTHS[0])
      setYear(year + 1)
    } else {
      setMonth(MONTHS[currentIndex + 1])
    }
  }

  function getPreviousMonthSelection() {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex <= 0) return { month: MONTHS[11], year: year - 1 }
    return { month: MONTHS[currentIndex - 1], year }
  }

  async function loadRowsForPeriod(targetMonth: string, targetYear: number) {
    if (!firma || !currentSube) return []

    const targetAyYil = `${targetMonth}-${targetYear}`
    const { data, error } = await supabase
      .from("kargo_cari_kayitlar")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("firma_id", firma.id)
      .eq("ay_yil", targetAyYil)
      .order("tarih", { ascending: false })

    if (error) throw error

    return (data || [])
      .filter(row => isDateInSelectedMonth(row.tarih, targetMonth, targetYear))
      .map(mapKargoRow)
      .sort(compareDateDescending)
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function sumField<T extends Record<string, any>>(items: T[] | null | undefined, key: keyof T) {
    return (items || []).reduce((sum, item) => sum + (Number(item[key]) || 0), 0)
  }

  function parseAyYil(value: string | null | undefined) {
    const text = String(value || "").trim()
    const parts = text.split(/[-\s/]+/).filter(Boolean)
    const monthPart = parts[0] || ""
    const yearPart = parts.find(part => /^\d{4}$/.test(part)) || ""
    const monthIndex = MONTHS.findIndex(item => item.toLocaleLowerCase("tr-TR") === monthPart.toLocaleLowerCase("tr-TR"))
    const parsedYear = Number(yearPart)

    if (monthIndex < 0 || !Number.isFinite(parsedYear)) return null
    return { monthIndex, year: parsedYear }
  }

  function isAyYilBefore(value: string | null | undefined) {
    const parsed = parseAyYil(value)
    if (!parsed || selectedMonthIndex < 0) return false
    return parsed.year < year || (parsed.year === year && parsed.monthIndex < selectedMonthIndex)
  }

  function isCurrentAyYil(value: string | null | undefined) {
    const parsed = parseAyYil(value)
    if (!parsed || selectedMonthIndex < 0) return false
    return parsed.year === year && parsed.monthIndex === selectedMonthIndex
  }

  function buildPaymentTotals(
    aggregateRows: Array<{ ay_yil: string | null; odenen: number | string | null }> | null,
    movementRows: Array<{ ay_yil: string | null; odenen: number | string | null }> | null,
  ) {
    const movementTotals = new Map<string, number>()
    for (const row of movementRows || []) {
      const key = String(row.ay_yil || "").trim()
      if (!key) continue
      movementTotals.set(key, (movementTotals.get(key) || 0) + (Number(row.odenen) || 0))
    }

    const totals = new Map<string, number>()
    for (const row of aggregateRows || []) {
      const key = String(row.ay_yil || "").trim()
      if (!key) continue
      totals.set(key, Number(row.odenen) || 0)
    }

    for (const [key, value] of movementTotals) {
      if (!totals.has(key)) totals.set(key, value)
    }

    return totals
  }

  async function getFirmDebtSnapshot() {
    if (!firma || !currentSube) return null

    const [
      { data: kayitlar, error: kayitError },
      { data: odemeler, error: odemeError },
      { data: hareketler, error: hareketError },
    ] = await Promise.all([
      supabase
        .from("kargo_cari_kayitlar")
        .select("tarih, fis_no, gonderilen_yer, alinan_tutar, ay_yil")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id),
      supabase
        .from("kargo_cari_odemeler")
        .select("odenen, ay_yil")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id),
      supabase
        .from("kargo_cari_odeme_hareketleri")
        .select("id, tarih, ay_yil, toplam_borc, odenen, kalan_borc, notlar, created_at")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)
        .order("tarih", { ascending: false })
        .order("created_at", { ascending: false }),
    ])

    if (kayitError) throw kayitError
    if (odemeError) throw odemeError
    if (hareketError) throw hareketError

    const currentKayitlar = (kayitlar || []).filter(item => isCurrentAyYil(item.ay_yil))
    const priorKayitlar = (kayitlar || []).filter(item => isAyYilBefore(item.ay_yil))
    const paymentTotals = buildPaymentTotals(odemeler, hareketler)
    const ayBorcu = sumField(currentKayitlar, "alinan_tutar")
    const priorDebt = sumField(priorKayitlar, "alinan_tutar")
    const priorPaid = Array.from(paymentTotals.entries())
      .filter(([period]) => isAyYilBefore(period))
      .reduce((sum, [, paid]) => sum + paid, 0)
    const odenen = Array.from(paymentTotals.entries())
      .filter(([period]) => isCurrentAyYil(period))
      .reduce((sum, [, paid]) => sum + paid, 0)
    const oncekiBorc = priorDebt - priorPaid
    const toplamBorc = oncekiBorc + ayBorcu

    return {
      oncekiBorc,
      ayBorcu,
      toplamBorc,
      odenen,
      kalanBorc: toplamBorc - odenen,
      currentKayitlar,
      hareketler: ((hareketler || []) as any[]).filter(item => isCurrentAyYil(item.ay_yil)).map(item => ({
        id: item.id,
        tarih: item.tarih,
        ay_yil: item.ay_yil,
        toplam_borc: Number(item.toplam_borc) || 0,
        odenen: Number(item.odenen) || 0,
        kalan_borc: Number(item.kalan_borc) || 0,
        notlar: item.notlar || "",
        created_at: item.created_at,
      })) as OdemeHareketi[],
    }
  }

  function exportPdf() {
    if (!firma) return
    const detailHeaders = customerPdf
      ? ["Tarih", "Fiş No", "Gönderilen Yer", "Alınan Tutar"]
      : ["Tarih", "Fiş No", "Gönderilen Yer", "Alınan Tutar", "Satılan Tutar", "Kalan Kar"]
    const detailRows = rows.map(row => {
      const base = [
        formatDate(row.tarih),
        row.fis_no || "-",
        row.gonderilen_yer || "-",
        `${formatNumber(row.alinan_tutar)} TL`,
      ]

      if (customerPdf) return base

      return [
        ...base,
        `${formatNumber(row.satilan_tutar)} TL`,
        `${formatNumber(row.kalan_kar)} TL`,
      ]
    })
    const totalRow = customerPdf
      ? ["TOPLAM", "", "", `${formatNumber(columnTotals.alinan_tutar)} TL`]
      : [
          "TOPLAM",
          "",
          "",
          `${formatNumber(columnTotals.alinan_tutar)} TL`,
          `${formatNumber(columnTotals.satilan_tutar)} TL`,
          `${formatNumber(columnTotals.kalan_kar)} TL`,
        ]
    const kdvPdfRows = showKdvRow
      ? (customerPdf
          ? [
              ["KDV", "%20", "KDV TUTARI", `${formatNumber(kdvAmount)} TL`],
              ["TOPLAM (KDV DAHİL)", "", "", `${formatNumber(kdvIncludedTotal)} TL`],
            ]
          : [
              ["KDV", "%20", "KDV TUTARI", `${formatNumber(kdvAmount)} TL`, "-", "-"],
              ["TOPLAM (KDV DAHİL)", "", "", `${formatNumber(kdvIncludedTotal)} TL`, "-", "-"],
            ])
      : []

    openPdfReport({
      title: `${firma.ad} Kargo Cari Raporu`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: customerPdf
        ? [{ label: "Toplam Alınan", value: `${formatNumber(columnTotals.alinan_tutar)} TL` }]
        : [
            { label: "Toplam Alınan", value: `${formatNumber(columnTotals.alinan_tutar)} TL` },
            { label: "Toplam Satılan", value: `${formatNumber(columnTotals.satilan_tutar)} TL` },
            { label: "Kalan Kar", value: `${formatNumber(columnTotals.kalan_kar)} TL` },
          ],
      tables: [{
        title: "Firma Notları",
        headers: ["Tarih", "Not"],
        firstColumnWidth: "82px",
        rows: notlar.length
          ? notlar.map(note => [formatDate(note.tarih), note.not_metni || "-"])
          : [["-", "Kayıtlı not yok"]],
      }, {
        title: "Aylık Firma Detayı",
        headers: detailHeaders,
        firstColumnWidth: "82px",
        rows: [...detailRows, totalRow, ...kdvPdfRows],
      }],
    })
  }

  async function exportBorcPdf() {
    if (!firma) return

    try {
      const snapshot = await getFirmDebtSnapshot()
      if (!snapshot) return

      const effectiveWithKdv = withKdv || Boolean(firma.kdv_dahil)
      const previousPeriod = getPreviousMonthSelection()
      const previousRows = includePreviousMonthDebtDetails
        ? await loadRowsForPeriod(previousPeriod.month, previousPeriod.year)
        : []
      const kdvTutar = effectiveWithKdv ? Math.max(0, snapshot.toplamBorc) * KDV_RATE : 0
      const kdvDahilToplam = snapshot.toplamBorc + kdvTutar
      const kdvDahilKalan = kdvDahilToplam - snapshot.odenen

      const hareketRows = snapshot.hareketler.map(hareket => [
        formatDate(hareket.tarih),
        `${formatNumber(hareket.toplam_borc)} TL`,
        `${formatNumber(hareket.odenen)} TL`,
        `${formatNumber(hareket.kalan_borc)} TL`,
        hareket.notlar || "-",
      ])
      const fisRows = snapshot.currentKayitlar.map((row: any) => [
        formatDate(row.tarih),
        row.fis_no || "-",
        row.gonderilen_yer || "-",
        `${formatNumber(Number(row.alinan_tutar) || 0)} TL`,
      ])
      const previousFisRows = previousRows.map(row => [
        formatDate(row.tarih),
        row.fis_no || "-",
        row.gonderilen_yer || "-",
        `${formatNumber(row.alinan_tutar)} TL`,
      ])
      const previousAyBorcu = sumField(previousRows, "alinan_tutar")
      const buildDebtDetailRows = (detailRows: Array<Array<string | number>>, total: number) => {
        const rows: Array<Array<string | number>> = [
          ...(detailRows.length ? detailRows : [["-", "-", "-", "Kayıt yok"]]),
          ["TOPLAM", "", "", `${formatNumber(total)} TL`],
        ]

        if (effectiveWithKdv && total > 0) {
          const detailKdv = total * KDV_RATE
          rows.push(
            ["KDV", "%20", "KDV TUTARI", `${formatNumber(detailKdv)} TL`],
            ["TOPLAM (KDV DAHİL)", "", "", `${formatNumber(total + detailKdv)} TL`],
          )
        }

        return rows
      }
      const detailTables = [
        {
          title: `${month} ${year} Borç Oluşturan Fişler`,
          headers: ["Tarih", "Fiş No", "Gönderilen Yer", "Alınan Tutar"],
          firstColumnWidth: "82px",
          rows: buildDebtDetailRows(fisRows, snapshot.ayBorcu),
        },
        ...(includePreviousMonthDebtDetails ? [{
          title: `${previousPeriod.month} ${previousPeriod.year} Borç Oluşturan Fişler`,
          headers: ["Tarih", "Fiş No", "Gönderilen Yer", "Alınan Tutar"],
          firstColumnWidth: "82px",
          rows: buildDebtDetailRows(previousFisRows, previousAyBorcu),
        }] : []),
      ]

      openPdfReport({
        title: `${firma.ad} Borç Hareketleri`,
        subtitle: `${currentSube?.ad || ""} - ${month} ${year}${effectiveWithKdv ? " (%20 KDV Dahil)" : ""}${includePreviousMonthDebtDetails ? ` - ${previousPeriod.month} ${previousPeriod.year} detayı dahil` : ""}`,
        orientation: "landscape",
        metrics: [
          { label: "Önceki Borç", value: `${formatNumber(snapshot.oncekiBorc)} TL` },
          { label: "Ay Borcu", value: `${formatNumber(snapshot.ayBorcu)} TL` },
          ...(effectiveWithKdv ? [{ label: "KDV", value: `${formatNumber(kdvTutar)} TL` }] : []),
          { label: "Toplam Borç" + (effectiveWithKdv ? " (KDV Dahil)" : ""), value: `${formatNumber(effectiveWithKdv ? kdvDahilToplam : snapshot.toplamBorc)} TL` },
          { label: "Ödenen", value: `${formatNumber(snapshot.odenen)} TL` },
          { label: "Kalan Borç" + (effectiveWithKdv ? " (KDV Dahil)" : ""), value: `${formatNumber(effectiveWithKdv ? kdvDahilKalan : snapshot.kalanBorc)} TL` },
        ],
        tables: [
          {
            title: "Borç Durumu",
            headers: effectiveWithKdv
              ? ["Önceki Borç", "Ay Borcu", "KDV (%20)", "Toplam Borç (KDV Dahil)", "Ödenen", "Kalan Borç (KDV Dahil)"]
              : ["Önceki Borç", "Ay Borcu", "Toplam Borç", "Ödenen", "Kalan Borç"],
            rows: effectiveWithKdv
              ? [[
                  `${formatNumber(snapshot.oncekiBorc)} TL`,
                  `${formatNumber(snapshot.ayBorcu)} TL`,
                  `${formatNumber(kdvTutar)} TL`,
                  `${formatNumber(kdvDahilToplam)} TL`,
                  `${formatNumber(snapshot.odenen)} TL`,
                  `${formatNumber(kdvDahilKalan)} TL`,
                ]]
              : [[
                  `${formatNumber(snapshot.oncekiBorc)} TL`,
                  `${formatNumber(snapshot.ayBorcu)} TL`,
                  `${formatNumber(snapshot.toplamBorc)} TL`,
                  `${formatNumber(snapshot.odenen)} TL`,
                  `${formatNumber(snapshot.kalanBorc)} TL`,
                ]],
          },
          {
            title: "Ödeme Hareketleri",
            headers: ["Tarih", "Güncel Borç", "Ödenen", "Kalan Borç", "Not"],
            firstColumnWidth: "82px",
            rows: hareketRows.length ? hareketRows : [["-", "-", "-", "-", "Ödeme hareketi yok"]],
          },
          ...detailTables,
        ],
      })
    } catch (error: any) {
      toast.error(error?.message || "Borç PDF hazırlanamadı.")
    }
  }

  // Sütun toplamları
  const columnTotals = {
    alinan_tutar: rows.reduce((sum, row) => sum + row.alinan_tutar, 0),
    satilan_tutar: rows.reduce((sum, row) => sum + row.satilan_tutar, 0),
    kalan_kar: rows.reduce((sum, row) => sum + row.kalan_kar, 0),
  }
  const showKdvRow = (Boolean(firma?.kdv_dahil) || withKdv) && rows.length > 0
  const kdvAmount = showKdvRow ? Math.max(0, columnTotals.alinan_tutar) * KDV_RATE : 0
  const kdvIncludedTotal = columnTotals.alinan_tutar + kdvAmount
  const activeKargoDate = getEveningCutoffBusinessDate(userVardiya, currentTime)

  if (loading && !firma) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  if (!firma) {
    return <div className="flex items-center justify-center h-64">Firma bulunamadı</div>
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{firma.ad}</h1>
          <p className="text-muted-foreground mt-1">Kargo Cari Takip</p>
        </div>

        {/* Ay/Yil Secimi */}
        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-full min-w-0 sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actions */}
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
        <Button onClick={exportBorcPdf} size="sm" variant="outline">
          <FileText className="w-4 h-4 mr-1" /> Borç PDF
        </Button>
        <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground">
          <Checkbox
            checked={customerPdf}
            onCheckedChange={(checked) => setCustomerPdf(checked === true)}
          />
          <span>Müşteri İçin</span>
        </label>
        <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground cursor-pointer">
          <Checkbox
            checked={withKdv || Boolean(firma.kdv_dahil)}
            onCheckedChange={(checked) => setWithKdv(checked === true)}
            disabled={Boolean(firma.kdv_dahil)}
          />
          <span>{firma.kdv_dahil ? "%20 KDV Otomatik Aktif" : "%20 KDV Ekle"}</span>
        </label>
        <label className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium text-foreground cursor-pointer">
          <Checkbox
            checked={includePreviousMonthDebtDetails}
            onCheckedChange={(checked) => setIncludePreviousMonthDebtDetails(checked === true)}
          />
          <span>Borç PDF: Önceki Ay Detayı</span>
        </label>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            <div>
              <h2 className="font-semibold text-foreground">Firma Notları</h2>
              <p className="text-sm text-muted-foreground">Bu firmaya ait tarihli notlar.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addNote}>
              <Plus className="mr-1 h-4 w-4" /> Not Ekle
            </Button>
            <Button type="button" size="sm" onClick={saveNotes} disabled={savingNotes}>
              <Save className="mr-1 h-4 w-4" /> {savingNotes ? "Kaydediliyor..." : "Notları Kaydet"}
            </Button>
          </div>
        </div>
        <div className="space-y-3 p-4">
          {notlar.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
              Bu firma için not yok. Not Ekle butonuyla yeni not oluşturabilirsiniz.
            </div>
          ) : (
            notlar.map((note, index) => (
              <div key={note.id || `new-${index}`} className="grid gap-2 rounded-md border bg-muted/20 p-3 md:grid-cols-[160px_1fr_auto]">
                <ModernDatePicker
                  label="Not tarihi"
                  value={note.tarih}
                  onChange={(value) => updateNote(index, { tarih: value })}
                  buttonClassName="h-10 rounded-md"
                />
                <Textarea
                  value={note.not_metni}
                  onChange={(event) => updateNote(index, { not_metni: event.target.value })}
                  rows={2}
                  placeholder="Not yaz..."
                />
                <Button type="button" variant="outline" size="icon" onClick={() => deleteNote(index)} className="text-red-500">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Table */}
      <div className="sticky-table-scroll rounded-lg border bg-card">
        <table className="sticky-table w-full min-w-[760px] text-sm">
          <thead>
            <tr>
              <th className="sticky-index-column border bg-muted p-2 text-muted-foreground">#</th>
              {COLUMNS.map(col => (
                <th 
                  key={col} 
                  className={`border p-2 font-semibold whitespace-nowrap ${col === "tarih" ? "sticky-date-column" : ""} ${HEADER_COLORS[col]}`}
                >
                  {HEADER_LABELS[col]}
                </th>
              ))}
              <th className="w-10 border bg-muted p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="p-8 text-center text-muted-foreground">
                  Yükleniyor...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="p-8 text-center text-muted-foreground">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                // Kalan kar pozitifse (alinan > satilan) yeşil arka plan
                const isProfit = row.kalan_kar > 0
                const canEditRow = isAdmin || row.tarih === activeKargoDate
                return (
                <tr key={rowIndex} className={`${!canEditRow ? "opacity-70" : ""} ${isProfit ? "bg-green-50 dark:bg-green-500/10" : "hover:bg-muted/50"}`}>
                  <td className="sticky-index-column border bg-card p-1 text-center text-muted-foreground">{rowIndex + 1}</td>
                  {COLUMNS.map(col => (
                    <td key={col} className={`border p-0 ${col === "tarih" ? "sticky-date-column bg-card" : ""}`}>
                      {col === "tarih" ? (
                        isAdmin ? (
                          <input
                            type="text"
                            value={formatEditableDate(row.tarih)}
                            onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                            onBlur={(e) => commitDateCell(rowIndex, e.target.value)}
                            onKeyDown={handleSpreadsheetKeyDown}
                            className="spreadsheet-active-input w-full bg-muted px-2 py-1 text-center font-medium text-foreground focus:outline-none"
                            placeholder="12.06"
                            aria-label="Tarih"
                          />
                        ) : (
                          <div className="bg-muted px-2 py-1 text-center font-medium text-foreground">
                            {formatDate(row.tarih)}
                          </div>
                        )
                      ) : col === "kalan_kar" ? (
                        <div className={`px-2 py-1 text-right font-semibold ${
                          row.kalan_kar >= 0 ? "bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200" : "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200"
                        }`}>
                          {formatNumber(row.kalan_kar)} ₺
                        </div>
                      ) : col === "fis_no" ? (
                        <input
                        type="text"
                        value={row.fis_no || ""}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        onKeyDown={handleSpreadsheetKeyDown}
                        onBlur={(e) => {
                          if (!canEditRow) return
                          const val = e.target.value
                          if (!val) return
                          const padded = val.padStart(6, "0")
                          updateCell(rowIndex, col, padded)
                        }}
                        className={`spreadsheet-active-input w-full bg-transparent px-2 py-1 text-center font-mono text-foreground focus:outline-none ${
                          !row.fis_no?.trim() ? "bg-red-50 text-red-700 placeholder:text-red-300 dark:bg-red-500/10 dark:text-red-200" : ""
                        }`}
                        disabled={!canEditRow}
                        placeholder="000000"
                        maxLength={6}
                        required
                        aria-invalid={!row.fis_no?.trim()}
                        aria-label="Fiş no"
                        />
                      ) : col === "gonderilen_yer" ? (
                        <input
                          type="text"
                          value={row.gonderilen_yer || ""}
                          onKeyDown={handleSpreadsheetKeyDown}
                          onChange={(e) => {
                            const onlyLetters = e.target.value
                              .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, "") // sadece harf + boşluk
                              .toLocaleUpperCase("tr-TR")
                            updateCell(rowIndex, col, onlyLetters)
                          }}
                          disabled={!canEditRow}
                          className="spreadsheet-active-input w-full bg-transparent px-2 py-1 text-center text-foreground focus:outline-none"
                          placeholder="Gönderilen yer"
                        />
                      ) : (
                        <CurrencyInput
                          value={(row as any)[col] || ""}
                          onChange={(e) => updateCell(rowIndex, col, parseCurrencyInputValue(e.target.value))}
                          onKeyDown={handleSpreadsheetKeyDown}
                          disabled={!canEditRow}
                          containerClassName="min-h-[30px] px-2 py-1"
                          inputClassName="!text-center"
                          placeholder="0,00"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 border">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      disabled={!canEditRow}
                      className="rounded p-1 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted font-semibold text-foreground">
                <td className="sticky-index-column border bg-muted p-2"></td>
                <td className="sticky-date-column border bg-muted p-2 text-center">TOPLAM</td>
                <td className="p-2 border"></td>
                <td className="p-2 border"></td>
                <td className="border p-2 text-center tabular-nums">{formatNumber(columnTotals.alinan_tutar)} ₺</td>
                <td className="border p-2 text-center tabular-nums">{formatNumber(columnTotals.satilan_tutar)} ₺</td>
                <td className={`border p-2 text-center font-bold tabular-nums ${columnTotals.kalan_kar >= 0 ? "text-green-700 dark:text-green-200" : "text-red-700 dark:text-red-200"}`}>
                  {formatNumber(columnTotals.kalan_kar)} ₺
                </td>
                <td className="p-2 border"></td>
              </tr>
              {showKdvRow ? (
                <>
                  <tr className="border-t-2 border-amber-300 bg-amber-50 font-semibold text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-100">
                    <td className="sticky-index-column border bg-amber-100 p-2 text-center text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                      KDV
                    </td>
                    <td className="sticky-date-column border bg-amber-100 p-2 text-center text-xs font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-100">
                      SABİT
                    </td>
                    <td className="border p-2 text-center font-bold">%20</td>
                    <td className="border p-2 text-center font-bold">KDV TUTARI</td>
                    <td className="border p-2 text-center font-black tabular-nums">{formatNumber(kdvAmount)} ₺</td>
                    <td className="border p-2 text-center text-muted-foreground">-</td>
                    <td className="border p-2 text-center text-muted-foreground">-</td>
                    <td className="border p-2 text-center text-xs font-bold text-amber-700 dark:text-amber-100">Kilitli</td>
                  </tr>
                  <tr className="bg-orange-50 font-black text-orange-900 dark:bg-orange-500/15 dark:text-orange-100">
                    <td className="sticky-index-column border bg-orange-100 p-2 text-center text-xs font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-100">
                      TOPLAM
                    </td>
                    <td className="sticky-date-column border bg-orange-100 p-2 text-center text-xs font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-100">
                      KDV DAHİL
                    </td>
                    <td className="border p-2"></td>
                    <td className="border p-2 text-center font-bold">TOPLAM (KDV DAHİL)</td>
                    <td className="border p-2 text-center text-sm font-black tabular-nums">{formatNumber(kdvIncludedTotal)} ₺</td>
                    <td className="border p-2 text-center text-muted-foreground">-</td>
                    <td className="border p-2 text-center text-muted-foreground">-</td>
                    <td className="border p-2 text-center text-xs font-bold text-orange-700 dark:text-orange-100">Kilitli</td>
                  </tr>
                </>
              ) : null}
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
