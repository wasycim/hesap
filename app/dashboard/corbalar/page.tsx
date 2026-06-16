"use client"

import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Plus, Save, Trash2, ChevronLeft, ChevronRight, Soup } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getInitialMonth,
  getInitialYear,
  getLastMissingDateWithinMonth,
  getMonthYearFromDate,
  compareDateDescending,
  isDateInSelectedMonth,
  makeYearWindow,
} from "@/lib/date-navigation"
import { logSecurityEvent } from "@/lib/audit-log"
import { openPdfReport } from "@/lib/pdf-report"
import { getCorbaBusinessDate } from "@/lib/corba-business-date"

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

function corbaCellKey(tarih: string, personelId: string) {
  return `${tarih}__${personelId}`
}

function parseCorbaCellKey(key: string) {
  const [tarih, personelId] = key.split("__")
  return { tarih, personelId }
}

export default function CorbalarPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [rows, setRows] = useState<CorbaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [dirtyCellKeys, setDirtyCellKeys] = useState<Set<string>>(() => new Set())
  const [deletedRowDates, setDeletedRowDates] = useState<Set<string>>(() => new Set())
  const [createdRowDates, setCreatedRowDates] = useState<Set<string>>(() => new Set())
  const dirtyCellKeysRef = useRef(dirtyCellKeys)
  const deletedRowDatesRef = useRef(deletedRowDates)
  const createdRowDatesRef = useRef(createdRowDates)
  const supabase = createClient()
  const { currentSube, isAdmin, userVardiya } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)
  
  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) loadData()

    if (!currentSube) return

    const channel = supabase
      .channel(`corbalar_changes_${currentSube.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'corbalar',
          filter: `sube_id=eq.${currentSube.id}`,
        },
        () => {
          if (
            dirtyCellKeysRef.current.size > 0 ||
            deletedRowDatesRef.current.size > 0 ||
            createdRowDatesRef.current.size > 0
          ) {
            return
          }
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
  }, [rows, personeller, currentSube?.id, ayYil, userVardiya, isAdmin, dirtyCellKeys, deletedRowDates, createdRowDates, registerSaveHandler])

  useEffect(() => {
    dirtyCellKeysRef.current = dirtyCellKeys
  }, [dirtyCellKeys])

  useEffect(() => {
    deletedRowDatesRef.current = deletedRowDates
  }, [deletedRowDates])

  useEffect(() => {
    createdRowDatesRef.current = createdRowDates
  }, [createdRowDates])

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

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
      .order("tarih", { ascending: false })

    if (corbaData && personelData) {
      // Tarihe gore grupla
      const rowMap = new Map<string, CorbaRow>()
      
      corbaData.filter(corba => isDateInSelectedMonth(corba.tarih, month, year)).forEach(corba => {
        const tarih = corba.tarih
        if (!rowMap.has(tarih)) {
          rowMap.set(tarih, { tarih, personel_values: {} })
        }
        const row = rowMap.get(tarih)!
        row.personel_values[corba.personel_id] = Number(corba.miktar) || 0
      })

      setRows(Array.from(rowMap.values()).sort(compareDateDescending))
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
    return getLastMissingDateWithinMonth(rows.map(row => row.tarih), month, year) || ""
  }

  function addRow() {
    if (!isAdmin) {
      const editableDate = getCorbaBusinessDate(userVardiya)
      const editableMonthYear = getMonthYearFromDate(editableDate)

      if (month !== editableMonthYear.month || year !== editableMonthYear.year) {
        toast.error("Normal kullanıcılar sadece aktif çorba iş gününün olduğu ayda satır ekleyebilir.")
        return
      }

      if (rows.some(row => row.tarih === editableDate)) {
        toast.error("Aktif çorba iş günü için zaten bir satır var.")
        return
      }

      setRows([...rows, { tarih: editableDate, personel_values: {} }].sort(compareDateDescending))
      setCreatedRowDates(current => new Set(current).add(editableDate))
      markDirty()
      return
    }

    const nextDate = getNextDate()
    if (!nextDate || !isDateInSelectedMonth(nextDate, month, year)) {
      toast.error(`${month} ${year} ayı için eklenecek yeni gün kalmadı.`)
      return
    }

    const newRow: CorbaRow = {
      tarih: nextDate,
      personel_values: {},
    }
    setRows([...rows, newRow].sort(compareDateDescending))
    markDirty()
  }

  function deleteRow(index: number) {
    const newRows = [...rows]
    const deletedRow = newRows[index]
    newRows.splice(index, 1)
    setRows(newRows)
    if (deletedRow?.tarih) {
      setDeletedRowDates(current => new Set(current).add(deletedRow.tarih))
      setCreatedRowDates(current => {
        const next = new Set(current)
        next.delete(deletedRow.tarih)
        return next
      })
      setDirtyCellKeys(current => {
        const next = new Set(current)
        current.forEach(key => {
          if (parseCorbaCellKey(key).tarih === deletedRow.tarih) next.delete(key)
        })
        return next
      })
    }
    markDirty()
    logSecurityEvent("row_delete", {
      table: "corbalar",
      sube_id: currentSube?.id,
      tarih: deletedRow?.tarih,
    })
  }

  function updateCell(rowIndex: number, personelId: string, value: number) {
    const newRows = [...rows]
    const row = {
      ...newRows[rowIndex],
      personel_values: {
        ...newRows[rowIndex].personel_values,
        [personelId]: value,
      },
    }
    newRows[rowIndex] = row
    setRows(newRows)
    setDirtyCellKeys(current => new Set(current).add(corbaCellKey(row.tarih, personelId)))
    setDeletedRowDates(current => {
      const next = new Set(current)
      next.delete(row.tarih)
      return next
    })
    markDirty()
  }

  async function saveData() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return false
    }

    const editableDate = getCorbaBusinessDate(userVardiya)
    const editableRows = isAdmin ? rows : rows.filter(row => row.tarih === editableDate)
    const editedPersonelIds = Array.from(dirtyCellKeys)
      .map(parseCorbaCellKey)
      .filter(item => item.tarih === editableDate && item.personelId)
      .map(item => item.personelId)
    const deletedCurrentDate = deletedRowDates.has(editableDate)
    const createdCurrentDate = createdRowDates.has(editableDate)

    if (!isAdmin && !isDateInSelectedMonth(editableDate, month, year)) {
      toast.error("Kaydetmek için aktif çorba iş gününün olduğu ayı seçmelisiniz.")
      setSaving(false)
      return false
    }

    const invalidDateIndex = editableRows.findIndex(row => !isDateInSelectedMonth(row.tarih, month, year))
    if (invalidDateIndex !== -1) {
      toast.error(`${invalidDateIndex + 1}. satır ${month} ${year} dışında olduğu için kaydedilemez.`)
      setSaving(false)
      return false
    }

    if (!isAdmin && !deletedCurrentDate && editedPersonelIds.length === 0 && !createdCurrentDate) {
      setSaving(false)
      markClean()
      toast.success("Kaydedilecek yeni çorba değişikliği yok.")
      return true
    }

    if (isAdmin || deletedCurrentDate || editedPersonelIds.length > 0) {
      let deleteQuery = supabase
        .from("corbalar")
        .delete()
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)

      if (!isAdmin) {
        deleteQuery = deleteQuery.eq("tarih", editableDate)
        if (!deletedCurrentDate) {
          deleteQuery = deleteQuery.in("personel_id", editedPersonelIds)
        }
      }

      const { error: deleteError } = await deleteQuery

      if (deleteError) {
        console.log("Çorba silme hatası:", deleteError)
        setSaving(false)
        return false
      }
    }

    // Yeni kayıtları ekle
    const insertData: any[] = []

    if (isAdmin) {
      editableRows.forEach(row => {
        let hasValue = false
        personeller.forEach(personel => {
          const miktar = row.personel_values[personel.id] || 0
          if (miktar > 0) {
            hasValue = true
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

        if (!hasValue && personeller[0]) {
          insertData.push({
            user_id: user.id,
            sube_id: currentSube.id,
            ay_yil: ayYil,
            tarih: row.tarih,
            personel_id: personeller[0].id,
            miktar: 0,
          })
        }
      })
    } else if (!deletedCurrentDate) {
      const row = editableRows[0]
      editedPersonelIds.forEach(personelId => {
        const miktar = row?.personel_values[personelId] || 0
        if (miktar > 0) {
          insertData.push({
            user_id: user.id,
            sube_id: currentSube.id,
            ay_yil: ayYil,
            tarih: editableDate,
            personel_id: personelId,
            miktar,
          })
        }
      })

      if (insertData.length === 0 && createdCurrentDate && personeller[0]) {
        insertData.push({
          user_id: user.id,
          sube_id: currentSube.id,
          ay_yil: ayYil,
          tarih: editableDate,
          personel_id: personeller[0].id,
          miktar: 0,
        })
      }
    }

    if (insertData.length > 0) {
      const { error: insertError } = await supabase.from("corbalar").insert(insertData)
      if (insertError) {
        console.log("Çorba kaydetme hatası:", insertError)
        setSaving(false)
        return false
      }
    }

    setSaving(false)
    setDirtyCellKeys(new Set())
    setDeletedRowDates(new Set())
    setCreatedRowDates(new Set())
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

  function exportPdf(personelId?: string) {
    const selectedPersonel = personelId ? personeller.find(personel => personel.id === personelId) : null
    const reportPersoneller = selectedPersonel ? [selectedPersonel] : personeller

    openPdfReport({
      title: selectedPersonel ? `${selectedPersonel.ad} Çorba Raporu` : "Çorbalar Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: reportPersoneller.map(personel => ({
        label: personel.ad,
        value: `${formatNumber(personelTotals[personel.id] || 0)} TL`,
      })).slice(0, 4),
      tables: [{
        title: selectedPersonel ? "Kişiye Özel Detay" : "Aylık Çorba Detayı",
        headers: ["Tarih", ...reportPersoneller.map(personel => personel.ad), "Gün Toplamı"],
        firstColumnWidth: "82px",
        rows: [
          ...rows.map(row => {
            const values = reportPersoneller.map(personel => row.personel_values[personel.id] || 0)
            return [
              formatDate(row.tarih),
              ...values.map(value => `${formatNumber(value)} TL`),
              `${formatNumber(values.reduce((sum, value) => sum + value, 0))} TL`,
            ]
          }),
          [
            "TOPLAM",
            ...reportPersoneller.map(personel => `${formatNumber(personelTotals[personel.id] || 0)} TL`),
            `${formatNumber(reportPersoneller.reduce((sum, personel) => sum + (personelTotals[personel.id] || 0), 0))} TL`,
          ],
        ],
      }],
    })
  }

  // Personel bazinda toplamlar
  const personelTotals = personeller.reduce((acc, personel) => {
    acc[personel.id] = rows.reduce((sum, row) => sum + (row.personel_values[personel.id] || 0), 0)
    return acc
  }, {} as Record<string, number>)
  const editableDate = getCorbaBusinessDate(userVardiya, currentTime)

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 bg-orange-600 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Soup className="h-6 w-6" />
          <h1 className="text-xl font-bold">Çorbalar</h1>
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:flex">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-orange-700">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-full min-w-0 bg-orange-700 border-orange-500 text-white sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-full min-w-0 bg-orange-700 border-orange-500 text-white sm:w-20">
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

      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {personeller.length === 0 ? (
          <Card className="max-w-md mx-auto mt-8">
            <CardContent className="p-6 text-center">
              <Soup className="h-12 w-12 mx-auto mb-4 text-orange-400" />
              <h3 className="font-semibold mb-2">Personel Bulunamadı</h3>
              <p className="text-sm text-muted-foreground">
                Çorba girişi yapabilmek için önce Ayarlar sayfasından personel eklemeniz gerekiyor.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Personel Toplam Kartlari */}
            <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
              {personeller.map(personel => (
                <Card key={personel.id} className="border-amber-200 bg-amber-50 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/15">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-orange-600 uppercase truncate">{personel.ad}</p>
                    <p className="text-xl font-bold text-orange-600 mt-1">{formatNumber(personelTotals[personel.id] || 0)} TL</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => exportPdf(personel.id)}
                      className="mt-3 h-8 w-full gap-1 bg-white/70"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Kişi PDF
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Butonlar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button onClick={addRow} size="sm" className="bg-orange-600 hover:bg-orange-700">
                <Plus className="w-4 h-4 mr-1" /> Satır Ekle
              </Button>
              <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
              <Button onClick={() => exportPdf()} size="sm" variant="outline" disabled={rows.length === 0}>
                <FileText className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>

            {/* Tablo */}
            <div className="sticky-table-scroll rounded-lg border bg-card">
              <table className="sticky-table w-full min-w-[760px] text-sm">
                <thead>
                  <tr>
                    <th className="w-10 border bg-muted p-2 text-muted-foreground">#</th>
                    <th className="p-2 border bg-green-600 text-white font-semibold">TARİH</th>
                    {personeller.map(personel => (
                      <th key={personel.id} className="p-2 border bg-blue-600 text-white font-semibold whitespace-nowrap">
                        {personel.ad}
                      </th>
                    ))}
                    <th className="w-10 border bg-muted p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => {
                    const canEditRow = isAdmin || row.tarih === editableDate
                    return (
                    <tr key={rowIndex} className="hover:bg-muted/50">
                      <td className="border p-1 text-center text-muted-foreground">{rowIndex + 1}</td>
                      <td className="p-0 border">
                        <div className="bg-muted px-2 py-1 text-center font-medium text-foreground">
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
                            className="w-full bg-transparent px-2 py-1 text-right text-foreground focus:bg-blue-50 focus:outline-none dark:focus:bg-blue-500/20"
                            placeholder="0,00"
                          />
                        </td>
                      ))}
                      <td className="p-1 border">
                        {canEditRow && (
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
                      <td colSpan={personeller.length + 3} className="p-8 text-center text-muted-foreground">
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
