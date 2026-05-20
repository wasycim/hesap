"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, FileText, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import { MONTHS, START_MONTH_INDEX, START_YEAR, getInitialMonth, getInitialYear, makeYearWindow } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"

interface Personel {
  id: string
  ad: string
  aylik_maas?: number
  saatlik_mesai_ucreti?: number
}

interface Ortak {
  id: string
  ad: string
}

interface GiderRow {
  tarih: string
  personel_paylari?: Record<string, number>
  personel_mesai_detaylari?: Record<string, number>
  ortak_pilarim?: Record<string, number>
}

type Detail = { tarih: string; amount: number; description: string }

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export default function MaaslarPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [rows, setRows] = useState<GiderRow[]>([])
  const [selectedPersonelId, setSelectedPersonelId] = useState<string | null>(null)
  const [selectedOrtakId, setSelectedOrtakId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { currentSube, isAdmin, loading: subeLoading } = useSube()
  const years = makeYearWindow(year)
  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (isAdmin && currentSube) loadData()
  }, [isAdmin, currentSube?.id, ayYil])

  async function loadData() {
    if (!currentSube) return
    setLoading(true)

    const [personelRes, ortakRes, giderRes] = await Promise.all([
      supabase
        .from("personeller")
        .select("id, ad, aylik_maas, saatlik_mesai_ucreti")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("ortaklar")
        .select("id, ad")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("gider_kayitlari")
        .select("tarih, personel_paylari, personel_mesai_detaylari, ortak_pilarim")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true }),
    ])

    setPersoneller(personelRes.data || [])
    setOrtaklar(ortakRes.data || [])
    setRows(giderRes.data || [])
    setLoading(false)
  }

  const personelSummaries = useMemo(() => personeller.map(personel => {
    const baseSalary = Number(personel.aylik_maas) || 0
    const hourlyRate = Number(personel.saatlik_mesai_ucreti) || (baseSalary > 0 ? baseSalary / 30 / 8 : 0)
    const advances: Detail[] = []
    const overtime: Detail[] = []

    rows.forEach(row => {
      const advanceAmount = Number(row.personel_paylari?.[personel.id]) || 0
      if (advanceAmount > 0) {
        advances.push({ tarih: row.tarih, amount: advanceAmount, description: "Alinan avans" })
      }

      const hours = Number(row.personel_mesai_detaylari?.[personel.id]) || 0
      if (hours > 0) {
        overtime.push({ tarih: row.tarih, amount: hours * hourlyRate, description: `${hours} saat mesai` })
      }
    })

    const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0)
    const overtimeTotal = overtime.reduce((sum, item) => sum + item.amount, 0)

    return {
      personel,
      baseSalary,
      hourlyRate,
      advances,
      overtime,
      advanceTotal,
      overtimeTotal,
      remaining: baseSalary + overtimeTotal - advanceTotal,
    }
  }), [personeller, rows])

  const ortakSummaries = useMemo(() => ortaklar.map(ortak => {
    const advances: Detail[] = []
    rows.forEach(row => {
      const amount = Number(row.ortak_pilarim?.[ortak.id]) || 0
      if (amount > 0) advances.push({ tarih: row.tarih, amount, description: "Ortak avansi" })
    })
    const total = advances.reduce((sum, item) => sum + item.amount, 0)
    return { ortak, advances, total }
  }), [ortaklar, rows])

  const selectedPersonel = personelSummaries.find(item => item.personel.id === selectedPersonelId) || null
  const selectedOrtak = ortakSummaries.find(item => item.ortak.id === selectedOrtakId) || null
  const salaryTotals = useMemo(() => personelSummaries.reduce((acc, item) => ({
    baseSalary: acc.baseSalary + item.baseSalary,
    advances: acc.advances + item.advanceTotal,
    overtime: acc.overtime + item.overtimeTotal,
    remaining: acc.remaining + item.remaining,
  }), { baseSalary: 0, advances: 0, overtime: 0, remaining: 0 }), [personelSummaries])
  const ortakTotal = useMemo(() => ortakSummaries.reduce((sum, item) => sum + item.total, 0), [ortakSummaries])

  function exportGeneralPdf() {
    openPdfReport({
      title: "Maaşlar Genel Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Maaş", value: `${formatMoney(salaryTotals.baseSalary)} TL` },
        { label: "Toplam Avans", value: `-${formatMoney(salaryTotals.advances)} TL` },
        { label: "Toplam Mesai", value: `+${formatMoney(salaryTotals.overtime)} TL` },
        { label: "Ortak Avans", value: `-${formatMoney(ortakTotal)} TL` },
      ],
      tables: [
        {
          title: "Personel Maaşları",
          headers: ["Personel", "Maaş", "Avans", "Mesai", "Net Kalan"],
          firstColumnWidth: "32%",
          rows: personelSummaries.map(item => [
            item.personel.ad,
            `${formatMoney(item.baseSalary)} TL`,
            `-${formatMoney(item.advanceTotal)} TL`,
            `+${formatMoney(item.overtimeTotal)} TL`,
            `${formatMoney(item.remaining)} TL`,
          ]),
        },
        {
          title: "Ortaklar Pay",
          headers: ["Ortak", "Alınan Avans"],
          firstColumnWidth: "55%",
          rows: ortakSummaries.map(item => [item.ortak.ad, `-${formatMoney(item.total)} TL`]),
        },
      ],
    })
  }

  function exportPersonelPdf(item = selectedPersonel) {
    if (!item) return
    openPdfReport({
      title: `${item.personel.ad} Maaş Detayı`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "portrait",
      metrics: [
        { label: "Aylık Maaş", value: `${formatMoney(item.baseSalary)} TL` },
        { label: "Saatlik Mesai", value: `${formatMoney(item.hourlyRate)} TL` },
        { label: "Toplam Avans", value: `-${formatMoney(item.advanceTotal)} TL` },
        { label: "Net Kalan", value: `${formatMoney(item.remaining)} TL` },
      ],
      tables: [
        {
          title: "Alınan Avanslar",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
        },
        {
          title: "Mesailer",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.overtime.map(detail => [formatDate(detail.tarih), detail.description, `+${formatMoney(detail.amount)} TL`]),
        },
      ],
    })
  }

  function exportOrtakPdf(item = selectedOrtak) {
    if (!item) return
    openPdfReport({
      title: `${item.ortak.ad} Ortak Pay Detayı`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "portrait",
      metrics: [{ label: "Toplam Alınan Avans", value: `-${formatMoney(item.total)} TL` }],
      tables: [{
        title: "Ortak Avansları",
        headers: ["Tarih", "Açıklama", "Tutar"],
        firstColumnWidth: "28%",
        rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
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

  if (subeLoading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yukleniyor...</div>
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
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yukleniyor...</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 bg-emerald-700 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6" />
          <h1 className="text-xl font-bold">Maaşlar</h1>
        </div>
        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          <Button variant="outline" onClick={exportGeneralPdf} className="col-span-full gap-2 border-emerald-500 bg-white/10 text-white hover:bg-emerald-800 sm:col-span-1">
            <FileText className="h-4 w-4" />
            Genel PDF
          </Button>
          <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-emerald-800">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(item => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(item => (
                <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-emerald-800">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4">
        <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {personelSummaries.map(item => (
            <Card
              key={item.personel.id}
              className={`cursor-pointer shadow-sm transition ${
                item.remaining < 0
                  ? "border-red-200 bg-red-50 hover:border-red-400 dark:border-red-500/30 dark:bg-red-500/15"
                  : "border-emerald-200 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/15"
              }`}
              onClick={() => setSelectedPersonelId(item.personel.id)}
            >
              <CardContent className="p-4">
                <p className={`truncate text-xs font-semibold uppercase ${item.remaining < 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{item.personel.ad}</p>
                <p className={`mt-1 text-xl font-bold ${item.remaining < 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{formatMoney(item.remaining)} TL</p>
                <p className="mt-1 text-xs text-muted-foreground">Maaş {formatMoney(item.baseSalary)} - Avans {formatMoney(item.advanceTotal)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {selectedPersonel && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{selectedPersonel.personel.ad} maaş detayı</CardTitle>
                <Button variant="outline" size="sm" onClick={() => exportPersonelPdf(selectedPersonel)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Personel PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <DetailList title="Alınan avanslar" items={selectedPersonel.advances} empty="Avans yok." totalLabel="Toplam alınan avanslar" variant="expense" />
              <DetailList title={`Mesailer (${formatMoney(selectedPersonel.hourlyRate)} TL/saat)`} items={selectedPersonel.overtime} empty="Mesai yok." totalLabel="Toplam mesailer" variant="income" />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Ortaklar Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
              {ortakSummaries.map(item => (
                <button
                  key={item.ortak.id}
                  onClick={() => setSelectedOrtakId(item.ortak.id)}
                  className="rounded-lg border border-red-200 bg-red-50 p-4 text-left transition hover:border-red-400 dark:border-red-500/30 dark:bg-red-500/15"
                >
                  <p className="truncate text-xs font-semibold uppercase text-red-700 dark:text-red-100">{item.ortak.ad}</p>
                  <p className="mt-1 text-xl font-bold text-red-700 dark:text-red-100">-{formatMoney(item.total)} TL</p>
                </button>
              ))}
            </div>
            {selectedOrtak && (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={() => exportOrtakPdf(selectedOrtak)} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Ortak PDF
                  </Button>
                </div>
                <DetailList title={`${selectedOrtak.ortak.ad} ortak avansları`} items={selectedOrtak.advances} empty="Ortak avansı yok." totalLabel="Toplam ortak avansı" variant="expense" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DetailList({
  title,
  items,
  empty,
  totalLabel,
  variant,
}: {
  title: string
  items: Detail[]
  empty: string
  totalLabel: string
  variant: "expense" | "income"
}) {
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const amountClass = variant === "expense" ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"
  const prefix = variant === "expense" ? "-" : "+"

  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-3 font-semibold">{title}</div>
      <div className="divide-y">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((item, index) => (
            <div key={`${item.tarih}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{formatDate(item.tarih)}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <p className={`font-semibold ${amountClass}`}>{prefix}{formatMoney(item.amount)} TL</p>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span className={amountClass}>{prefix}{formatMoney(total)} TL</span>
      </div>
    </div>
  )
}
