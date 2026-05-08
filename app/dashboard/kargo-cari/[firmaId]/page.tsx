"use client"

import { useState, useEffect, use } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Save, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"

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
}

const months = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
]
const years = [2026, 2027, 2028, 2029, 2030]
const currentDate = new Date()

const HEADER_COLORS: Record<string, string> = {
  tarih: "bg-green-600 text-white",
  fis_no: "bg-gray-100 text-gray-800",
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

export default function KargoCariPage({ params }: { params: Promise<{ firmaId: string }> }) {
  const resolvedParams = use(params)
  const [firma, setFirma] = useState<KargoFirma | null>(null)
  const [rows, setRows] = useState<KargoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [month, setMonth] = useState(months[currentDate.getMonth()])
  const [year, setYear] = useState(currentDate.getFullYear())
  const supabase = createClient()
  const { currentSube } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()

  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) {
      fetchFirma()
    }
  }, [resolvedParams.firmaId, currentSube?.id])

  useEffect(() => {
    if (firma) {
      loadData()

      // Realtime subscription
      const channel = supabase
        .channel(`kargo_cari_changes_${currentSube?.id || 'none'}_${firma.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'kargo_cari_kayitlar',
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
  }, [rows, firma?.id, currentSube?.id, month, year])

  async function fetchFirma() {
    if (!currentSube) {
      setLoading(false)
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad")
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

  async function loadData() {
    if (!firma) return false
    
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("kargo_cari_kayitlar")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("firma_id", firma.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })

    if (!error && data) {
      setRows(data.map(row => ({
        id: row.id,
        tarih: row.tarih,
        fis_no: row.fis_no || "",
        gonderilen_yer: row.gonderilen_yer || "",
        alinan_tutar: Number(row.alinan_tutar) || 0,
        satilan_tutar: Number(row.satilan_tutar) || 0,
        kalan_kar: Number(row.kalan_kar) || 0,
      })))
    }
    setLoading(false)
  }

  function getKargoBusinessDate(): string {
    const now = new Date()
    const businessDate = new Date(now)

    if (now.getHours() < 4) {
      businessDate.setDate(businessDate.getDate() - 1)
    }

    const businessMonth = businessDate.getMonth()
    const selectedMonth = months.indexOf(month)

    if (businessDate.getFullYear() !== year || businessMonth !== selectedMonth) {
      return `${year}-${String(selectedMonth + 1).padStart(2, "0")}-01`
    }

    const day = String(businessDate.getDate()).padStart(2, "0")
    return `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${day}`
  }

  function addRow() {
    const newRow: KargoRow = {
      tarih: getKargoBusinessDate(),
      fis_no: "",
      gonderilen_yer: "",
      alinan_tutar: 0,
      satilan_tutar: 0,
      kalan_kar: 0,
    }
    setRows([...rows, newRow])
  }

  function deleteRow(index: number) {
    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
    markDirty()
  }

  // Fiş No'yu 6 haneli formata çevir
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

    if (column === "fis_no") {
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
  }

  async function saveData() {
    if (!firma) return
    
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return false
    }

    // Önce bu şube + firma + ay/yıl için tüm kayıtları sil
    const { error: deleteError } = await supabase
      .from("kargo_cari_kayitlar")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("firma_id", firma.id)
      .eq("ay_yil", ayYil)

    if (deleteError) {
      console.log("Kargo cari silme hatası:", deleteError)
      alert("Kargo cari silinemedi: " + deleteError.message)
      setSaving(false)
      return false
    }

    // Yeni kayıtları ekle
    if (rows.length > 0) {
      const insertData = rows.map(row => ({
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
        alert("Kargo cari kaydedilemedi: " + insertError.message)
        setSaving(false)
        return false
      }
    }

    setSaving(false)
    markClean()
    loadData()
    return true
  }

  const prevMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 0) {
      if (year > 2026) {
        setMonth(months[11])
        setYear(year - 1)
      }
    } else {
      if (year === 2026 && currentIndex <= 3) return
      setMonth(months[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = months.indexOf(month)
    if (currentIndex === 11) {
      if (year < 2030) {
        setMonth(months[0])
        setYear(year + 1)
      }
    } else {
      setMonth(months[currentIndex + 1])
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Sütun toplamları
  const columnTotals = {
    alinan_tutar: rows.reduce((sum, row) => sum + row.alinan_tutar, 0),
    satilan_tutar: rows.reduce((sum, row) => sum + row.satilan_tutar, 0),
    kalan_kar: rows.reduce((sum, row) => sum + row.kalan_kar, 0),
  }

  if (loading && !firma) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  if (!firma) {
    return <div className="flex items-center justify-center h-64">Firma bulunamadı</div>
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{firma.ad}</h1>
          <p className="text-muted-foreground mt-1">Kargo Cari Takip</p>
        </div>

        {/* Ay/Yil Secimi */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
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
      <div className="flex items-center gap-2">
        <Button onClick={addRow} size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-1" /> Satır Ekle
        </Button>
        <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 border bg-gray-100 w-10">#</th>
              {COLUMNS.map(col => (
                <th 
                  key={col} 
                  className={`p-2 border font-semibold whitespace-nowrap ${HEADER_COLORS[col]}`}
                >
                  {HEADER_LABELS[col]}
                </th>
              ))}
              <th className="p-2 border bg-gray-100 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="p-8 text-center text-gray-500">
                  Yükleniyor...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="p-8 text-center text-gray-500">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                // Kalan kar pozitifse (alinan > satilan) yeşil arka plan
                const isProfit = row.kalan_kar > 0
                return (
                <tr key={rowIndex} className={`${isProfit ? "bg-green-50" : "hover:bg-gray-50"}`}>
                  <td className="p-1 border text-center text-gray-500">{rowIndex + 1}</td>
                  {COLUMNS.map(col => (
                    <td key={col} className="p-0 border">
                      {col === "tarih" ? (
                        <div className="px-2 py-1 bg-gray-100 text-center font-medium">
                          {formatDate(row.tarih)}
                        </div>
                      ) : col === "kalan_kar" ? (
                        <div className={`px-2 py-1 text-right font-semibold ${
                          row.kalan_kar >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}>
                          {formatNumber(row.kalan_kar)} ₺
                        </div>
                      ) : col === "fis_no" ? (
                        <input
                        type="text"
                        value={row.fis_no || ""}
                        onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                        onBlur={(e) => {
                          const val = e.target.value
                          if (!val) return
                          const padded = val.padStart(6, "0")
                          updateCell(rowIndex, col, padded)
                        }}
                        className="w-full px-2 py-1 text-center font-mono focus:outline-none focus:bg-blue-50"
                        placeholder="000000"
                        maxLength={6}
                        />
                      ) : col === "gonderilen_yer" ? (
                        <input
                          type="text"
                          value={row.gonderilen_yer || ""}
                          onChange={(e) => {
                            const onlyLetters = e.target.value
                              .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ\s]/g, "") // sadece harf + boşluk
                              .toUpperCase()
                            updateCell(rowIndex, col, onlyLetters)
                          }}
                          className="w-full px-2 py-1 text-left focus:outline-none focus:bg-blue-50"
                          placeholder="Gönderilen yer"
                        />
                      ) : (
                        <input
                          type="number"
                          value={(row as any)[col] || ""}
                          onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                          className="w-full px-2 py-1 text-right focus:outline-none focus:bg-blue-50"
                          placeholder="0,00"
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-1 border">
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
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
              <tr className="bg-gray-100 font-semibold">
                <td className="p-2 border"></td>
                <td className="p-2 border text-center">TOPLAM</td>
                <td className="p-2 border"></td>
                <td className="p-2 border"></td>
                <td className="p-2 border text-right">{formatNumber(columnTotals.alinan_tutar)} ₺</td>
                <td className="p-2 border text-right">{formatNumber(columnTotals.satilan_tutar)} ₺</td>
                <td className={`p-2 border text-right font-bold ${columnTotals.kalan_kar >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatNumber(columnTotals.kalan_kar)} ₺
                </td>
                <td className="p-2 border"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
