"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { TableColumnSetting, getColumnTextColor, mergeColumnSettings } from "@/lib/table-column-settings"
import { getLocalDateString, getMonthIndex, getMonthYearFromDate } from "@/lib/date-navigation"
import { logSecurityEvent } from "@/lib/audit-log"

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
  custom_values: Record<string, number>
}

interface GelirSpreadsheetProps {
  month: string
  year: number
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
  "diger_komisyon", "kasa_gelen", "toplam", "giderler", "kalan", "durum"
]

const VARDIYASIZ_SUBELER = ["carsi", "darica"]
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

export function GelirSpreadsheet({ month, year }: GelirSpreadsheetProps) {
  const [rows, setRows] = useState<GelirRow[]>([])
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("gelir", []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { currentSube, isAdmin, currentUserId, refreshKey, userVardiya } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  
  const ayYil = `${month}-${year}`
  const isVardiyasizSube = currentSube
    ? VARDIYASIZ_SUBELER.includes(normalizeSubeName(currentSube.ad))
    : false
  const isTekVardiya = isVardiyasizSube || (!isAdmin && (!userVardiya || userVardiya === "T"))
  const activeColumnSettings = columnSettings.filter(col => col.aktif && (!isTekVardiya || col.column_key !== "vardiya"))
  const visibleColumns = activeColumnSettings.map(col => col.column_key)
  const columnColorMap = Object.fromEntries(activeColumnSettings.map(col => [col.column_key, col.color]))
  const columnLabelMap = Object.fromEntries(activeColumnSettings.map(col => [col.column_key, col.label]))

  useEffect(() => {
    // Şube değiştiğinde önce mevcut verileri temizle
    setRows([])
    
    if (currentSube) {
      loadData()
    }

    // Realtime subscription
    const channel = supabase
      .channel(`gelir_changes_${currentSube?.id || 'none'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gelir_kayitlari',
        },
        () => {
          if (currentSube) loadData()
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
      .eq("table_type", "gelir")
      .order("sort_order", { ascending: true })

    setColumnSettings(mergeColumnSettings("gelir", settingsData as TableColumnSetting[] | null))

    // Şubeye göre kayıtları çek (admin tüm kullanıcıların kayıtlarını görür)
    let query = supabase
      .from("gelir_kayitlari")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true })

    const { data, error } = await query

    if (!error && data) {
      setRows(data.map(row => ({
        id: row.id,
        user_id: row.user_id,
        sube_id: row.sube_id,
        tarih: row.tarih,
        vardiya: isTekVardiya ? "" : (row.vardiya || "S"),
        pamukkale_turizm: Number(row.pamukkale_turizm) || 0,
        anadolu_ulasim: Number(row.anadolu_ulasim) || 0,
        inegol_seyahat: Number(row.inegol_seyahat) || 0,
        alasehir_turizm: Number(row.alasehir_turizm) || 0,
        unlu_1: Number(row.unlu_1) || 0,
        unlu_2: Number(row.unlu_2) || 0,
        pamukkale_kargo: Number(row.pamukkale_kargo) || 0,
        diger_komisyon: Number(row.diger_komisyon) || 0,
        kasa_gelen: Number(row.kasa_gelen) || 0,
        toplam: Number(row.toplam) || 0,
        giderler: Number(row.giderler) || 0,
        kalan: (Number(row.toplam) || 0) - (Number(row.giderler) || 0),
        durum: row.durum || "KONTROL EDİLMEDİ",
        custom_values: row.custom_values || {},
      })))
    }
    setLoading(false)
  }

  function getNextDate(): string {
    const monthIndex = getMonthIndex(month)
    
    if (rows.length === 0) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
    }
    
    const lastDate = new Date(rows[rows.length - 1].tarih)
    lastDate.setDate(lastDate.getDate() + 1)
    return lastDate.toISOString().split("T")[0]
  }

  function addRow() {
    const today = getLocalDateString()
    const todayMonthYear = getMonthYearFromDate(today)
    const nextDate = isAdmin ? getNextDate() : today

    if (!isAdmin && (month !== todayMonthYear.month || year !== todayMonthYear.year)) {
      toast.error("Normal kullanıcılar sadece bugünün olduğu ayda satır ekleyebilir.")
      return
    }
    
    // Vardiyasiz subelerde tek satir, vardiyali subelerde admin icin S ve A eklenir.
    const vardiyalarToAdd = isTekVardiya ? [""] : (isAdmin ? ["S", "A"] : [userVardiya || "S"])

    if (!isAdmin && vardiyalarToAdd.some(vardiya => rows.some(row => row.tarih === today && row.vardiya === vardiya))) {
      toast.error("Bugün için zaten bir satır var.")
      return
    }
    
    const newRowsToAdd: GelirRow[] = vardiyalarToAdd.map(vardiya => ({
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
    const newRows = [...rows, ...newRowsToAdd].sort((a, b) => {
      const dateCompare = a.tarih.localeCompare(b.tarih)
      if (dateCompare !== 0) return dateCompare
      // Aynı tarihte S önce A sonra
      return (VARDIYA_SIRASI[a.vardiya] ?? 99) - (VARDIYA_SIRASI[b.vardiya] ?? 99)
    })
    
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
    
    const isCustomColumn = column.startsWith("custom_")

    if (isCustomColumn) {
      row.custom_values = { ...row.custom_values, [column]: Number(value) || 0 }
    } else if (column === "durum") {
      row.durum = value as string
    } else if (column !== "tarih" && column !== "toplam" && column !== "kalan") {
      (row as any)[column] = Number(value) || 0
    }
    
    // Toplam hesapla (şirketlerden gelen + kasa gelen)
    row.toplam = row.pamukkale_turizm + row.anadolu_ulasim + row.inegol_seyahat +
      row.alasehir_turizm + row.unlu_1 + row.unlu_2 + row.pamukkale_kargo +
      row.diger_komisyon + row.kasa_gelen +
      Object.values(row.custom_values || {}).reduce((sum, val) => sum + (Number(val) || 0), 0)
    
    // Kalan = Toplam - Giderler
    row.kalan = row.toplam - row.giderler
    
    newRows[rowIndex] = row
    setRows(newRows)
    markDirty()
  }

  async function saveData() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return false
    }

    // Sadece düzenleyebildiğim vardiyaları filtrele
    // userVardiya null ise hepsini, değilse sadece kendi vardiyamı kaydedebilirim
    const editableRows = rows.filter(row => {
      if (!isAdmin && row.tarih !== getLocalDateString()) return false
      // Admin veya vardiyası olmayan kullanıcı her şeyi kaydedebilir
      if (isTekVardiya || isAdmin) return true
      // Sadece kendi vardiyamı kaydedebilirim
      return row.vardiya === userVardiya
    })

    // Önce kendi kayıtlarımı sil (sadece düzenleyebildiğim vardiyalardan)
    let deleteQuery = supabase
      .from("gelir_kayitlari")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("user_id", user.id)
      deleteQuery = deleteQuery.eq("tarih", getLocalDateString())
    }
    
    // Eğer kullanıcının belirli bir vardiyası varsa sadece o vardiyayı sil
    if (!isTekVardiya && userVardiya && !isAdmin) {
      deleteQuery = deleteQuery.eq("vardiya", userVardiya)
    }
    
    const { error: deleteError } = await deleteQuery
    if (deleteError) {
      console.log("[v0] Gelir silme hatasi:", deleteError)
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
        pamukkale_turizm: row.pamukkale_turizm,
        anadolu_ulasim: row.anadolu_ulasim,
        inegol_seyahat: row.inegol_seyahat,
        alasehir_turizm: row.alasehir_turizm,
        unlu_1: row.unlu_1,
        unlu_2: row.unlu_2,
        pamukkale_kargo: row.pamukkale_kargo,
        diger_komisyon: row.diger_komisyon,
        kasa_gelen: row.kasa_gelen,
        toplam: row.toplam,
        giderler: row.giderler,
        kalan: row.kalan,
        durum: row.durum,
        custom_values: row.custom_values || {},
      }))

      const { error } = await supabase.from("gelir_kayitlari").insert(insertData)
      if (error) {
        console.log("[v0] Gelir kaydetme hatasi:", error)
        setSaving(false)
        return false
      }
    }

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

  function getCellValue(row: GelirRow, col: string) {
    return col.startsWith("custom_") ? row.custom_values?.[col] : (row as any)[col]
  }

  // Sütun toplamları
  const columnTotals = visibleColumns.reduce((acc, col) => {
    if (col !== "tarih" && col !== "durum" && col !== "vardiya") {
      acc[col] = rows.reduce((sum, row) => sum + (getCellValue(row, col) || 0), 0)
    }
    return acc
  }, {} as Record<string, number>)

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
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 border bg-gray-100 w-10">#</th>
              {visibleColumns.map(col => (
                <th 
                  key={col} 
                  className={`p-2 border font-semibold whitespace-nowrap ${columnColorMap[col] || HEADER_COLORS[col]} ${getColumnTextColor(columnColorMap[col] || HEADER_COLORS[col])}`}
                >
                  {columnLabelMap[col] || HEADER_LABELS[col] || col}
                </th>
              ))}
              <th className="p-2 border bg-gray-100 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Vardiya kontrolü: userVardiya null ise hepsini düzenleyebilir, değilse sadece kendi vardiyasını
              const canEditVardiya = isAdmin || (row.tarih === getLocalDateString() && (isTekVardiya || userVardiya === row.vardiya))
              const canEdit = canEditVardiya
              
              return (
              <tr key={rowIndex} className={`hover:bg-gray-50 ${!canEditVardiya ? "bg-gray-100/50 opacity-70" : ""}`}>
                <td className="p-1 border text-center text-gray-500">{rowIndex + 1}</td>
                {visibleColumns.map(col => (
                  <td key={col} className="p-0 border">
                    {col === "tarih" ? (
                      <div className="px-2 py-1 bg-gray-100 text-center font-medium">
                        {formatDate(row.tarih)}
                      </div>
                    ) : col === "vardiya" ? (
                      <div className={`px-2 py-1 text-center font-bold ${
                        row.vardiya === "S" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                      }`}>
                        {row.vardiya}
                      </div>
                    ) : col === "toplam" || col === "kalan" ? (
                      <div className={`px-2 py-1 text-right font-semibold ${
                        col === "kalan" ? (row.kalan >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800") : "bg-gray-100"
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
                              ? "bg-emerald-100 text-emerald-700" 
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          <option value="KONTROL EDİLMEDİ" className="bg-red-100 text-red-700">KONTROL EDİLMEDİ</option>
                          <option value="KONTROL EDİLDİ" className="bg-emerald-100 text-emerald-700">KONTROL EDİLDİ</option>
                        </select>
                      ) : (
                        <div className={`w-full px-2 py-1.5 text-center font-medium ${
                          row.durum === "KONTROL EDİLDİ" 
                            ? "bg-emerald-100 text-emerald-700" 
                            : "bg-red-100 text-red-700"
                        }`}>
                          {row.durum}
                        </div>
                      )
                    ) : col === "giderler" ? (
                      <div className="px-2 py-1 text-right bg-red-50 text-red-700 font-medium">
                        {formatNumber(row.giderler)} ₺
                      </div>
                    ) : canEdit ? (
                      <input
                        type="number"
                        value={getCellValue(row, col) || ""}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        className="w-full px-2 py-1 text-right focus:outline-none focus:bg-blue-50"
                        placeholder="0,00"
                      />
                    ) : (
                      <div className="px-2 py-1 text-right text-gray-600">
                        {formatNumber(getCellValue(row, col) || 0)} ₺
                      </div>
                    )}
                  </td>
                ))}
                <td className="p-1 border">
                  {canEdit && (
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            )})}
            
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="p-8 text-center text-gray-500">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-semibold">
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
