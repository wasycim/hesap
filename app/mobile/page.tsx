"use client"

import { useEffect, useState } from "react"
import { ArrowDownRight, ArrowUpRight, Building2, Loader2, LockKeyhole, Scale } from "lucide-react"

type Overview = {
  date: string
  displayName: string
  branch: { ad: string; kod: string } | null
  toplamGelir: number
  toplamGider: number
  kalan: number
}

export default function MobileOverviewPage() {
  const [data, setData] = useState<Overview | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/mobile/overview", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || "Genel bakış yüklenemedi.")
        setData(payload)
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Genel bakış yüklenemedi."))
  }, [])

  if (!data && !error) return <MobileLoader />

  return (
    <div className="ios-page">
      <header className="ios-large-header">
        <span className="ios-eyebrow">BUGÜN</span>
        <h1>Genel Bakış</h1>
        <p>{data ? `${data.displayName} · ${formatDate(data.date)}` : "Finansal özet"}</p>
      </header>

      {error ? <div className="ios-error">{error}</div> : null}
      {data ? (
        <>
          <div className="ios-branch-pill"><Building2 className="h-4 w-4" /> {data.branch?.ad || "Şube"}</div>
          <section className="ios-stat-grid" aria-label="Salt okunur günlük finans özeti">
            <StatCard label="Gelir" value={data.toplamGelir} icon={ArrowUpRight} tone="green" />
            <StatCard label="Gider" value={data.toplamGider} icon={ArrowDownRight} tone="red" />
            <StatCard label="Kalan" value={data.kalan} icon={Scale} tone={data.kalan >= 0 ? "blue" : "red"} wide />
          </section>
          <div className="ios-readonly-note"><LockKeyhole className="h-4 w-4" /><span>Bu ekran yalnız görüntüleme içindir. Kartlar işlem sayfalarına yönlendirmez.</span></div>
        </>
      ) : null}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone, wide = false }: { label: string; value: number; icon: typeof ArrowUpRight; tone: string; wide?: boolean }) {
  return (
    <div className={`ios-stat-card ios-tone-${tone} ${wide ? "ios-stat-wide" : ""}`}>
      <div className="ios-stat-icon"><Icon className="h-5 w-5" /></div>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(value)
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
}

function MobileLoader() {
  return <div className="grid min-h-[65dvh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
}

