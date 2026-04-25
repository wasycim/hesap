"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"

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

export function GelirSpreadsheet({ month, year }: GelirSpreadsheetProps) {
  const [rows, setRows] = useState<GelirRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletedRows, setDeletedRows] = useState<GelirRow[]>([])
  const [activeColumnKeys, setActiveColumnKeys] = useState<string[] | null>(null)
  const supabase = createClient()
  const { currentSube, isAdmin, currentUserId, refreshKey, userVardiya } = useSube()
  const { markClean, registerSaveHandler } = useUnsavedChanges()
  
  const ayYil = `${month}-${year}`

  const isColumnActive = (key: string) => {
    if (["tarih", "vardiya", "toplam", "giderler", "kalan", "durum"].includes(key)) return true
    if (activeColumnKeys === null) return true
    return activeColumnKeys.includes(key)
  }

  const visibleColumns = COLUMNS.filter(isColumnActive)
  const aktifGelirKolonlari = activeColumnKeys ?? [
    "pamukkale_turizm",
    "anadolu_ulasim",
    "inegol_seyahat",
    "alasehir_turizm",
    "unlu_1",
    "unlu_2",
    "pamukkale_kargo",
    "diger_komisyon",
    "kasa_gelen",
  ]
  useEffect(() => {
    // Şube değiştiğinde önce mevcut verileri temizle
    setRows([])
    setDeletedRows([])
    setActiveColumnKeys(null)
    
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

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    const { data: kolonAyarData } = await supabase
      .from("sube_kolon_ayarlari")
      .select("kolon_key, aktif, sira")
      .eq("sube_id", currentSube.id)
      .eq("tablo", "gelir")
      .order("sira", { ascending: true })

    if (kolonAyarData && kolonAyarData.length > 0) {
      setActiveColumnKeys(kolonAyarData.filter((k: any) => k.aktif).map((k: any) => k.kolon_key))
    } else {
      setActiveColumnKeys(null)
    }

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
        vardiya: row.vardiya || "S",
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
      })))
    }
    setLoading(false)
  }

  function getNextDate(): string {
    const monthIndex = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", 
      "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"].indexOf(month)
    
    if (rows.length === 0) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
    }
    
    const lastDate = new Date(rows[rows.length - 1].tarih)
    lastDate.setDate(lastDate.getDate() + 1)
    return lastDate.toISOString().split("T")[0]
  }

  function addRow() {
    const nextDate = getNextDate()

    const vardiyalarToAdd = isAdmin ? ["S", "A"] : [userVardiya || "S"]

    const newRowsToAdd: GelirRow[] = vardiyalarToAdd.map((vardiya) => ({
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
    }))

    const newRows = [...rows, ...newRowsToAdd].sort((a, b) => {
      const dateCompare = a.tarih.localeCompare(b.tarih)
      if (dateCompare !== 0) return dateCompare
      return a.vardiya.localeCompare(b.vardiya)
    })

    setRows(newRows)
  }

  function deleteRow(index: number) {
    const rowToDelete = rows[index]

    if (rowToDelete?.id) {
      setDeletedRows(prev => [...prev, rowToDelete])
    }

    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
  }

  function updateCell(rowIndex: number, column: string, value: string | number) {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    
    if (column === "durum") {
      row.durum = value as string
    } else if (column !== "tarih" && column !== "toplam" && column !== "kalan") {
      (row as any)[column] = Number(value) || 0
    }
    
    // Toplam hesapla (şirketlerden gelen + kasa gelen)
    row.toplam = row.pamukkale_turizm + row.anadolu_ulasim + row.inegol_seyahat +
      row.alasehir_turizm + row.unlu_1 + row.unlu_2 + row.pamukkale_kargo +
      row.diger_komisyon + row.kasa_gelen
    
    // Kalan = Toplam - Giderler
    row.kalan = row.toplam - row.giderler
    
    newRows[rowIndex] = row
    setRows(newRows)
  }

  async function saveData() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return
    }

    // Sadece düzenleyebildiğim vardiyaları filtrele
    // userVardiya null ise hepsini, değilse sadece kendi vardiyamı kaydedebilirim
    const editableRows = rows.filter(row => {
      // Admin veya vardiyası olmayan kullanıcı her şeyi kaydedebilir
      if (!userVardiya || isAdmin) return true
      // Sadece kendi vardiyamı kaydedebilirim
      return row.vardiya === userVardiya
    })

    // Çöp kutusuyla silinen kayıtları veritabanından sil
    const deletedEditableRows = deletedRows.filter(row => {
      if (!userVardiya || isAdmin) return true
      return row.vardiya === userVardiya
    })

    for (const row of deletedEditableRows) {
      const { error: deleteError } = await supabase
        .from("gelir_kayitlari")
        .delete()
        .eq("id", row.id)

      if (deleteError) {
        console.log("Gelir silme hatası:", deleteError)
        alert("Gelir silinemedi: " + deleteError.message)
        setSaving(false)
        return
      }
    }

    // Yeni kayıtları ekle
    if (editableRows.length > 0) {
      const insertData = editableRows.map(row => ({
        user_id: row.user_id || user.id,
        sube_id: currentSube.id,
        ay_yil: ayYil,
        tarih: row.tarih,
        vardiya: row.vardiya,
        pamukkale_turizm: aktifGelirKolonlari.includes("pamukkale_turizm") ? row.pamukkale_turizm : 0,
        anadolu_ulasim: aktifGelirKolonlari.includes("anadolu_ulasim") ? row.anadolu_ulasim : 0,
        inegol_seyahat: aktifGelirKolonlari.includes("inegol_seyahat") ? row.inegol_seyahat : 0,
        alasehir_turizm: aktifGelirKolonlari.includes("alasehir_turizm") ? row.alasehir_turizm : 0,
        unlu_1: aktifGelirKolonlari.includes("unlu_1") ? row.unlu_1 : 0,
        unlu_2: aktifGelirKolonlari.includes("unlu_2") ? row.unlu_2 : 0,
        pamukkale_kargo: aktifGelirKolonlari.includes("pamukkale_kargo") ? row.pamukkale_kargo : 0,
        diger_komisyon: aktifGelirKolonlari.includes("diger_komisyon") ? row.diger_komisyon : 0,
        kasa_gelen: aktifGelirKolonlari.includes("kasa_gelen") ? row.kasa_gelen : 0,
        toplam: row.toplam,
        giderler: row.giderler,
        kalan: row.kalan,
        durum: row.durum,
      }))

      const { error } = await supabase
        .from("gelir_kayitlari")
        .upsert(insertData, {
          onConflict: "sube_id,ay_yil,tarih,vardiya",
        })

      if (error) {
        console.log("Gelir kaydetme hatası:", error)
        alert("Gelir kaydedilemedi: " + error.message)
        setSaving(false)
        return
      }
    }

    setDeletedRows([])
    setActiveColumnKeys(null)
    markClean()
    setSaving(false)
    loadData()
  }

  useEffect(() => {
    registerSaveHandler(saveData)

    return () => {
      registerSaveHandler(null)
    }
  })

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Sütun toplamları
  const columnTotals = visibleColumns.reduce((acc, col) => {
    if (col !== "tarih" && col !== "durum" && col !== "vardiya") {
      acc[col] = rows.reduce((sum, row) => sum + ((row as any)[col] || 0), 0)
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
                  className={`p-2 border font-semibold whitespace-nowrap ${HEADER_COLORS[col]} ${col === "durum" ? "text-orange-800" : "text-white"}`}
                >
                  {HEADER_LABELS[col]}
                </th>
              ))}
              <th className="p-2 border bg-gray-100 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Vardiya kontrolü: userVardiya null ise hepsini düzenleyebilir, değilse sadece kendi vardiyasını
              const canEditVardiya = !userVardiya || userVardiya === row.vardiya || isAdmin
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
                        {formatNumber((row as any)[col])} ₺
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
                        value={(row as any)[col] || ""}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        className="w-full px-2 py-1 text-right focus:outline-none focus:bg-blue-50"
                        placeholder="0,00"
                      />
                    ) : (
                      <div className="px-2 py-1 text-right text-gray-600">
                        {formatNumber((row as any)[col] || 0)} ₺
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
