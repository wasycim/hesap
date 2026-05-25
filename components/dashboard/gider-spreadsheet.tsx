"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { FileText, Plus, Save, Trash2, X } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  ORTAKLAR_GROUP_KEY,
  PERSONELLER_GROUP_KEY,
  TableColumnSetting,
  getColumnTextColor,
  mergeColumnSettings,
} from "@/lib/table-column-settings"
import { getLocalDateString, getMonthYearFromDate, getNextDateWithinMonth, isDateInSelectedMonth } from "@/lib/date-navigation"
import { logSecurityEvent } from "@/lib/audit-log"
import { openPdfReport } from "@/lib/pdf-report"

interface Ortak {
  id: string
  ad: string
}

interface Personel {
  id: string
  ad: string
  saatlik_mesai_ucreti?: number
}

interface GiderRow {
  id?: string
  user_id?: string
  sube_id?: string
  tarih: string
  vardiya: string
  el_fisi_odeme: number
  ortak_paylari: Record<string, number>
  personel_paylari: Record<string, number>
  personel_mesai: number
  personel_mesai_detaylari: Record<string, number>
  bil_iade: number
  inegol_donus: number
  pk_kredi_karti: number
  yemek: number
  yanmaz_bilet: number
  diger: number
  ziraat_bankasi: number
  is_bankasi: number
  kuveyt_turk: number
  bakiye_bilet: number
  kargo_cari: number
  hesaba_gelen: number
  on_dort_noya_giden: number
  carsi_bilet: number
  darica_bilet: number
  kredi_karti_bakiye: number
  bankaya_yatan: number
  genel_toplam: number
  custom_values: Record<string, number>
}

interface GiderSpreadsheetProps {
  month: string
  year: number
}

// Sabit sütunlar ve renkleri
const FIXED_COLUMNS = [
  { key: "tarih", label: "TARİH", color: "bg-green-600", editable: false },
  { key: "vardiya", label: "VARDİYA", color: "bg-blue-600", editable: false },
  { key: "el_fisi_odeme", label: "EL FİŞİ ÖDEME", color: "bg-yellow-500", editable: true },
]

const ORTAK_COLOR = "bg-yellow-500"
const PERSONEL_COLOR = "bg-blue-600"

const MIDDLE_COLUMNS = [
  { key: "personel_mesai", label: "PERSONEL MESAİ", color: "bg-blue-600", editable: true },
  { key: "bil_iade", label: "BİL.İADE", color: "bg-red-600", editable: true },
  { key: "inegol_donus", label: "İNEGÖL DÖNÜŞ", color: "bg-orange-500", editable: true },
  { key: "yemek", label: "YEMEK", color: "bg-orange-500", editable: true },
  { key: "yanmaz_bilet", label: "YANMAZ BİLET", color: "bg-orange-500", editable: true },
  { key: "diger", label: "DİĞER", color: "bg-gray-500", editable: true },
  { key: "ziraat_bankasi", label: "ZİRAAT BANKASI", color: "bg-green-600", editable: true },
  { key: "is_bankasi", label: "İŞ BANKASI", color: "bg-green-600", editable: true },
  { key: "kuveyt_turk", label: "KUVEYT TÜRK", color: "bg-green-600", editable: true },
  { key: "bakiye_bilet", label: "BAKİYE BİLET", color: "bg-blue-500", editable: true },
  { key: "kargo_cari", label: "KARGO CARİ", color: "bg-blue-500", editable: true },
  { key: "hesaba_gelen", label: "HESABA GELEN", color: "bg-green-600", editable: true },
  { key: "on_dort_noya_giden", label: "14 NOYA GİDEN", color: "bg-green-600", editable: true },
  { key: "carsi_bilet", label: "ÇARŞI BİLET", color: "bg-blue-500", editable: true },
  { key: "darica_bilet", label: "DARICA BİLET", color: "bg-blue-500", editable: true },
  { key: "kredi_karti_bakiye", label: "K.KARTI BAKİYE", color: "bg-blue-500", editable: true },
  { key: "bankaya_yatan", label: "BANKAYA YATAN", color: "bg-blue-700", editable: true },
  { key: "genel_toplam", label: "GENEL TOPLAM", color: "bg-red-700", editable: false },
]

const VARDIYASIZ_SUBELER = ["carsi", "darica"]
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

function getGiderTotalKey(tarih: string, vardiya: string, isTekVardiya: boolean) {
  return isTekVardiya ? tarih : `${tarih}__${vardiya || "S"}`
}

function compareDateVardiya(a: Pick<GiderRow, "tarih" | "vardiya">, b: Pick<GiderRow, "tarih" | "vardiya">) {
  const dateCompare = a.tarih.localeCompare(b.tarih)
  if (dateCompare !== 0) return dateCompare
  return (VARDIYA_SIRASI[a.vardiya] ?? 99) - (VARDIYA_SIRASI[b.vardiya] ?? 99)
}

export function GiderSpreadsheet({ month, year }: GiderSpreadsheetProps) {
  const [rows, setRows] = useState<GiderRow[]>([])
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("gider", []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { currentSube, refreshKey, userVardiya, isAdmin } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  
  const ayYil = `${month}-${year}`
  const isVardiyasizSube = currentSube
    ? VARDIYASIZ_SUBELER.includes(normalizeSubeName(currentSube.ad))
    : false
  const isTekVardiya = isVardiyasizSube || (!isAdmin && (!userVardiya || userVardiya === "T"))

  useEffect(() => {
    // Şube değiştiğinde önce mevcut verileri temizle
    setRows([])
    
    if (currentSube) {
      loadData()
    }

    if (!currentSube) return

    const channel = supabase
      .channel(`gider_changes_${currentSube.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gider_kayitlari',
          filter: `sube_id=eq.${currentSube.id}`,
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [month, year, currentSube?.id, refreshKey])

  useEffect(() => {
    registerSaveHandler(saveData)
    return () => registerSaveHandler(null)
  }, [rows, currentSube?.id, ayYil, userVardiya, isAdmin, registerSaveHandler])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    const { data: settingsData } = await supabase
      .from("kolon_ayarlari")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("table_type", "gider")
      .order("sort_order", { ascending: true })

    setColumnSettings(mergeColumnSettings("gider", settingsData as TableColumnSetting[] | null))

    // Ortakları yükle (tüm şubelerde aynı)
    const { data: ortakData } = await supabase
      .from("ortaklar")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })
    
    if (ortakData) setOrtaklar(ortakData)

    // Personelleri yükle (tüm şubelerde aynı)
    const { data: personelData } = await supabase
      .from("personeller")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })
    
    if (personelData) setPersoneller(personelData)
    const mesaiRates = new Map((personelData || []).map(personel => [personel.id, Number(personel.saatlik_mesai_ucreti) || 0]))

    // Şubeye göre gider kayıtlarını yükle
    const { data, error } = await supabase
      .from("gider_kayitlari")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true })

    if (!error && data) {
      setRows(data.filter(row => isDateInSelectedMonth(row.tarih, month, year)).map(row => {
        const mesaiDetails = row.personel_mesai_detaylari || {}
        const mesaiTotal = Object.entries(mesaiDetails).reduce((sum, [personelId, hours]) => (
          sum + ((Number(hours) || 0) * (mesaiRates.get(personelId) || 0))
        ), 0)

        return ({
        id: row.id,
        user_id: row.user_id,
        sube_id: row.sube_id,
        tarih: row.tarih,
        vardiya: isTekVardiya ? "" : (row.vardiya || "S"),
        el_fisi_odeme: Number(row.el_fisi_odeme) || 0,
        ortak_paylari: row.ortak_pilarim || {},
        personel_paylari: row.personel_paylari || {},
        personel_mesai: mesaiTotal || Number(row.personel_mesai) || 0,
        personel_mesai_detaylari: mesaiDetails,
        bil_iade: Number(row.bil_iade) || 0,
        inegol_donus: Number(row.inegol_donus) || 0,
        pk_kredi_karti: Number(row.pk_kredi_karti) || 0,
        yemek: Number(row.yemek) || 0,
        yanmaz_bilet: Number(row.yanmaz_bilet) || 0,
        diger: Number(row.diger) || 0,
        ziraat_bankasi: Number(row.ziraat_bankasi) || 0,
        is_bankasi: Number(row.is_bankasi) || 0,
        kuveyt_turk: Number(row.kuveyt_turk) || 0,
        bakiye_bilet: Number(row.bakiye_bilet) || 0,
        kargo_cari: Number(row.kargo_cari) || 0,
        hesaba_gelen: Number(row.hesaba_gelen) || 0,
        on_dort_noya_giden: Number(row.on_dort_noya_giden) || 0,
        carsi_bilet: Number(row.carsi_bilet) || 0,
        darica_bilet: Number(row.darica_bilet) || 0,
        kredi_karti_bakiye: Number(row.kredi_karti_bakiye) || 0,
        bankaya_yatan: Number(row.bankaya_yatan) || 0,
        genel_toplam: Number(row.genel_toplam) || 0,
        custom_values: row.custom_values || {},
      })}).sort(compareDateVardiya))
    }
    setLoading(false)
  }

  function getNextDate(): string {
    return getNextDateWithinMonth(rows.map(row => row.tarih), month, year) || ""
  }

  function calculateTotal(row: GiderRow): number {
    let total = row.el_fisi_odeme + row.personel_mesai + row.bil_iade + 
      row.inegol_donus + row.pk_kredi_karti + row.yemek + row.yanmaz_bilet + row.diger +
      row.ziraat_bankasi + row.is_bankasi + row.kuveyt_turk +
      row.bakiye_bilet + row.kargo_cari + row.hesaba_gelen +
      row.on_dort_noya_giden + row.carsi_bilet + row.darica_bilet +
      row.kredi_karti_bakiye + row.bankaya_yatan
      + Object.values(row.custom_values || {}).reduce((sum, val) => sum + (Number(val) || 0), 0)

    // Ortak paylarını ekle
    Object.values(row.ortak_paylari).forEach(val => {
      total += Number(val) || 0
    })

    // Personel paylarını ekle
    Object.values(row.personel_paylari).forEach(val => {
      total += Number(val) || 0
    })

    return total
  }

  function calculateMesaiTotal(details: Record<string, number>): number {
    return Object.entries(details || {}).reduce((sum, [personelId, hours]) => {
      const personel = personeller.find(item => item.id === personelId)
      return sum + ((Number(hours) || 0) * (Number(personel?.saatlik_mesai_ucreti) || 0))
    }, 0)
  }

  function addRow() {
    const today = getLocalDateString()
    const todayMonthYear = getMonthYearFromDate(today)
    const nextDate = isAdmin ? getNextDate() : today

    if (!nextDate || !isDateInSelectedMonth(nextDate, month, year)) {
      toast.error(`${month} ${year} ayı için eklenecek yeni gün kalmadı.`)
      return
    }

    if (!isAdmin && (month !== todayMonthYear.month || year !== todayMonthYear.year)) {
      toast.error("Normal kullanıcılar sadece bugünün olduğu ayda satır ekleyebilir.")
      return
    }
    
    // Vardiyasız şubelerde tek satır, vardiyalı şubelerde admin için S ve A eklenir.
    const vardiyalarToAdd = isTekVardiya ? [""] : (isAdmin ? ["S", "A"] : [userVardiya || "S"])

    if (!isAdmin && vardiyalarToAdd.some(vardiya => rows.some(row => row.tarih === today && row.vardiya === vardiya))) {
      toast.error("Bugün için zaten bir satır var.")
      return
    }
    
    const newRowsToAdd: GiderRow[] = vardiyalarToAdd.map(vardiya => ({
      tarih: nextDate,
      vardiya,
      el_fisi_odeme: 0,
      ortak_paylari: {},
      personel_paylari: {},
      personel_mesai: 0,
      personel_mesai_detaylari: {},
      bil_iade: 0,
      inegol_donus: 0,
      pk_kredi_karti: 0,
      yemek: 0,
      yanmaz_bilet: 0,
      diger: 0,
      ziraat_bankasi: 0,
      is_bankasi: 0,
      kuveyt_turk: 0,
      bakiye_bilet: 0,
      kargo_cari: 0,
      hesaba_gelen: 0,
      on_dort_noya_giden: 0,
      carsi_bilet: 0,
      darica_bilet: 0,
      kredi_karti_bakiye: 0,
      bankaya_yatan: 0,
      genel_toplam: 0,
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
      table: "gider_kayitlari",
      sube_id: currentSube?.id,
      tarih: deletedRow?.tarih,
      vardiya: deletedRow?.vardiya,
    })
  }

  function updateCell(rowIndex: number, key: string, value: number, type?: "ortak" | "personel" | "mesai") {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    
    if (type === "ortak") {
      row.ortak_paylari = { ...row.ortak_paylari, [key]: value }
    } else if (type === "personel") {
      row.personel_paylari = { ...row.personel_paylari, [key]: value }
    } else if (type === "mesai") {
      row.personel_mesai_detaylari = { ...row.personel_mesai_detaylari, [key]: value }
      row.personel_mesai = calculateMesaiTotal(row.personel_mesai_detaylari)
    } else if (key.startsWith("custom_")) {
      row.custom_values = { ...row.custom_values, [key]: value }
    } else {
      (row as any)[key] = value
    }
    
    // Genel toplamı hesapla
    row.genel_toplam = calculateTotal(row)
    
    newRows[rowIndex] = row
    setRows(newRows)
    markDirty()
  }

  function removeMesaiPersonel(rowIndex: number, personelId: string) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    const nextDetails = { ...row.personel_mesai_detaylari }
    delete nextDetails[personelId]
    row.personel_mesai_detaylari = nextDetails
    row.personel_mesai = calculateMesaiTotal(nextDetails)
    row.genel_toplam = calculateTotal(row)
    newRows[rowIndex] = row
    setRows(newRows)
    markDirty()
  }

  async function syncGelirGiderTotals() {
    if (!currentSube) return

    const { data: giderRows } = await supabase
      .from("gider_kayitlari")
      .select("tarih, vardiya, genel_toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    const totalsByDate = new Map<string, number>()
    ;(giderRows || []).forEach(row => {
      const key = getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)
      totalsByDate.set(key, (totalsByDate.get(key) || 0) + (Number(row.genel_toplam) || 0))
    })

    const { data: gelirRows } = await supabase
      .from("gelir_kayitlari")
      .select("id, tarih, vardiya, toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    for (const row of gelirRows || []) {
      const giderler = totalsByDate.get(getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)) || 0
      await supabase
        .from("gelir_kayitlari")
        .update({
          giderler,
          kalan: (Number(row.toplam) || 0) - giderler,
        })
        .eq("id", row.id)
    }
  }

  async function saveData() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return false
    }

    // Sadece düzenleyebildiğim vardiyaları filtrele
    const editableRows = rows.filter(row => {
      if (!isAdmin && row.tarih !== getLocalDateString()) return false
      if (isTekVardiya || isAdmin) return true
      return row.vardiya === userVardiya
    })

    const invalidDateIndex = editableRows.findIndex(row => !isDateInSelectedMonth(row.tarih, month, year))
    if (invalidDateIndex !== -1) {
      toast.error(`${invalidDateIndex + 1}. satır ${month} ${year} dışında olduğu için kaydedilemez.`)
      setSaving(false)
      return false
    }

    // Önce bu ay/yıl için kendi kayıtlarımı sil (sadece düzenleyebildiğim vardiyalardan)
    let deleteQuery = supabase
      .from("gider_kayitlari")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("user_id", user.id)
      deleteQuery = deleteQuery.eq("tarih", getLocalDateString())
    }
    
    if (!isTekVardiya && userVardiya && !isAdmin) {
      deleteQuery = deleteQuery.eq("vardiya", userVardiya)
    }
    
    const { error: deleteError } = await deleteQuery
    if (deleteError) {
      console.log("[v0] Gider silme hatası:", deleteError)
      setSaving(false)
      return false
    }

    // Yeni kayıtları ekle
    if (editableRows.length > 0) {
      const insertData = editableRows.map(row => ({
        user_id: row.user_id || user.id,
        sube_id: currentSube.id,
        ay_yil: ayYil,
        tarih: row.tarih,
        vardiya: row.vardiya,
        el_fisi_odeme: row.el_fisi_odeme,
        ortak_pilarim: row.ortak_paylari,
        personel_paylari: row.personel_paylari,
        personel_mesai: row.personel_mesai,
        personel_mesai_detaylari: row.personel_mesai_detaylari,
        bil_iade: row.bil_iade,
        inegol_donus: row.inegol_donus,
        pk_kredi_karti: row.pk_kredi_karti,
        yemek: row.yemek,
        yanmaz_bilet: row.yanmaz_bilet,
        diger: row.diger,
        ziraat_bankasi: row.ziraat_bankasi,
        is_bankasi: row.is_bankasi,
        kuveyt_turk: row.kuveyt_turk,
        bakiye_bilet: row.bakiye_bilet,
        kargo_cari: row.kargo_cari,
        hesaba_gelen: row.hesaba_gelen,
        on_dort_noya_giden: row.on_dort_noya_giden,
        carsi_bilet: row.carsi_bilet,
        darica_bilet: row.darica_bilet,
        kredi_karti_bakiye: row.kredi_karti_bakiye,
        bankaya_yatan: row.bankaya_yatan,
        genel_toplam: row.genel_toplam,
        custom_values: row.custom_values || {},
      }))

      const { error } = await supabase.from("gider_kayitlari").insert(insertData)
      if (error) {
        console.log("[v0] Gider kaydetme hatası:", error)
        setSaving(false)
        return false
      }

    }

    await syncGelirGiderTotals()

    setSaving(false)
    markClean()
    toast.success("Değişiklikler kaydedildi ✅")
    loadData()
    return true
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Tüm sütunları oluştur
  const configuredColumns = columnSettings
    .filter(col => col.aktif && (!isTekVardiya || col.column_key !== "vardiya"))
    .map(col => ({ key: col.column_key, label: col.label, color: col.color, editable: col.column_key !== "tarih" && col.column_key !== "vardiya" && col.column_key !== "genel_toplam" }))

  const allColumns = configuredColumns.flatMap(col => {
    if (col.key === ORTAKLAR_GROUP_KEY) {
      return ortaklar.map(o => ({
        key: `ortak_${o.id}`,
        label: o.ad.toUpperCase(),
        color: col.color || ORTAK_COLOR,
        editable: true,
        type: "ortak" as const,
      }))
    }

    if (col.key === PERSONELLER_GROUP_KEY) {
      return personeller.map(p => ({
        key: `personel_${p.id}`,
        label: p.ad.toUpperCase(),
        color: col.color || PERSONEL_COLOR,
        editable: true,
        type: "personel" as const,
      }))
    }

    return [col]
  })

  function getColumnValue(row: GiderRow, key: string) {
    if (key === "personel_mesai") return row.personel_mesai || 0
    if (key.startsWith("ortak_")) return row.ortak_paylari[key.replace("ortak_", "")] || 0
    if (key.startsWith("personel_")) return row.personel_paylari[key.replace("personel_", "")] || 0
    if (key.startsWith("custom_")) return row.custom_values?.[key] || 0
    return (row as any)[key] || 0
  }

  const columnTotals = allColumns.reduce((acc, col) => {
    if (col.key !== "tarih" && col.key !== "vardiya") {
      acc[col.key] = rows.reduce((sum, row) => sum + (Number(getColumnValue(row, col.key)) || 0), 0)
    }
    return acc
  }, {} as Record<string, number>)

  function exportPdf() {
    openPdfReport({
      title: "Gider Tablosu Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Genel Toplam", value: `${formatNumber(columnTotals.genel_toplam || 0)} TL` },
        { label: "Bakiye Bilet", value: `${formatNumber(columnTotals.bakiye_bilet || 0)} TL` },
        { label: "Personel Mesai", value: `${formatNumber(columnTotals.personel_mesai || 0)} TL` },
        { label: "Kargo Cari", value: `${formatNumber(columnTotals.kargo_cari || 0)} TL` },
      ],
      tables: [{
        title: "Aylık Gider Detayı",
        headers: allColumns.map(col => col.label),
        firstColumnWidth: "58px",
        rows: [
          ...rows.map(row => allColumns.map(col => {
            if (col.key === "tarih") return formatDate(row.tarih)
            if (col.key === "vardiya") return row.vardiya || "Tek"
            return `${formatNumber(Number(getColumnValue(row, col.key)) || 0)} TL`
          })),
          allColumns.map(col => {
            if (col.key === "tarih") return "TOPLAM"
            if (col.key === "vardiya") return ""
            return `${formatNumber(columnTotals[col.key] || 0)} TL`
          }),
        ],
      }],
    })
    return

    const identityColumns = allColumns.filter(col => col.key === "tarih" || col.key === "vardiya")
    const dataColumns = allColumns.filter(col => col.key !== "tarih" && col.key !== "vardiya")
    const columnGroups = Array.from({ length: Math.ceil(dataColumns.length / 6) }, (_, index) => dataColumns.slice(index * 6, index * 6 + 6))
    const tables = columnGroups.map((group, index) => {
      const groupColumns = [...identityColumns, ...group]
      return {
        title: `Aylık Gider Detayı ${columnGroups.length > 1 ? `(${index + 1}/${columnGroups.length})` : ""}`,
        headers: groupColumns.map(col => col.label),
        firstColumnWidth: "82px",
        rows: [
          ...rows.map(row => groupColumns.map(col => {
            if (col.key === "tarih") return formatDate(row.tarih)
            if (col.key === "vardiya") return row.vardiya || "Tek"
            return `${formatNumber(Number(getColumnValue(row, col.key)) || 0)} TL`
          })),
          groupColumns.map(col => {
            if (col.key === "tarih") return "TOPLAM"
            if (col.key === "vardiya") return ""
            return `${formatNumber(columnTotals[col.key] || 0)} TL`
          }),
        ],
      }
    })

    openPdfReport({
      title: "Gider Tablosu Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Genel Toplam", value: `${formatNumber(columnTotals.genel_toplam || 0)} TL` },
        { label: "Bakiye Bilet", value: `${formatNumber(columnTotals.bakiye_bilet || 0)} TL` },
        { label: "Personel Mesai", value: `${formatNumber(columnTotals.personel_mesai || 0)} TL` },
        { label: "Kargo Cari", value: `${formatNumber(columnTotals.kargo_cari || 0)} TL` },
      ],
      tables,
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button onClick={addRow} size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-1" /> Satır Ekle
        </Button>
        <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button onClick={exportPdf} size="sm" variant="outline" disabled={rows.length === 0}>
          <FileText className="w-4 h-4 mr-1" /> PDF
        </Button>
      </div>

      {(ortaklar.length === 0 || personeller.length === 0) && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-100">
          <strong>Dikkat:</strong> Önce &quot;Ayarlar&quot; sayfasından ortakları ve personelleri eklemeniz gerekiyor.
        </div>
      )}

      <div className="sticky-table-scroll rounded-lg border bg-card">
        <table className="sticky-table min-w-max text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 w-10 border bg-muted p-2 text-muted-foreground">#</th>
              {allColumns.map(col => (
                <th 
                  key={col.key} 
                  className={`p-2 border font-semibold whitespace-nowrap ${col.color} ${getColumnTextColor(col.color)}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="w-10 border bg-muted p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Vardiya kontrolü: userVardiya null ise hepsini düzenleyebilir, değilse sadece kendi vardiyasını
              const canEditVardiya = isAdmin || (row.tarih === getLocalDateString() && (isTekVardiya || userVardiya === row.vardiya))
              
              return (
              <tr key={rowIndex} className={`hover:bg-muted/50 ${!canEditVardiya ? "bg-muted/50 opacity-70" : ""}`}>
                <td className="sticky left-0 border bg-card p-1 text-center text-muted-foreground">{rowIndex + 1}</td>
                {allColumns.map(col => {
                  const isOrtak = col.key.startsWith("ortak_")
                  const isPersonel = col.key.startsWith("personel_") && col.key !== "personel_mesai"
                  const id = isOrtak ? col.key.replace("ortak_", "") : isPersonel ? col.key.replace("personel_", "") : null
                  
                  let value: number = 0
                  if (isOrtak && id) {
                    value = row.ortak_paylari[id] || 0
                  } else if (isPersonel && id) {
                    value = row.personel_paylari[id] || 0
                  } else if (col.key.startsWith("custom_")) {
                    value = row.custom_values?.[col.key] || 0
                  } else {
                    value = (row as any)[col.key] || 0
                  }

                  return (
                    <td key={col.key} className="p-0 border">
                      {col.key === "tarih" ? (
                        <div className="bg-muted px-2 py-1 text-center font-medium text-foreground">
                          {formatDate(row.tarih)}
                        </div>
                      ) : col.key === "vardiya" ? (
                        <div className={`px-2 py-1 text-center font-bold ${
                          row.vardiya === "S" ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200" : "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200"
                        }`}>
                          {row.vardiya}
                        </div>
                      ) : col.key === "genel_toplam" ? (
                        <div className="bg-red-100 px-2 py-1 text-right font-bold text-red-800 dark:bg-red-500/20 dark:text-red-200">
                          {formatNumber(row.genel_toplam)} ₺
                        </div>
                      ) : col.key === "personel_mesai" ? (
                        canEditVardiya ? (
                          <div className="flex min-w-[260px] items-center gap-2 p-1">
                            <select
                              className="h-8 min-w-0 flex-1 rounded border bg-background px-2 text-foreground"
                              defaultValue=""
                              onChange={(event) => {
                                const personelId = event.target.value
                                if (!personelId) return
                                if (row.personel_mesai_detaylari[personelId] === undefined) {
                                  updateCell(rowIndex, personelId, 0, "mesai")
                                }
                                event.currentTarget.value = ""
                              }}
                            >
                              <option value="">Personel seç</option>
                              {personeller.map(personel => (
                                <option key={personel.id} value={personel.id}>{personel.ad}</option>
                              ))}
                            </select>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(row.personel_mesai_detaylari || {}).map(([personelId, hours]) => {
                                const personel = personeller.find(item => item.id === personelId)
                                if (!personel) return null
                                return (
                                  <label key={personelId} className="flex items-center gap-1 rounded border bg-muted/40 px-1 py-0.5 text-xs">
                                    <span className="max-w-16 truncate">{personel.ad}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.5"
                                      value={hours || ""}
                                      onChange={(event) => updateCell(rowIndex, personelId, Number(event.target.value) || 0, "mesai")}
                                      className="h-7 w-14 bg-transparent text-right outline-none"
                                      placeholder="saat"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeMesaiPersonel(rowIndex, personelId)}
                                      className="rounded p-0.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20"
                                      title="Personeli mesai satırından kaldır"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </label>
                                )
                              })}
                            </div>
                            <span className="min-w-20 text-right font-semibold">{formatNumber(row.personel_mesai)} TL</span>
                          </div>
                        ) : (
                          <div className="px-2 py-1 text-right text-muted-foreground">
                            {formatNumber(row.personel_mesai)} TL
                          </div>
                        )
                      ) : canEditVardiya ? (
                        <input
                          type="number"
                          value={value || ""}
                          onChange={(e) => {
                            const newVal = Number(e.target.value) || 0
                            if (isOrtak && id) {
                              updateCell(rowIndex, id, newVal, "ortak")
                            } else if (isPersonel && id) {
                              updateCell(rowIndex, id, newVal, "personel")
                            } else {
                              updateCell(rowIndex, col.key, newVal)
                            }
                          }}
                          className="w-full bg-transparent px-2 py-1 text-right text-foreground focus:bg-blue-50 focus:outline-none dark:focus:bg-blue-500/20"
                          placeholder="0,00"
                        />
                      ) : (
                        <div className="px-2 py-1 text-right text-muted-foreground">
                          {formatNumber(value)} ₺
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="p-1 border">
                  {canEditVardiya && (
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
                <td colSpan={allColumns.length + 2} className="p-8 text-center text-muted-foreground">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-muted font-semibold text-foreground">
                <td className="p-2 border"></td>
                {allColumns.map(col => (
                  <td key={col.key} className="p-2 border text-right">
                    {col.key === "tarih"
                      ? "TOPLAM"
                      : col.key !== "vardiya" && columnTotals[col.key] !== undefined
                      ? `${formatNumber(columnTotals[col.key])} ₺`
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
