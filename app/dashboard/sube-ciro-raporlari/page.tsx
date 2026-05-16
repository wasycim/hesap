"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, Filter, TrendingUp } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { getLocalDateString } from "@/lib/date-navigation"

interface Firma {
  id: string
  sube_id: string
  ad: string
  komisyon_orani: number | null
  color: string
}

interface GelirKaydi {
  sube_id: string
  tarih: string
  vardiya: string | null
  custom_values: Record<string, number>
}

type Period = "daily" | "weekly" | "monthly" | "custom"

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function getMonthStart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function getShiftLabel(value: string | null) {
  if (value === "S") return "Sabah"
  if (value === "A") return "Aksam"
  return "Tek vardiya"
}

export default function SubeCiroRaporlariPage() {
  const supabase = createClient()
  const { subeler, isAdmin, loading: subeLoading } = useSube()
  const today = getLocalDateString()
  const [period, setPeriod] = useState<Period>("monthly")
  const [startDate, setStartDate] = useState(getMonthStart(new Date()))
  const [endDate, setEndDate] = useState(today)
  const [selectedSubeId, setSelectedSubeId] = useState("all")
  const [selectedFirmaId, setSelectedFirmaId] = useState("all")
  const [firmalar, setFirmalar] = useState<Firma[]>([])
  const [rows, setRows] = useState<GelirKaydi[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    if (period === "daily") {
      setStartDate(today)
      setEndDate(today)
    } else if (period === "weekly") {
      const start = new Date()
      start.setDate(start.getDate() - 6)
      setStartDate(getLocalDateString(start))
      setEndDate(today)
    } else if (period === "monthly") {
      setStartDate(getMonthStart(now))
      setEndDate(today)
    }
  }, [period, today])

  useEffect(() => {
    if (!subeLoading && isAdmin) loadData()
  }, [subeLoading, isAdmin, selectedSubeId, startDate, endDate])

  async function loadData() {
    setLoading(true)

    let firmaQuery = supabase
      .from("gelir_firmalar")
      .select("id, sube_id, ad, komisyon_orani, color")
      .eq("aktif", true)
      .order("sira", { ascending: true })

    let gelirQuery = supabase
      .from("gelir_kayitlari")
      .select("sube_id, tarih, vardiya, custom_values")
      .gte("tarih", startDate)
      .lte("tarih", endDate)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true })

    if (selectedSubeId !== "all") {
      firmaQuery = firmaQuery.eq("sube_id", selectedSubeId)
      gelirQuery = gelirQuery.eq("sube_id", selectedSubeId)
    }

    const [firmaRes, gelirRes] = await Promise.all([firmaQuery, gelirQuery])
    setFirmalar(firmaRes.data || [])
    setRows((gelirRes.data || []).map(row => ({
      ...row,
      custom_values: row.custom_values || {},
    })))
    setLoading(false)
  }

  const firmaMap = useMemo(() => new Map(firmalar.map(firma => [firma.id, firma])), [firmalar])
  const filteredFirmalar = useMemo(() => (
    selectedFirmaId === "all" ? firmalar : firmalar.filter(firma => firma.id === selectedFirmaId)
  ), [firmalar, selectedFirmaId])

  const reportRows = useMemo(() => {
    return rows.flatMap(row => filteredFirmalar.map(firma => {
      const satis = Number(row.custom_values?.[`firma_${firma.id}`]) || 0
      const oran = Number(firma.komisyon_orani) || 0
      return {
        sube_id: row.sube_id,
        firma_id: firma.id,
        tarih: row.tarih,
        vardiya: row.vardiya,
        satis,
        komisyon: satis * oran / 100,
      }
    }).filter(item => item.satis > 0))
  }, [rows, filteredFirmalar])

  const totals = useMemo(() => reportRows.reduce((acc, row) => ({
    satis: acc.satis + row.satis,
    komisyon: acc.komisyon + row.komisyon,
  }), { satis: 0, komisyon: 0 }), [reportRows])

  const subeSummaries = useMemo(() => subeler
    .filter(sube => selectedSubeId === "all" || sube.id === selectedSubeId)
    .map(sube => {
      const subeRows = reportRows.filter(row => row.sube_id === sube.id)
      return {
        sube,
        satis: subeRows.reduce((sum, row) => sum + row.satis, 0),
        komisyon: subeRows.reduce((sum, row) => sum + row.komisyon, 0),
      }
    })
    .filter(item => item.satis > 0 || selectedSubeId !== "all"), [reportRows, selectedSubeId, subeler])

  const firmaSummaries = useMemo(() => filteredFirmalar.map(firma => {
    const firmaRows = reportRows.filter(row => row.firma_id === firma.id)
    return {
      firma,
      satis: firmaRows.reduce((sum, row) => sum + row.satis, 0),
      komisyon: firmaRows.reduce((sum, row) => sum + row.komisyon, 0),
    }
  }).filter(item => item.satis > 0 || selectedFirmaId !== "all"), [filteredFirmalar, reportRows, selectedFirmaId])

  const detailRows = useMemo(() => reportRows.map(row => ({
    ...row,
    subeAd: subeler.find(sube => sube.id === row.sube_id)?.ad || "-",
    firma: firmaMap.get(row.firma_id),
  })), [reportRows, subeler, firmaMap])

  if (subeLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yukleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Erisim engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yoneticiler erisebilir.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yukleniyor...</div>
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
            Sube Ciro Raporlari
          </h1>
          <p className="text-sm text-muted-foreground">Firma satislari, komisyonlar, sube ve vardiya detaylari.</p>
        </div>
        <Button onClick={loadData} className="gap-2">
          <Filter className="h-4 w-4" />
          Raporu Yenile
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Gunluk</SelectItem>
              <SelectItem value="weekly">Haftalik</SelectItem>
              <SelectItem value="monthly">Aylik</SelectItem>
              <SelectItem value="custom">Tarih Sec</SelectItem>
            </SelectContent>
          </Select>
          <input type="date" value={startDate} onChange={(event) => { setPeriod("custom"); setStartDate(event.target.value) }} className="h-10 rounded-md border bg-background px-3 text-sm" />
          <input type="date" value={endDate} onChange={(event) => { setPeriod("custom"); setEndDate(event.target.value) }} className="h-10 rounded-md border bg-background px-3 text-sm" />
          <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum subeler</SelectItem>
              {subeler.map(sube => <SelectItem key={sube.id} value={sube.id}>{sube.ad}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedFirmaId} onValueChange={setSelectedFirmaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tum firmalar</SelectItem>
              {firmalar.map(firma => <SelectItem key={firma.id} value={firma.id}>{firma.ad}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Toplam Satis</p>
            <p className="mt-2 text-2xl font-bold">{formatMoney(totals.satis)} TL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Toplam Komisyon</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(totals.komisyon)} TL</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Rapor Araligi</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-5 w-5" />
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sube Ozetleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subeSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralikta satis yok.</p>
            ) : subeSummaries.map(item => (
              <div key={item.sube.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{item.sube.ad}</p>
                  <p className="text-xs text-muted-foreground">Satis {formatMoney(item.satis)} TL</p>
                </div>
                <p className="font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(item.komisyon)} TL</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Firma Ozetleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {firmaSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralikta firma satisi yok.</p>
            ) : firmaSummaries.map(item => (
              <button key={item.firma.id} onClick={() => setSelectedFirmaId(item.firma.id)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${item.firma.color}`} />
                  <div>
                    <p className="font-semibold">{item.firma.ad}</p>
                    <p className="text-xs text-muted-foreground">Satis {formatMoney(item.satis)} TL - Oran {item.firma.komisyon_orani ?? 0}%</p>
                  </div>
                </div>
                <p className="font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(item.komisyon)} TL</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gunluk ve Vardiya Detayi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mobile-scroll visible-x-scroll overflow-x-auto rounded-lg border">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Tarih</th>
                  <th className="p-3 text-left">Sube</th>
                  <th className="p-3 text-left">Vardiya</th>
                  <th className="p-3 text-left">Firma</th>
                  <th className="p-3 text-right">Satis</th>
                  <th className="p-3 text-right">Oran</th>
                  <th className="p-3 text-right">Komisyon</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Detay bulunamadi.</td></tr>
                ) : detailRows.map((row, index) => (
                  <tr key={`${row.firma_id}-${row.tarih}-${row.vardiya}-${index}`} className="border-t">
                    <td className="p-3">{formatDate(row.tarih)}</td>
                    <td className="p-3">{row.subeAd}</td>
                    <td className="p-3">{getShiftLabel(row.vardiya)}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className={`h-2.5 w-2.5 rounded-full ${row.firma?.color || "bg-gray-500"}`} />
                        {row.firma?.ad || "-"}
                      </span>
                    </td>
                    <td className="p-3 text-right">{formatMoney(row.satis)} TL</td>
                    <td className="p-3 text-right">{row.firma?.komisyon_orani ?? 0}%</td>
                    <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(row.komisyon)} TL</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
