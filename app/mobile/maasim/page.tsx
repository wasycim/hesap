"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Clock3, FileUp, Loader2, MinusCircle, WalletCards } from "lucide-react"
import { openPdfReport } from "@/lib/pdf-report"

type Salary = {
  period: { month: number; year: number }
  branch: { ad: string } | null
  personel: { name: string }
  baseSalary: number
  hourlyRate: number
  advanceTotal: number
  overtimeTotal: number
  remaining: number
  advances: Array<{ date: string; amount: number; description: string }>
  overtime: Array<{ date: string; amount: number; description: string; minutes: number; rate: number; source: string }>
}

export default function MobileSalaryPage() {
  const now = new Date()
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() })
  const [data, setData] = useState<Salary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/mobile/salary?month=${period.month}&year=${period.year}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Maaş bilgisi yüklenemedi.")
        setData(payload)
      })
      .catch((reason) => { setData(null); setError(reason instanceof Error ? reason.message : "Maaş bilgisi yüklenemedi.") })
      .finally(() => setLoading(false))
  }, [period.month, period.year])

  function moveMonth(delta: number) {
    const date = new Date(period.year, period.month - 1 + delta, 1)
    setPeriod({ month: date.getMonth() + 1, year: date.getFullYear() })
  }

  function sharePdf() {
    if (!data) return
    openPdfReport({
      title: `${data.personel.name} Maaş Detayı`,
      subtitle: `${data.branch?.ad || ""} · ${monthLabel(data.period.month, data.period.year)}`,
      orientation: "portrait",
      skipOrientationPicker: true,
      archive: false,
      metrics: [
        { label: "Aylık Maaş", value: formatMoney(data.baseSalary) },
        { label: "Toplam Mesai", value: `+${formatMoney(data.overtimeTotal)}` },
        { label: "Toplam Avans", value: `-${formatMoney(data.advanceTotal)}` },
        { label: "Net Kalan", value: formatMoney(data.remaining) },
      ],
      tables: [
        { title: "Alınan Avanslar", headers: ["Tarih", "Açıklama", "Tutar"], rows: data.advances.map((item) => [formatDate(item.date), item.description, `-${formatMoney(item.amount)}`]) },
        { title: "Onaylı Mesailer", headers: ["Tarih", "Açıklama", "Süre", "Tutar"], rows: data.overtime.map((item) => [formatDate(item.date), item.description, item.minutes ? formatMinutes(item.minutes) : "Doğrudan tutar", `+${formatMoney(item.amount)}`]) },
      ],
    })
  }

  return (
    <div className="ios-page">
      <header className="ios-large-header ios-header-row">
        <div><span className="ios-eyebrow">KİŞİSEL</span><h1>Maaşım</h1><p>Yalnızca size ait maaş ve onaylı mesai bilgileri</p></div>
        <button type="button" className="ios-share-button" onClick={sharePdf} disabled={!data}><FileUp className="h-5 w-5" /><span>PDF</span></button>
      </header>

      <div className="ios-period-picker">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Önceki ay"><ChevronLeft /></button>
        <strong>{monthLabel(period.month, period.year)}</strong>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Sonraki ay"><ChevronRight /></button>
      </div>

      {loading ? <div className="grid min-h-[45dvh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div> : null}
      {error ? <div className="ios-error">{error}</div> : null}
      {!loading && data ? (
        <>
          <section className="ios-salary-hero">
            <span>Net kalan</span><strong>{formatMoney(data.remaining)}</strong><small>{data.personel.name} · {data.branch?.ad}</small>
          </section>
          <section className="ios-salary-metrics">
            <SalaryMetric label="Aylık maaş" value={data.baseSalary} icon={WalletCards} />
            <SalaryMetric label="Onaylı mesai" value={data.overtimeTotal} icon={Clock3} positive />
            <SalaryMetric label="Alınan avans" value={data.advanceTotal} icon={MinusCircle} negative />
          </section>
          <DetailSection title="Avanslar" empty="Bu ay avans kaydı yok." rows={data.advances.map((item) => ({ ...item, meta: item.description, sign: -1 }))} />
          <DetailSection title="Mesailer" empty="Bu ay onaylı mesai kaydı yok." rows={data.overtime.map((item) => ({ date: item.date, amount: item.amount, meta: `${item.description}${item.minutes ? ` · ${formatMinutes(item.minutes)}` : ""}`, sign: 1 }))} />
        </>
      ) : null}
    </div>
  )
}

function SalaryMetric({ label, value, icon: Icon, positive, negative }: { label: string; value: number; icon: typeof WalletCards; positive?: boolean; negative?: boolean }) {
  return <div className="ios-salary-metric"><Icon className="h-5 w-5" /><span>{label}</span><strong className={positive ? "text-emerald-600" : negative ? "text-red-500" : ""}>{positive ? "+" : negative ? "−" : ""}{formatMoney(value)}</strong></div>
}

function DetailSection({ title, rows, empty }: { title: string; empty: string; rows: Array<{ date: string; amount: number; meta: string; sign: number }> }) {
  return <section className="ios-detail-section"><h2>{title}</h2><div className="ios-list">{rows.length ? rows.map((row, index) => <div className="ios-list-row" key={`${row.date}-${index}`}><div><strong>{formatDate(row.date)}</strong><span>{row.meta}</span></div><b className={row.sign > 0 ? "text-emerald-600" : "text-red-500"}>{row.sign > 0 ? "+" : "−"}{formatMoney(row.amount)}</b></div>) : <p className="ios-empty">{empty}</p>}</div></section>
}

function formatMoney(value: number) { return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value) }
function formatDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" }) }
function formatMinutes(value: number) { const hours = Math.floor(value / 60); const minutes = value % 60; return `${hours ? `${hours} sa ` : ""}${minutes ? `${minutes} dk` : ""}`.trim() }
function monthLabel(month: number, year: number) { return new Date(year, month - 1, 1).toLocaleDateString("tr-TR", { month: "long", year: "numeric" }) }

