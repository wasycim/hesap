"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, Info, Landmark, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getFirstMissingDateWithinMonth,
  getInitialMonth,
  getInitialYear,
  isDateInSelectedMonth,
  makeYearWindow,
} from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"
import { createClient } from "@/lib/supabase/client"
import { TableColumnSetting, getColumnTextColor, mergeColumnSettings } from "@/lib/table-column-settings"

type Section = "gelir" | "on_dort" | "banka"
type Values = Record<string, number>
type AutoIncomeKey = "pamukkale_turizm" | "anadolu_turizm" | "inegol_seyahat"
type AutoExpenseKey = "kredi_karti_14_no"
type AutoTransferKey = "on_dort_no_giden"
type AutoDeliveryKey = "teslim"

interface ShiftBreakdown {
  sabah: number
  aksam: number
  toplam: number
  sabahKayitVar: boolean
  aksamKayitVar: boolean
  sabahKontrolEdildi: boolean
  aksamKontrolEdildi: boolean
  kontrolEdildi: boolean
  karsiSabah?: number
  karsiAksam?: number
  sabahEslesti?: boolean
  aksamEslesti?: boolean
  kaynakSabahKontrolEdildi?: boolean
  kaynakAksamKontrolEdildi?: boolean
  karsiSabahKontrolEdildi?: boolean
  karsiAksamKontrolEdildi?: boolean
}

interface Row {
  id?: string
  tarih: string
  tutarlar: Values
}

interface OnDortNoHesapTableProps {
  section: Section
}

const SECTION_META: Record<Section, { title: string; description: string; keys: string[] }> = {
  gelir: {
    title: "Gelir Kalemleri",
    description: "Pamukkale, Anadolu, İnegöl ve diğer kasa girişleri.",
    keys: ["pamukkale_turizm", "anadolu_turizm", "inegol_seyahat", "on_dort_no_giden", "diger_kasa", "gelir_toplam"],
  },
  on_dort: {
    title: "14 No Kalemleri",
    description: "14 No kredi kartı, teslim ve diğer çıkışlar.",
    keys: ["kredi_karti_14_no", "teslim", "diger", "gider_toplam"],
  },
  banka: {
    title: "Banka ve Kalan",
    description: "Bankaya gönderilen, kontür yükleme ve gün sonu kalan tutarı.",
    keys: ["bankaya_gonderilen", "kontur_yukleme", "kalan"],
  },
}

const FORMULA_KEYS = new Set(["gelir_toplam", "gider_toplam", "kalan"])
const AUTO_INCOME_KEYS = new Set<AutoIncomeKey>(["pamukkale_turizm", "anadolu_turizm", "inegol_seyahat"])
const AUTO_EXPENSE_KEYS = new Set<AutoExpenseKey>(["kredi_karti_14_no"])
const AUTO_TRANSFER_KEYS = new Set<AutoTransferKey>(["on_dort_no_giden"])
const AUTO_DELIVERY_KEYS = new Set<AutoDeliveryKey>(["teslim"])
const GELIR_SOURCE_COLUMNS: Record<AutoIncomeKey, string> = {
  pamukkale_turizm: "pamukkale_turizm",
  anadolu_turizm: "anadolu_ulasim",
  inegol_seyahat: "inegol_seyahat",
}
const GIDER_SOURCE_COLUMNS: Record<AutoExpenseKey, string> = {
  kredi_karti_14_no: "pk_kredi_karti",
}
const TRANSFER_SOURCE_COLUMNS: Record<AutoTransferKey, string> = {
  on_dort_no_giden: "on_dort_noya_giden",
}
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function normalizeBranchText(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\s+/g, "")
}

function isControlledStatus(value: string | null | undefined) {
  const normalized = normalizeBranchText(value || "")
  return normalized === "kontroledildi"
}

function findColumnKeyByLabel(settings: TableColumnSetting[] | null | undefined, requiredParts: string[]) {
  const normalizedParts = requiredParts.map(normalizeBranchText)
  return (settings || []).find(column => {
    const label = normalizeBranchText(column.label || column.column_key)
    return column.aktif && normalizedParts.every(part => label.includes(part))
  })?.column_key || null
}

function getControlWarningItems(
  detail: ShiftBreakdown | null | undefined,
  kaynakSubeAdi: string,
  karsiSubeAdi?: string,
) {
  if (!detail) return []

  if (karsiSubeAdi) {
    return [
      !detail.kaynakSabahKontrolEdildi ? `${kaynakSubeAdi} sabah vardiyası kontrol edilmedi` : null,
      !detail.kaynakAksamKontrolEdildi ? `${kaynakSubeAdi} akşam vardiyası kontrol edilmedi` : null,
      !detail.karsiSabahKontrolEdildi ? `${karsiSubeAdi} sabah vardiyası kontrol edilmedi` : null,
      !detail.karsiAksamKontrolEdildi ? `${karsiSubeAdi} akşam vardiyası kontrol edilmedi` : null,
    ].filter(Boolean) as string[]
  }

  return [
    !detail.sabahKontrolEdildi ? `${kaynakSubeAdi} sabah vardiyası kontrol edilmedi` : null,
    !detail.aksamKontrolEdildi ? `${kaynakSubeAdi} akşam vardiyası kontrol edilmedi` : null,
  ].filter(Boolean) as string[]
}

function getNumericValue(row: any, columnKey: string | null) {
  if (!columnKey) return 0
  if (columnKey.startsWith("custom_") || columnKey.startsWith("firma_")) {
    return Number(row.custom_values?.[columnKey]) || 0
  }
  return Number(row[columnKey]) || 0
}

function createShiftBreakdown(): ShiftBreakdown {
  return {
    sabah: 0,
    aksam: 0,
    toplam: 0,
    sabahKayitVar: false,
    aksamKayitVar: false,
    sabahKontrolEdildi: false,
    aksamKontrolEdildi: false,
    kontrolEdildi: false,
  }
}

function calculate(values: Values): Values {
  const gelirToplam =
    (Number(values.pamukkale_turizm) || 0) +
    (Number(values.anadolu_turizm) || 0) +
    (Number(values.inegol_seyahat) || 0) +
    (Number(values.on_dort_no_giden) || 0) +
    (Number(values.diger_kasa) || 0)
  const giderToplam =
    (Number(values.kredi_karti_14_no) || 0) +
    (Number(values.teslim) || 0) +
    (Number(values.diger) || 0)
  const bankaToplam =
    (Number(values.bankaya_gonderilen) || 0) +
    (Number(values.kontur_yukleme) || 0)

  return {
    ...values,
    gelir_toplam: gelirToplam,
    gider_toplam: giderToplam,
    kalan: gelirToplam - giderToplam - bankaToplam,
  }
}

export function OnDortNoHesapTable({ section }: OnDortNoHesapTableProps) {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [rows, setRows] = useState<Row[]>([])
  const [incomeDetails, setIncomeDetails] = useState<Record<string, Record<AutoIncomeKey, ShiftBreakdown>>>({})
  const [expenseDetails, setExpenseDetails] = useState<Record<string, Record<AutoExpenseKey, ShiftBreakdown>>>({})
  const [transferDetails, setTransferDetails] = useState<Record<string, Record<AutoTransferKey, ShiftBreakdown>>>({})
  const [deliveryDetails, setDeliveryDetails] = useState<Record<string, Record<AutoDeliveryKey, ShiftBreakdown>>>({})
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("on_dort_no_hesap", []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { subeler, currentSube, currentUserId, isAdmin, loading: subeLoading } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)
  const ayYil = `${month}-${year}`
  const meta = SECTION_META[section]
  const sourceSube = useMemo(() => {
    return subeler.find(sube => {
      const ad = normalizeBranchText(sube.ad || "")
      const kod = normalizeBranchText(sube.kod || "")
      return kod === "14" || ad === "14" || ad.includes("14no") || ad.includes("14numara")
    }) || null
  }, [subeler])
  const transferSourceSube = useMemo(() => {
    return subeler.find(sube => {
      const ad = normalizeBranchText(sube.ad || "")
      const kod = normalizeBranchText(sube.kod || "")
      return kod === "5a" || ad === "5a" || ad.includes("5a")
    }) || null
  }, [subeler])

  const columnMeta = useMemo(() => new Map(columnSettings.map(column => [column.column_key, column])), [columnSettings])
  const visibleKeys = useMemo(() => {
    const sectionKeys = new Set(meta.keys)
    const allSectionKeys = new Set(Object.values(SECTION_META).flatMap(item => item.keys))
    const gelirEnd = columnMeta.get("gelir_toplam")?.sort_order ?? 5
    const giderEnd = columnMeta.get("gider_toplam")?.sort_order ?? 9

    function isInCurrentSection(order: number) {
      if (section === "gelir") return order <= gelirEnd
      if (section === "on_dort") return order > gelirEnd && order <= giderEnd
      return order > giderEnd
    }

    return columnSettings
      .filter(column => column.aktif)
      .filter(column => {
        if (sectionKeys.has(column.column_key)) return true
        if (allSectionKeys.has(column.column_key)) return false
        return isInCurrentSection(column.sort_order)
      })
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(column => column.column_key)
  }, [columnSettings, columnMeta, meta.keys, section])

  useEffect(() => {
    if (isAdmin && currentSube) loadData()
    if (!subeLoading && !currentSube) setLoading(false)
  }, [isAdmin, currentSube?.id, sourceSube?.id, transferSourceSube?.id, ayYil])

  useEffect(() => {
    registerSaveHandler(saveData)
    return () => registerSaveHandler(null)
  }, [rows, incomeDetails, expenseDetails, transferDetails, deliveryDetails, currentSube?.id, ayYil, registerSaveHandler])

  async function loadData() {
    if (!currentSube) return
    setLoading(true)
    const incomeSourceSubeId = sourceSube?.id || currentSube.id
    const transferSourceSubeId = transferSourceSube?.id || currentSube.id

    const [
      { data: settingsData },
      { data: recordData, error: recordError },
      { data: incomeData },
      { data: expenseData },
      { data: transferIncomeData },
      { data: transferExpenseData },
      { data: transferSourceSettings },
      { data: transferCounterSettings },
      { data: transferSourceData },
      { data: sourceGiderSettings },
      { data: transferGelirSettings },
      { data: deliverySourceData },
      { data: deliveryCounterData },
    ] = await Promise.all([
      supabase
        .from("kolon_ayarlari")
        .select("*")
        .eq("sube_id", currentSube.id)
        .eq("table_type", "on_dort_no_hesap")
        .order("sort_order", { ascending: true }),
      supabase
        .from("on_dort_no_hesap_kayitlari")
        .select("id, tarih, tutarlar")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true }),
      supabase
        .from("gelir_kayitlari")
        .select("tarih, vardiya, durum, pamukkale_turizm, anadolu_ulasim, inegol_seyahat")
        .eq("sube_id", incomeSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("gider_kayitlari")
        .select("*")
        .eq("sube_id", incomeSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("gelir_kayitlari")
        .select("tarih, vardiya, durum")
        .eq("sube_id", transferSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("gider_kayitlari")
        .select("tarih, vardiya, on_dort_noya_giden")
        .eq("sube_id", transferSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("kolon_ayarlari")
        .select("*")
        .eq("sube_id", incomeSourceSubeId)
        .eq("table_type", "gelir")
        .order("sort_order", { ascending: true }),
      supabase
        .from("kolon_ayarlari")
        .select("*")
        .eq("sube_id", transferSourceSubeId)
        .eq("table_type", "gider")
        .order("sort_order", { ascending: true }),
      supabase
        .from("gelir_kayitlari")
        .select("*")
        .eq("sube_id", incomeSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("kolon_ayarlari")
        .select("*")
        .eq("sube_id", incomeSourceSubeId)
        .eq("table_type", "gider")
        .order("sort_order", { ascending: true }),
      supabase
        .from("kolon_ayarlari")
        .select("*")
        .eq("sube_id", transferSourceSubeId)
        .eq("table_type", "gelir")
        .order("sort_order", { ascending: true }),
      supabase
        .from("gider_kayitlari")
        .select("*")
        .eq("sube_id", incomeSourceSubeId)
        .eq("ay_yil", ayYil),
      supabase
        .from("gelir_kayitlari")
        .select("*")
        .eq("sube_id", transferSourceSubeId)
        .eq("ay_yil", ayYil),
    ])

    if (recordError) {
      toast.error("14 No Hesap kayıtları okunamadı. 009 SQL dosyasını çalıştırın.")
    }

    const nextIncomeDetails = buildIncomeDetails(incomeData || [])
    const nextDateControlDetails = buildDateControlDetails(incomeData || [])
    const nextExpenseDetails = buildExpenseDetails(expenseData || [], nextDateControlDetails)
    const nextTransferControlDetails = buildDateControlDetails(transferIncomeData || [])
    const transferSourceKey = findColumnKeyByLabel(transferSourceSettings as TableColumnSetting[] | null, ["5", "a", "gelen"])
    const transferCounterKey = findColumnKeyByLabel(transferCounterSettings as TableColumnSetting[] | null, ["14", "no", "giden"])
    const nextTransferDetails = buildTransferDetails(
      transferSourceData || [],
      transferExpenseData || [],
      nextDateControlDetails,
      nextTransferControlDetails,
      transferSourceKey,
      transferCounterKey,
    )
    const deliverySourceKey = findColumnKeyByLabel(sourceGiderSettings as TableColumnSetting[] | null, ["5", "a", "giden"])
    const deliveryCounterKey = findColumnKeyByLabel(transferGelirSettings as TableColumnSetting[] | null, ["14", "no", "gelen"])
    const nextDeliveryDetails = buildDeliveryDetails(
      deliverySourceData || [],
      deliveryCounterData || [],
      nextDateControlDetails,
      nextTransferControlDetails,
      deliverySourceKey,
      deliveryCounterKey,
    )
    setIncomeDetails(nextIncomeDetails)
    setExpenseDetails(nextExpenseDetails)
    setTransferDetails(nextTransferDetails)
    setDeliveryDetails(nextDeliveryDetails)
    setColumnSettings(mergeColumnSettings("on_dort_no_hesap", settingsData as TableColumnSetting[] | null))
    setRows((recordData || [])
      .filter(row => isDateInSelectedMonth(row.tarih, month, year))
      .map(row => ({ id: row.id, tarih: row.tarih, tutarlar: calculate(applyAutoValues(row.tarih, (row.tutarlar || {}) as Values, nextIncomeDetails, nextExpenseDetails, nextTransferDetails, nextDeliveryDetails)) })))
    markClean()
    setLoading(false)
  }

  function buildIncomeDetails(incomeRows: any[]) {
    const next: Record<string, Record<AutoIncomeKey, ShiftBreakdown>> = {}

    incomeRows.forEach(row => {
      const tarih = row.tarih
      if (!next[tarih]) {
        next[tarih] = {
          pamukkale_turizm: createShiftBreakdown(),
          anadolu_turizm: createShiftBreakdown(),
          inegol_seyahat: createShiftBreakdown(),
        }
      }

      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const bucket: "sabah" | "aksam" = vardiya === "A" ? "aksam" : "sabah"
      const controlled = isControlledStatus(row.durum)

      ;(Object.keys(GELIR_SOURCE_COLUMNS) as AutoIncomeKey[]).forEach(key => {
        const value = Number(row[GELIR_SOURCE_COLUMNS[key]]) || 0
        const detail = next[tarih][key]
        const recordFlag = bucket === "sabah" ? "sabahKayitVar" : "aksamKayitVar"
        const controlFlag = bucket === "sabah" ? "sabahKontrolEdildi" : "aksamKontrolEdildi"

        detail[bucket] += value
        detail.toplam += value
        detail[controlFlag] = detail[recordFlag] ? detail[controlFlag] && controlled : controlled
        detail[recordFlag] = true
      })
    })

    Object.values(next).forEach(dateDetails => {
      ;(Object.keys(dateDetails) as AutoIncomeKey[]).forEach(key => {
        const detail = dateDetails[key]
        detail.kontrolEdildi = detail.sabahKayitVar && detail.aksamKayitVar && detail.sabahKontrolEdildi && detail.aksamKontrolEdildi
      })
    })

    return next
  }

  function buildDateControlDetails(incomeRows: any[]) {
    const next: Record<string, ShiftBreakdown> = {}

    incomeRows.forEach(row => {
      const tarih = row.tarih
      if (!next[tarih]) next[tarih] = createShiftBreakdown()

      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const bucket: "sabah" | "aksam" = vardiya === "A" ? "aksam" : "sabah"
      const recordFlag = bucket === "sabah" ? "sabahKayitVar" : "aksamKayitVar"
      const controlFlag = bucket === "sabah" ? "sabahKontrolEdildi" : "aksamKontrolEdildi"
      const controlled = isControlledStatus(row.durum)
      const detail = next[tarih]

      detail[controlFlag] = detail[recordFlag] ? detail[controlFlag] && controlled : controlled
      detail[recordFlag] = true
    })

    Object.values(next).forEach(detail => {
      detail.kontrolEdildi = detail.sabahKayitVar && detail.aksamKayitVar && detail.sabahKontrolEdildi && detail.aksamKontrolEdildi
    })

    return next
  }

  function buildExpenseDetails(expenseRows: any[], dateControlDetails: Record<string, ShiftBreakdown>) {
    const next: Record<string, Record<AutoExpenseKey, ShiftBreakdown>> = {}

    Object.entries(dateControlDetails).forEach(([tarih, control]) => {
      next[tarih] = {
        kredi_karti_14_no: {
          ...createShiftBreakdown(),
          sabahKontrolEdildi: control.sabahKontrolEdildi,
          aksamKontrolEdildi: control.aksamKontrolEdildi,
          kontrolEdildi: control.kontrolEdildi,
        },
      }
    })

    expenseRows.forEach(row => {
      const tarih = row.tarih
      if (!next[tarih]) {
        next[tarih] = {
          kredi_karti_14_no: createShiftBreakdown(),
        }
      }

      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const bucket: "sabah" | "aksam" = vardiya === "A" ? "aksam" : "sabah"

      ;(Object.keys(GIDER_SOURCE_COLUMNS) as AutoExpenseKey[]).forEach(key => {
        const value = Number(row[GIDER_SOURCE_COLUMNS[key]]) || 0
        const detail = next[tarih][key]
        const recordFlag = bucket === "sabah" ? "sabahKayitVar" : "aksamKayitVar"
        const controlFlag = bucket === "sabah" ? "sabahKontrolEdildi" : "aksamKontrolEdildi"

        detail[bucket] += value
        detail.toplam += value
        detail[recordFlag] = true
        detail[controlFlag] = dateControlDetails[tarih]?.[controlFlag] || false
      })
    })

    Object.values(next).forEach(dateDetails => {
      ;(Object.keys(dateDetails) as AutoExpenseKey[]).forEach(key => {
        const detail = dateDetails[key]
        detail.kontrolEdildi = detail.sabahKontrolEdildi && detail.aksamKontrolEdildi
      })
    })

    return next
  }

  function buildTransferDetails(
    sourceRows: any[],
    counterRows: any[],
    sourceControlDetails: Record<string, ShiftBreakdown>,
    counterControlDetails: Record<string, ShiftBreakdown>,
    sourceColumnKey: string | null,
    counterColumnKey: string | null,
  ) {
    const next: Record<string, Record<AutoTransferKey, ShiftBreakdown>> = {}

    function ensure(tarih: string) {
      if (!next[tarih]) {
        next[tarih] = {
          on_dort_no_giden: createShiftBreakdown(),
        }
      }
      return next[tarih].on_dort_no_giden
    }

    Object.keys({ ...sourceControlDetails, ...counterControlDetails }).forEach(tarih => {
      const detail = ensure(tarih)
      detail.kaynakSabahKontrolEdildi = Boolean(sourceControlDetails[tarih]?.sabahKontrolEdildi)
      detail.kaynakAksamKontrolEdildi = Boolean(sourceControlDetails[tarih]?.aksamKontrolEdildi)
      detail.karsiSabahKontrolEdildi = Boolean(counterControlDetails[tarih]?.sabahKontrolEdildi)
      detail.karsiAksamKontrolEdildi = Boolean(counterControlDetails[tarih]?.aksamKontrolEdildi)
      detail.sabahKontrolEdildi = Boolean(detail.kaynakSabahKontrolEdildi && detail.karsiSabahKontrolEdildi)
      detail.aksamKontrolEdildi = Boolean(detail.kaynakAksamKontrolEdildi && detail.karsiAksamKontrolEdildi)
    })

    sourceRows.forEach(row => {
      const detail = ensure(row.tarih)
      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const bucket: "sabah" | "aksam" = vardiya === "A" ? "aksam" : "sabah"
      const value = getNumericValue(row, sourceColumnKey)

      detail[bucket] += value
      detail.toplam += value
      detail[bucket === "sabah" ? "sabahKayitVar" : "aksamKayitVar"] = true
    })

    counterRows.forEach(row => {
      const detail = ensure(row.tarih)
      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const value = getNumericValue(row, counterColumnKey)

      if (vardiya === "A") {
        detail.karsiAksam = (detail.karsiAksam || 0) + value
      } else {
        detail.karsiSabah = (detail.karsiSabah || 0) + value
      }
    })

    Object.values(next).forEach(dateDetails => {
      const detail = dateDetails.on_dort_no_giden
      detail.sabahEslesti = detail.sabah === (detail.karsiSabah || 0)
      detail.aksamEslesti = detail.aksam === (detail.karsiAksam || 0)
      detail.kontrolEdildi = Boolean(detail.sabahEslesti && detail.aksamEslesti)
    })

    return next
  }

  function buildDeliveryDetails(
    sourceRows: any[],
    counterRows: any[],
    sourceControlDetails: Record<string, ShiftBreakdown>,
    counterControlDetails: Record<string, ShiftBreakdown>,
    sourceColumnKey: string | null,
    counterColumnKey: string | null,
  ) {
    const next: Record<string, Record<AutoDeliveryKey, ShiftBreakdown>> = {}

    function ensure(tarih: string) {
      if (!next[tarih]) {
        next[tarih] = {
          teslim: createShiftBreakdown(),
        }
      }
      return next[tarih].teslim
    }

    Object.keys({ ...sourceControlDetails, ...counterControlDetails }).forEach(tarih => {
      const detail = ensure(tarih)
      detail.kaynakSabahKontrolEdildi = Boolean(sourceControlDetails[tarih]?.sabahKontrolEdildi)
      detail.kaynakAksamKontrolEdildi = Boolean(sourceControlDetails[tarih]?.aksamKontrolEdildi)
      detail.karsiSabahKontrolEdildi = Boolean(counterControlDetails[tarih]?.sabahKontrolEdildi)
      detail.karsiAksamKontrolEdildi = Boolean(counterControlDetails[tarih]?.aksamKontrolEdildi)
      detail.sabahKontrolEdildi = Boolean(detail.kaynakSabahKontrolEdildi && detail.karsiSabahKontrolEdildi)
      detail.aksamKontrolEdildi = Boolean(detail.kaynakAksamKontrolEdildi && detail.karsiAksamKontrolEdildi)
    })

    sourceRows.forEach(row => {
      const detail = ensure(row.tarih)
      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const bucket: "sabah" | "aksam" = vardiya === "A" ? "aksam" : "sabah"
      const value = getNumericValue(row, sourceColumnKey)

      detail[bucket] += value
      detail.toplam += value
      detail[bucket === "sabah" ? "sabahKayitVar" : "aksamKayitVar"] = true
    })

    counterRows.forEach(row => {
      const detail = ensure(row.tarih)
      const vardiya = String(row.vardiya || "S").toLocaleUpperCase("tr-TR")
      const value = getNumericValue(row, counterColumnKey)

      if (vardiya === "A") {
        detail.karsiAksam = (detail.karsiAksam || 0) + value
      } else {
        detail.karsiSabah = (detail.karsiSabah || 0) + value
      }
    })

    Object.values(next).forEach(dateDetails => {
      const detail = dateDetails.teslim
      detail.sabahEslesti = detail.sabah === (detail.karsiSabah || 0)
      detail.aksamEslesti = detail.aksam === (detail.karsiAksam || 0)
      detail.kontrolEdildi = Boolean(detail.sabahEslesti && detail.aksamEslesti)
    })

    return next
  }

  function applyAutoValues(
    tarih: string,
    values: Values,
    incomeSource = incomeDetails,
    expenseSource = expenseDetails,
    transferSource = transferDetails,
    deliverySource = deliveryDetails,
  ) {
    const nextValues = {
      ...values,
    }

    const income = incomeSource[tarih]
    if (income) {
      nextValues.pamukkale_turizm = income.pamukkale_turizm.toplam
      nextValues.anadolu_turizm = income.anadolu_turizm.toplam
      nextValues.inegol_seyahat = income.inegol_seyahat.toplam
    }

    const expense = expenseSource[tarih]
    if (expense) {
      nextValues.kredi_karti_14_no = expense.kredi_karti_14_no.toplam
    }

    const transfer = transferSource[tarih]
    if (transfer) {
      nextValues.on_dort_no_giden = transfer.on_dort_no_giden.toplam
    }

    const delivery = deliverySource[tarih]
    if (delivery) {
      nextValues.teslim = delivery.teslim.toplam
    }

    return calculate(nextValues)
  }

  function addRow() {
    const nextDate = getFirstMissingDateWithinMonth(rows.map(row => row.tarih), month, year)
    if (!nextDate) {
      toast.error(`${month} ${year} ayı için eklenecek yeni gün kalmadı.`)
      return
    }

    setRows(prev => [...prev, { tarih: nextDate, tutarlar: applyAutoValues(nextDate, {}) }]
      .sort((a, b) => {
        const dateCompare = a.tarih.localeCompare(b.tarih)
        if (dateCompare !== 0) return dateCompare
        return (VARDIYA_SIRASI[""] ?? 99) - (VARDIYA_SIRASI[""] ?? 99)
      }))
    markDirty()
  }

  function deleteRow(index: number) {
    setRows(prev => prev.filter((_, rowIndex) => rowIndex !== index))
    markDirty()
  }

  function updateValue(rowIndex: number, key: string, value: string) {
    if (
      AUTO_INCOME_KEYS.has(key as AutoIncomeKey) ||
      AUTO_EXPENSE_KEYS.has(key as AutoExpenseKey) ||
      AUTO_TRANSFER_KEYS.has(key as AutoTransferKey) ||
      AUTO_DELIVERY_KEYS.has(key as AutoDeliveryKey)
    ) return
    setRows(prev => prev.map((row, index) => (
      index === rowIndex
        ? { ...row, tutarlar: applyAutoValues(row.tarih, { ...row.tutarlar, [key]: Number(value) || 0 }) }
        : row
    )))
    markDirty()
  }

  async function saveData() {
    if (!currentSube || !currentUserId) return false
    setSaving(true)

    const invalidDateIndex = rows.findIndex(row => !isDateInSelectedMonth(row.tarih, month, year))
    if (invalidDateIndex !== -1) {
      toast.error(`${invalidDateIndex + 1}. satır ${month} ${year} dışında olduğu için kaydedilemez.`)
      setSaving(false)
      return false
    }

    const { error: deleteError } = await supabase
      .from("on_dort_no_hesap_kayitlari")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    if (deleteError) {
      toast.error(deleteError.message || "Eski 14 No Hesap kayıtları temizlenemedi.")
      setSaving(false)
      return false
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("on_dort_no_hesap_kayitlari")
        .insert(rows.map(row => ({
          user_id: currentUserId,
          sube_id: currentSube.id,
          ay_yil: ayYil,
          tarih: row.tarih,
          tutarlar: applyAutoValues(row.tarih, row.tutarlar),
          updated_at: new Date().toISOString(),
        })))

      if (insertError) {
        toast.error(insertError.message || "14 No Hesap kaydedilemedi.")
        setSaving(false)
        return false
      }
    }

    markClean()
    setSaving(false)
    toast.success("14 No Hesap kaydedildi.")
    loadData()
    return true
  }

  const columnTotals = visibleKeys.reduce((acc, key) => {
    acc[key] = rows.reduce((sum, row) => sum + (Number(applyAutoValues(row.tarih, row.tutarlar)[key]) || 0), 0)
    return acc
  }, {} as Record<string, number>)

  function exportPdf() {
    openPdfReport({
      title: `14 No Hesap - ${meta.title}`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Gelir Toplamı", value: `${formatMoney(rows.reduce((sum, row) => sum + (applyAutoValues(row.tarih, row.tutarlar).gelir_toplam || 0), 0))} TL` },
        { label: "14 No Toplamı", value: `${formatMoney(rows.reduce((sum, row) => sum + (applyAutoValues(row.tarih, row.tutarlar).gider_toplam || 0), 0))} TL` },
        { label: "Kalan", value: `${formatMoney(rows.reduce((sum, row) => sum + (applyAutoValues(row.tarih, row.tutarlar).kalan || 0), 0))} TL` },
      ],
      tables: [{
        title: meta.title,
        headers: ["Tarih", ...visibleKeys.map(key => columnMeta.get(key)?.label || key)],
        firstColumnWidth: "88px",
        rows: [
          ...rows.map(row => [
            formatDate(row.tarih),
            ...visibleKeys.map(key => `${formatMoney(applyAutoValues(row.tarih, row.tutarlar)[key] || 0)} TL`),
          ]),
          ["TOPLAM", ...visibleKeys.map(key => `${formatMoney(columnTotals[key] || 0)} TL`)],
        ],
      }],
    })
  }

  const prevMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(MONTHS[11])
        setYear(year - 1)
      }
    } else if (year !== START_YEAR || currentIndex > START_MONTH_INDEX) {
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

  if (subeLoading || loading) {
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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">
              {currentSube?.ad ? `${currentSube.ad} şubesi için ${month} ${year}. Otomatik alanlar ${sourceSube?.ad || "14"} şubesinden çekilir.` : "Şube seçimi bekleniyor."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          <Button onClick={addRow} className="col-span-full gap-2 bg-green-600 hover:bg-green-700 sm:col-span-1">
            <Plus className="h-4 w-4" />
            Satır Ekle
          </Button>
          <Button variant="outline" onClick={exportPdf} disabled={rows.length === 0} className="col-span-full gap-2 sm:col-span-1">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(item => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-full min-w-0 sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(item => (
                <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button onClick={saveData} disabled={saving} className="col-span-full gap-2 sm:col-span-1">
            <Save className="h-4 w-4" />
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>

      <div className="sticky-table-scroll rounded-lg border bg-card">
        <table className="sticky-table min-w-max text-sm">
          <thead>
            <tr>
              <th className="w-10 border bg-muted p-2 text-muted-foreground">#</th>
              <th className="border bg-muted p-2 text-left text-muted-foreground">Tarih</th>
              {visibleKeys.map(key => {
                const column = columnMeta.get(key)
                const color = column?.color || "bg-gray-500"
                return (
                  <th key={key} className={`border p-2 text-center font-semibold ${color} ${getColumnTextColor(color)}`}>
                    {column?.label || key}
                  </th>
                )
              })}
              <th className="w-10 border bg-muted p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${row.tarih}-${rowIndex}`} className="hover:bg-muted/50">
                <td className="border p-1 text-center text-muted-foreground">{rowIndex + 1}</td>
                <td className="border bg-muted/50 px-2 py-1 font-medium">{formatDate(row.tarih)}</td>
                {visibleKeys.map(key => {
                  const calculatedValues = applyAutoValues(row.tarih, row.tutarlar)
                  const readonly = FORMULA_KEYS.has(key)
                  const autoIncome = AUTO_INCOME_KEYS.has(key as AutoIncomeKey)
                  const autoExpense = AUTO_EXPENSE_KEYS.has(key as AutoExpenseKey)
                  const autoTransfer = AUTO_TRANSFER_KEYS.has(key as AutoTransferKey)
                  const autoDelivery = AUTO_DELIVERY_KEYS.has(key as AutoDeliveryKey)
                  const autoDetail = autoIncome
                    ? incomeDetails[row.tarih]?.[key as AutoIncomeKey]
                    : autoExpense
                      ? expenseDetails[row.tarih]?.[key as AutoExpenseKey]
                      : autoTransfer
                        ? transferDetails[row.tarih]?.[key as AutoTransferKey]
                        : autoDelivery
                          ? deliveryDetails[row.tarih]?.[key as AutoDeliveryKey]
                      : null
                  const autoControlled = Boolean(autoDetail?.kontrolEdildi)
                  const showControlWarning = (autoDelivery || autoTransfer) && autoDetail && (!autoDetail.sabahKontrolEdildi || !autoDetail.aksamKontrolEdildi)
                  const controlWarningItems = getControlWarningItems(
                    autoDetail,
                    sourceSube?.ad || "14",
                    (autoTransfer || autoDelivery) ? (transferSourceSube?.ad || "5A") : undefined,
                  )
                  return (
                    <td key={key} className="border p-0">
                      {autoIncome || autoExpense || autoTransfer || autoDelivery ? (
                        <div className={`relative flex min-w-36 items-center justify-end gap-1 px-2 py-1.5 text-right font-semibold ${
                          autoControlled
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200"
                            : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200"
                        }`}>
                          {showControlWarning && (
                            <span
                              className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[10px] border-t-[10px] border-l-transparent border-t-red-600"
                              title={controlWarningItems.join(", ") || "Kontrol edilmedi"}
                            />
                          )}
                          <span>{formatMoney(calculatedValues[key] || 0)} TL</span>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className={`h-7 w-7 ${
                                  autoControlled
                                    ? "text-emerald-700 hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                                    : "text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-500/20"
                                }`}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{columnMeta.get(key)?.label || key} Detayı</DialogTitle>
                                <DialogDescription>
                                  {autoTransfer
                                    ? `${formatDate(row.tarih)} tarihindeki ${sourceSube?.ad || "14"} şubesi gelir tablosu 5/A GELEN tutarı ile ${transferSourceSube?.ad || "5A"} şubesi gider tablosu 14 NO GİDEN tutarı karşılaştırılır.`
                                    : autoDelivery
                                      ? `${formatDate(row.tarih)} tarihindeki ${sourceSube?.ad || "14"} şubesi gider tablosu 5/A GİDEN tutarı ile ${transferSourceSube?.ad || "5A"} şubesi gelir tablosu 14 NO GELEN tutarı karşılaştırılır.`
                                    : autoExpense
                                      ? `${formatDate(row.tarih)} tarihindeki ${sourceSube?.ad || "14"} şubesi gider tablosu PK KREDİ KARTI sabah ve akşam vardiyası toplamı.`
                                      : `${formatDate(row.tarih)} tarihindeki ${sourceSube?.ad || "14"} şubesi gelir tablosu sabah ve akşam vardiyası toplamı.`}
                                </DialogDescription>
                              </DialogHeader>
                              {controlWarningItems.length > 0 && (
                                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200">
                                  <div className="mb-1">Kontrol edilmemiş vardiyalar</div>
                                  {controlWarningItems.map(item => (
                                    <div key={item}>{item}</div>
                                  ))}
                                </div>
                              )}
                              <div className="rounded-lg border">
                                <div className="grid grid-cols-2 border-b px-3 py-2 text-sm">
                                  <span>Sabah vardiyası</span>
                                  <span className="text-right font-semibold">{formatMoney(autoDetail?.sabah || 0)} TL</span>
                                </div>
                                <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                  autoDetail?.sabahKayitVar && autoDetail?.sabahKontrolEdildi
                                    ? "text-emerald-700 dark:text-emerald-200"
                                    : "text-red-700 dark:text-red-200"
                                }`}>
                                  <span>Sabah kontrol</span>
                                  <span className="text-right font-semibold">
                                    {autoDetail?.sabahKontrolEdildi ? "Kontrol edildi" : "Kontrol edilmedi"}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 border-b px-3 py-2 text-sm">
                                  <span>Akşam vardiyası</span>
                                  <span className="text-right font-semibold">{formatMoney(autoDetail?.aksam || 0)} TL</span>
                                </div>
                                <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                  autoDetail?.aksamKayitVar && autoDetail?.aksamKontrolEdildi
                                    ? "text-emerald-700 dark:text-emerald-200"
                                    : "text-red-700 dark:text-red-200"
                                }`}>
                                  <span>Akşam kontrol</span>
                                  <span className="text-right font-semibold">
                                    {autoDetail?.aksamKontrolEdildi ? "Kontrol edildi" : "Kontrol edilmedi"}
                                  </span>
                                </div>
                                {(autoDelivery || autoTransfer) && (
                                  <>
                                    <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                      autoDetail?.sabahEslesti
                                        ? "text-emerald-700 dark:text-emerald-200"
                                        : "text-red-700 dark:text-red-200"
                                    }`}>
                                      <span>{autoTransfer ? "14 sabah 5/A GELEN" : "14 sabah 5/A GİDEN"}</span>
                                      <span className="text-right font-semibold">
                                        {formatMoney(autoDetail?.sabah || 0)} TL
                                      </span>
                                    </div>
                                    <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                      autoDetail?.sabahEslesti
                                        ? "text-emerald-700 dark:text-emerald-200"
                                        : "text-red-700 dark:text-red-200"
                                    }`}>
                                      <span>{autoTransfer ? "5A sabah 14 NO GİDEN" : "5A sabah 14 NO GELEN"}</span>
                                      <span className="text-right font-semibold">
                                        {formatMoney(autoDetail?.karsiSabah || 0)} TL
                                      </span>
                                    </div>
                                    <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                      autoDetail?.aksamEslesti
                                        ? "text-emerald-700 dark:text-emerald-200"
                                        : "text-red-700 dark:text-red-200"
                                    }`}>
                                      <span>{autoTransfer ? "14 akşam 5/A GELEN" : "14 akşam 5/A GİDEN"}</span>
                                      <span className="text-right font-semibold">
                                        {formatMoney(autoDetail?.aksam || 0)} TL
                                      </span>
                                    </div>
                                    <div className={`grid grid-cols-2 border-b px-3 py-2 text-xs ${
                                      autoDetail?.aksamEslesti
                                        ? "text-emerald-700 dark:text-emerald-200"
                                        : "text-red-700 dark:text-red-200"
                                    }`}>
                                      <span>{autoTransfer ? "5A akşam 14 NO GİDEN" : "5A akşam 14 NO GELEN"}</span>
                                      <span className="text-right font-semibold">
                                        {formatMoney(autoDetail?.karsiAksam || 0)} TL
                                      </span>
                                    </div>
                                    {(!autoDetail?.sabahEslesti || !autoDetail?.aksamEslesti) && (
                                      <div className="border-b bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                                        {autoTransfer
                                          ? "14 şubesindeki 5/A GELEN ile 5A şubesindeki 14 NO GİDEN tutarı eşleşmiyor."
                                          : "14 şubesindeki 5/A GİDEN ile 5A şubesindeki 14 NO GELEN tutarı eşleşmiyor."}
                                      </div>
                                    )}
                                  </>
                                )}
                                <div className="grid grid-cols-2 bg-muted px-3 py-2 text-sm font-bold">
                                  <span>Toplam</span>
                                  <span className="text-right">{formatMoney(autoDetail?.toplam || 0)} TL</span>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : readonly ? (
                        <div className={`px-3 py-2 text-right font-bold ${key === "kalan" ? (calculatedValues.kalan >= 0 ? "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-200" : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200") : "bg-muted text-foreground"}`}>
                          {formatMoney(calculatedValues[key] || 0)} TL
                        </div>
                      ) : (
                        <input
                          type="number"
                          value={calculatedValues[key] || ""}
                          onChange={(event) => updateValue(rowIndex, key, event.target.value)}
                          className="w-full bg-transparent px-3 py-2 text-right text-foreground outline-none focus:bg-blue-50 dark:focus:bg-blue-500/20"
                          placeholder="0,00"
                        />
                      )}
                    </td>
                  )
                })}
                <td className="border p-1">
                  <button
                    type="button"
                    onClick={() => deleteRow(rowIndex)}
                    className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/20"
                    title="Satırı sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleKeys.length + 3} className="p-8 text-center text-muted-foreground">
                  Henüz kayıt yok. Satır Ekle ile bu ay için gün ekleyin.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted font-semibold text-foreground">
                <td className="border p-2"></td>
                <td className="border p-2">TOPLAM</td>
                {visibleKeys.map(key => (
                  <td key={key} className="border p-2 text-right">
                    {formatMoney(columnTotals[key] || 0)} TL
                  </td>
                ))}
                <td className="border p-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
