"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Save, Trash2, ChevronLeft, ChevronRight, Soup } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getInitialMonth,
  getInitialYear,
  getLocalDateString,
  getMonthYearFromDate,
  makeYearWindow,
} from "@/lib/date-navigation"
import { logSecurityEvent } from "@/lib/audit-log"

interface Personel {
  id: string
  ad: string
  aktif: boolean
}

interface CorbaRow {
  id?: string
  tarih: string
  personel_values: Record<string, number>
}

export default function CorbalarPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [rows, setRows] = useState<CorbaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { currentSube, isAdmin } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)
  
  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) loadData()

    // Realtime subscription
    const channel = supabase
      .channel('corbalar_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corbalar',
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [month, year, currentSube?.id])

  useEffect(() => {
    registerSaveHandler(saveData)
    return () => registerSaveHandler(null)
  }, [rows, personeller, currentSube?.id, ayYil, registerSaveHandler])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    // Personelleri cek
    const { data: personelData } = await supabase
      .from("personeller")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })
    
    if (personelData) setPersoneller(personelData)

    // Çorba kayıtlarını çek
    const { data: corbaData } = await supabase
      .from("corbalar")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })

    if (corbaData && personelData) {
      // Tarihe gore grupla
      const rowMap = new Map<string, CorbaRow>()
      
      corbaData.forEach(corba => {
        const tarih = corba.tarih
        if (!rowMap.has(tarih)) {
          rowMap.set(tarih, { tarih, personel_values: {} })
        }
        const row = rowMap.get(tarih)!
        row.personel_values[corba.personel_id] = Number(corba.miktar) || 0
      })

      setRows(Array.from(rowMap.values()).sort((a, b) => a.tarih.localeCompare(b.tarih)))
    }
    setLoading(false)
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

  function getNextDate(): string {
    const monthIndex = MONTHS.indexOf(month)
    if (rows.length === 0) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
    }
    const lastDate = new Date(rows[rows.length - 1].tarih)
    lastDate.setDate(lastDate.getDate() + 1)
    return lastDate.toISOString().split("T")[0]
  }

  function addRow() {
    if (!isAdmin) {
      const today = getLocalDateString()
      const todayMonthYear = getMonthYearFromDate(today)

      if (month !== todayMonthYear.month || year !== todayMonthYear.year) {
        toast.error("Normal kullanıcılar sadece bugünün olduğu ayda satır ekleyebilir.")
        return
      }

      if (rows.some(row => row.tarih === today)) {
        toast.error("Bugün için zaten bir satır var.")
        return
      }

      setRows([...rows, { tarih: today, personel_values: {} }].sort((a, b) => a.tarih.localeCompare(b.tarih)))
      markDirty()
      return
    }

    const newRow: CorbaRow = {
      tarih: getNextDate(),
      personel_values: {},
    }
    setRows([...rows, newRow])
    markDirty()
  }

  function deleteRow(index: number) {
    const newRows = [...rows]
    const deletedRow = newRows[index]
    newRows.splice(index, 1)
    setRows(newRows)
    markDirty()
    logSecurityEvent("row_delete", {
      table: "corbalar",
      sube_id: currentSube?.id,
      tarih: deletedRow?.tarih,
    })
  }

  function updateCell(rowIndex: number, personelId: string, value: number) {
    const newRows = [...rows]
    newRows[rowIndex].personel_values[personelId] = value
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

    // Bu ay için tüm çorba kayıtlarını sil
    const editableRows = isAdmin ? rows : rows.filter(row => row.tarih === getLocalDateString())

    let deleteQuery = supabase
      .from("corbalar")
      .delete()
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    if (!isAdmin) {
      deleteQuery = deleteQuery.eq("user_id", user.id).eq("tarih", getLocalDateString())
    }

    const { error: deleteError } = await deleteQuery

    if (deleteError) {
      console.log("Çorba silme hatası:", deleteError)
      setSaving(false)
      return false
    }

    // Yeni kayıtları ekle
    const insertData: any[] = []
    editableRows.forEach(row => {
      personeller.forEach(personel => {
        const miktar = row.personel_values[personel.id] || 0
        if (miktar > 0) {
          insertData.push({
            user_id: user.id,
            sube_id: currentSube.id,
            ay_yil: ayYil,
            tarih: row.tarih,
            personel_id: personel.id,
            miktar: miktar,
          })
        }
      })
    })

    if (insertData.length > 0) {
      const { error: insertError } = await supabase.from("corbalar").insert(insertData)
      if (insertError) {
        console.log("Çorba kaydetme hatası:", insertError)
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

  // Personel bazinda toplamlar
  const personelTotals = personeller.reduce((acc, personel) => {
    acc[personel.id] = rows.reduce((sum, row) => sum + (row.personel_values[personel.id] || 0), 0)
    return acc
  }, {} as Record<string, number>)

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-orange-600 text-white">
        <div className="flex items-center gap-3">
          <Soup className="h-6 w-6" />
          <h1 className="text-xl font-bold">Çorbalar</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-orange-700">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-28 bg-orange-700 border-orange-500 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-20 bg-orange-700 border-orange-500 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-orange-700">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {personeller.length === 0 ? (
          <Card className="max-w-md mx-auto mt-8">
            <CardContent className="p-6 text-center">
              <Soup className="h-12 w-12 mx-auto mb-4 text-orange-400" />
              <h3 className="font-semibold mb-2">Personel Bulunamadı</h3>
              <p className="text-gray-500 text-sm">
                Çorba girişi yapabilmek için önce Ayarlar sayfasından personel eklemeniz gerekiyor.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Personel Toplam Kartlari */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
              {personeller.map(personel => (
                <Card key={personel.id} className="bg-amber-50 border-amber-200 shadow-sm">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-orange-600 uppercase truncate">{personel.ad}</p>
                    <p className="text-xl font-bold text-orange-600 mt-1">{formatNumber(personelTotals[personel.id] || 0)} TL</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Butonlar */}
            <div className="flex items-center gap-2 mb-4">
              <Button onClick={addRow} size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-1" /> Satır Ekle
              </Button>
              <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>

            {/* Tablo */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="p-2 border bg-gray-100 w-10">#</th>
                    <th className="p-2 border bg-green-600 text-white font-semibold">TARİH</th>
                    {personeller.map(personel => (
                      <th key={personel.id} className="p-2 border bg-blue-600 text-white font-semibold whitespace-nowrap">
                        {personel.ad}
                      </th>
                    ))}
                    <th className="p-2 border bg-gray-100 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const canEditRow = isAdmin || row.tarih === getLocalDateString()
                    return (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      <td className="p-1 border text-center text-gray-500">{rowIndex + 1}</td>
                      <td className="p-0 border">
                        <div className="px-2 py-1 bg-gray-100 text-center font-medium">
                          {formatDate(row.tarih)}
                        </div>
                      </td>
                      {personeller.map(personel => (
                        <td key={personel.id} className="p-0 border">
                          <input
                            type="number"
                            value={row.personel_values[personel.id] || ""}
                            onChange={(e) => updateCell(rowIndex, personel.id, Number(e.target.value) || 0)}
                            disabled={!canEditRow}
                            className="w-full px-2 py-1 text-right focus:outline-none focus:bg-blue-50"
                            placeholder="0,00"
                          />
                        </td>
                      ))}
                      <td className="p-1 border">
                        {canEditRow && (
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
                      <td colSpan={personeller.length + 3} className="p-8 text-center text-gray-500">
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
                      {personeller.map(personel => (
                        <td key={personel.id} className="p-2 border text-right">
                          {formatNumber(personelTotals[personel.id] || 0)} TL
                        </td>
                      ))}
                      <td className="p-2 border"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
