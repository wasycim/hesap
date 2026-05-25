"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, CalendarDays, ChevronDown, Filter } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { getLocalDateString } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"

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

const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function getMonthStart(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
}

function parseLocalDate(value: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function getShiftLabel(value: string | null) {
  if (value === "S") return "Sabah"
  if (value === "A") return "Akşam"
  return "Tek vardiya"
}

function compareDateVardiya(a: Pick<GelirKaydi, "tarih" | "vardiya">, b: Pick<GelirKaydi, "tarih" | "vardiya">) {
  const dateCompare = a.tarih.localeCompare(b.tarih)
  if (dateCompare !== 0) return dateCompare
  return (VARDIYA_SIRASI[a.vardiya || ""] ?? 99) - (VARDIYA_SIRASI[b.vardiya || ""] ?? 99)
}

function escapeCsvValue(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const selectedDate = parseLocalDate(value)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 min-w-[185px] justify-between gap-3 bg-background px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">
              {label}: {value ? formatDate(value) : "Tarih seç"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            if (date) onChange(getLocalDateString(date))
          }}
          weekStartsOn={1}
          captionLayout="dropdown"
          className="rounded-md border-0"
        />
      </PopoverContent>
    </Popover>
  )
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
    })).sort(compareDateVardiya))
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

  function exportCsv() {
    const lines: unknown[][] = [
      ["Şube Ciro Raporları"],
      ["Rapor Aralığı", `${formatDate(startDate)} - ${formatDate(endDate)}`],
      ["Toplam Satış", `${formatMoney(totals.satis)} TL`],
      ["Toplam Komisyon", `${formatMoney(totals.komisyon)} TL`],
      [],
      ["Şube Özetleri"],
      ["Şube", "Toplam Satış", "Toplam Komisyon"],
      ...subeSummaries.map(item => [item.sube.ad, `${formatMoney(item.satis)} TL`, `${formatMoney(item.komisyon)} TL`]),
      [],
      ["Firma Özetleri"],
      ["Firma", "Toplam Satış", "Toplam Komisyon"],
      ...firmaSummaries.map(item => [item.firma.ad, `${formatMoney(item.satis)} TL`, `${formatMoney(item.komisyon)} TL`]),
      [],
      ["Detaylar"],
      ["Tarih", "Vardiya", "Şube", "Firma", "Toplam Satış", "Komisyon"],
      ...detailRows.map(row => [
        formatDate(row.tarih),
        getShiftLabel(row.vardiya),
        row.subeAd,
        row.firma?.ad || "-",
        `${formatMoney(row.satis)} TL`,
        `${formatMoney(row.komisyon)} TL`,
      ]),
    ]
    const csv = lines
      .map(line => line.map(escapeCsvValue).join(";"))
      .join("\n")
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `sube-ciro-raporu-${startDate}-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    openPdfReport({
      title: "Şube Ciro Raporları",
      subtitle: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Satış", value: `${formatMoney(totals.satis)} TL` },
        { label: "Toplam Komisyon", value: `${formatMoney(totals.komisyon)} TL` },
        { label: "Kayıt Sayısı", value: String(detailRows.length) },
      ],
      tables: [
        {
          title: "Şube Özetleri",
          headers: ["Şube", "Toplam Satış", "Toplam Komisyon"],
          firstColumnWidth: "45%",
          rows: subeSummaries.map(item => [
            item.sube.ad,
            `${formatMoney(item.satis)} TL`,
            `${formatMoney(item.komisyon)} TL`,
          ]),
        },
        {
          title: "Firma Özetleri",
          headers: ["Firma", "Toplam Satış", "Toplam Komisyon"],
          firstColumnWidth: "45%",
          rows: firmaSummaries.map(item => [
            item.firma.ad,
            `${formatMoney(item.satis)} TL`,
            `${formatMoney(item.komisyon)} TL`,
          ]),
        },
        {
          title: "Günlük ve Vardiya Detayı",
          headers: ["Tarih", "Vardiya", "Şube", "Firma", "Satış", "Komisyon"],
          firstColumnWidth: "82px",
          rows: detailRows.map(row => [
            formatDate(row.tarih),
            getShiftLabel(row.vardiya),
            row.subeAd,
            row.firma?.ad || "-",
            `${formatMoney(row.satis)} TL`,
            `${formatMoney(row.komisyon)} TL`,
          ]),
        },
      ],
    })
    return

    const detailHtml = detailRows.map(row => `
      <tr>
        <td>${formatDate(row.tarih)}</td>
        <td>${getShiftLabel(row.vardiya)}</td>
        <td>${row.subeAd}</td>
        <td>${row.firma?.ad || "-"}</td>
        <td class="money">${formatMoney(row.satis)} TL</td>
        <td class="money">${formatMoney(row.komisyon)} TL</td>
      </tr>
    `).join("")
    const subeHtml = subeSummaries.map(item => `
      <tr><td>${item.sube.ad}</td><td class="money">${formatMoney(item.satis)} TL</td><td class="money">${formatMoney(item.komisyon)} TL</td></tr>
    `).join("")
    const firmaHtml = firmaSummaries.map(item => `
      <tr><td>${item.firma.ad}</td><td class="money">${formatMoney(item.satis)} TL</td><td class="money">${formatMoney(item.komisyon)} TL</td></tr>
    `).join("")
    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Şube Ciro Raporları</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; margin: 0; background: #fff; }
            .sheet { width: 100%; }
            .header { display: flex; justify-content: space-between; align-items: center; gap: 18px; border-bottom: 4px solid #0f766e; padding-bottom: 12px; margin-bottom: 14px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .logoWrap { display: grid; place-items: center; width: 54px; height: 54px; border: 1px solid #d1fae5; border-radius: 14px; background: #ecfdf5; }
            .logo { width: 38px; height: 38px; object-fit: contain; }
            h1 { margin: 0; font-size: 23px; line-height: 1.15; color: #0f172a; }
            .muted { color: #64748b; font-size: 11px; margin-top: 4px; }
            .badge { border-radius: 999px; background: #ccfbf1; color: #115e59; padding: 7px 12px; font-size: 11px; font-weight: 700; white-space: nowrap; }
            .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
            .card { border: 1px solid #dbe3ee; border-left: 5px solid #0f766e; border-radius: 10px; padding: 11px 13px; background: #f8fafc; min-height: 68px; }
            .card .label { color: #64748b; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
            .card .value { margin-top: 7px; font-size: 19px; font-weight: 800; color: #0f172a; }
            .section { break-inside: avoid; margin-top: 12px; }
            h2 { margin: 0 0 7px; font-size: 14px; color: #0f172a; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; font-size: 10px; margin-bottom: 10px; border: 1px solid #dbe3ee; border-radius: 8px; overflow: hidden; }
            th { background: #0f172a; color: white; text-align: left; padding: 7px 8px; font-size: 9px; letter-spacing: .03em; text-transform: uppercase; }
            td { border-top: 1px solid #e2e8f0; padding: 7px 8px; vertical-align: middle; overflow-wrap: anywhere; }
            tr:nth-child(even) td { background: #f8fafc; }
            .money { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700; }
            .summaryTable th:first-child, .summaryTable td:first-child { width: 46%; }
            .detailTable th:nth-child(1), .detailTable td:nth-child(1) { width: 12%; }
            .detailTable th:nth-child(2), .detailTable td:nth-child(2) { width: 10%; }
            .detailTable th:nth-child(3), .detailTable td:nth-child(3) { width: 14%; }
            .detailTable th:nth-child(4), .detailTable td:nth-child(4) { width: 26%; }
            .detailTable th:nth-child(5), .detailTable td:nth-child(5) { width: 19%; }
            .detailTable th:nth-child(6), .detailTable td:nth-child(6) { width: 19%; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <main class="sheet">
          <div class="header">
            <div>
              <h1>Şube Ciro Raporları</h1>
              <div class="muted">${formatDate(startDate)} - ${formatDate(endDate)}</div>
            </div>
            <div class="logoWrap"><img class="logo" src="${window.location.origin}/w-logo.svg" /></div>
          </div>
          <div class="cards">
            <div class="card"><div class="label">Toplam Satış</div><div class="value">${formatMoney(totals.satis)} TL</div></div>
            <div class="card"><div class="label">Toplam Komisyon</div><div class="value">${formatMoney(totals.komisyon)} TL</div></div>
            <div class="card"><div class="label">Kayıt Sayısı</div><div class="value">${detailRows.length}</div></div>
          </div>
          <h2>Şube Özetleri</h2>
          <table class="summaryTable"><thead><tr><th>Şube</th><th class="money">Toplam Satış</th><th class="money">Toplam Komisyon</th></tr></thead><tbody>${subeHtml}</tbody></table>
          <h2>Firma Özetleri</h2>
          <table class="summaryTable"><thead><tr><th>Firma</th><th class="money">Toplam Satış</th><th class="money">Toplam Komisyon</th></tr></thead><tbody>${firmaHtml}</tbody></table>
          <h2>Detaylar</h2>
          <table class="detailTable"><thead><tr><th>Tarih</th><th>Vardiya</th><th>Şube</th><th>Firma</th><th class="money">Satış</th><th class="money">Komisyon</th></tr></thead><tbody>${detailHtml}</tbody></table>
          </main>
          <script>window.onload = () => setTimeout(() => window.print(), 250)</script>
        </body>
      </html>
    `
    const printWindow = window.open("", "_blank")
    if (!printWindow) return
    printWindow?.document.open()
    printWindow?.document.write(html)
    printWindow?.document.close()
  }

  if (subeLoading) {
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

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  return (
    <div data-unsaved-ignore="true" className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="h-6 w-6 text-emerald-600" />
            Şube Ciro Raporları
          </h1>
          <p className="text-sm text-muted-foreground">Firma satışları, komisyonlar, şube ve vardiya detayları.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportPdf} variant="outline" className="gap-2" disabled={detailRows.length === 0}>
            PDF
          </Button>
          <Button onClick={loadData} className="gap-2">
            <Filter className="h-4 w-4" />
            Raporu Yenile
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Günlük</SelectItem>
              <SelectItem value="weekly">Haftalık</SelectItem>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="custom">Tarih Seç</SelectItem>
            </SelectContent>
          </Select>
          <DatePickerField
            label="Başlangıç"
            value={startDate}
            onChange={(value) => {
              setPeriod("custom")
              setStartDate(value)
            }}
          />
          <DatePickerField
            label="Bitiş"
            value={endDate}
            onChange={(value) => {
              setPeriod("custom")
              setEndDate(value)
            }}
          />
          <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm şubeler</SelectItem>
              {subeler.map(sube => <SelectItem key={sube.id} value={sube.id}>{sube.ad}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedFirmaId} onValueChange={setSelectedFirmaId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm firmalar</SelectItem>
              {firmalar.map(firma => <SelectItem key={firma.id} value={firma.id}>{firma.ad}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Toplam Satış</p>
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
            <p className="text-sm text-muted-foreground">Rapor Aralığı</p>
            <p className="mt-2 flex items-center gap-2 text-lg font-semibold">
              <CalendarDays className="h-5 w-5" />
              {formatDate(startDate)} - {formatDate(endDate)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Şube Özetleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {subeSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta satış yok.</p>
            ) : subeSummaries.map(item => (
              <div key={item.sube.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-semibold">{item.sube.ad}</p>
                  <p className="text-xs text-muted-foreground">Satış {formatMoney(item.satis)} TL</p>
                </div>
                <p className="font-bold text-emerald-700 dark:text-emerald-200">{formatMoney(item.komisyon)} TL</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Firma Özetleri</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {firmaSummaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Bu aralıkta firma satışı yok.</p>
            ) : firmaSummaries.map(item => (
              <button key={item.firma.id} onClick={() => setSelectedFirmaId(item.firma.id)} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${item.firma.color}`} />
                  <div>
                    <p className="font-semibold">{item.firma.ad}</p>
                    <p className="text-xs text-muted-foreground">Satış {formatMoney(item.satis)} TL - Oran {item.firma.komisyon_orani ?? 0}%</p>
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
          <CardTitle>Günlük ve Vardiya Detayı</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="sticky-table-scroll rounded-lg border">
            <table className="sticky-table min-w-[860px] w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left">Tarih</th>
                  <th className="p-3 text-left">Şube</th>
                  <th className="p-3 text-left">Vardiya</th>
                  <th className="p-3 text-left">Firma</th>
                  <th className="p-3 text-right">Satış</th>
                  <th className="p-3 text-right">Oran</th>
                  <th className="p-3 text-right">Komisyon</th>
                </tr>
              </thead>
              <tbody>
                {detailRows.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Detay bulunamadı.</td></tr>
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
