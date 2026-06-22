"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertTriangle, TrendingUp, TrendingDown, Wallet, Soup } from "lucide-react"
import Link from "next/link"
import { useSube } from "@/contexts/sube-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  getInitialMonth,
  getInitialYear,
  getLocalDateString,
  makeYearWindow,
} from "@/lib/date-navigation"
import { getSubeHesapInfo } from "@/lib/sube-utils"

export default function DashboardPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const years = makeYearWindow(year)
  const [stats, setStats] = useState({
    toplamGelir: 0,
    toplamGider: 0,
    kalan: 0,
  })
  const [loading, setLoading] = useState(true)
  const [shiftWarnings, setShiftWarnings] = useState<{ sube_id: string; message: string }[]>([])
  const [menuVisibility, setMenuVisibility] = useState<Record<string, boolean>>({})
  const supabase = createClient()
  const { currentSube, refreshKey, isAdmin } = useSube()

  const ayYil = `${month}-${year}`
  const today = getLocalDateString()
  const summaryScope = isAdmin ? "monthly" : "daily"

  useEffect(() => {
    if (currentSube) {
      fetchStats()
      fetchMenuVisibility()
    } else {
      setMenuVisibility({})
    }
    if (isAdmin) {
      fetchShiftWarnings()
    } else {
      setShiftWarnings([])
    }

    if (!currentSube) return

    const gelirChannel = supabase
      .channel(`dashboard_gelir_${currentSube.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gelir_kayitlari',
        filter: `sube_id=eq.${currentSube.id}`,
      }, fetchStats)
      .subscribe()

    const giderChannel = supabase
      .channel(`dashboard_gider_${currentSube.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'gider_kayitlari',
        filter: `sube_id=eq.${currentSube.id}`,
      }, fetchStats)
      .subscribe()

    return () => {
      supabase.removeChannel(gelirChannel)
      supabase.removeChannel(giderChannel)
    }
  }, [month, year, currentSube?.id, refreshKey, isAdmin])

  async function fetchMenuVisibility() {
    if (!currentSube) return

    const { data } = await supabase
      .from("sube_menu_izinleri")
      .select("menu_key, visible")
      .eq("sube_id", currentSube.id)

    setMenuVisibility((data || []).reduce((acc, item) => ({
      ...acc,
      [item.menu_key]: item.visible,
    }), {} as Record<string, boolean>))
  }

  async function fetchShiftWarnings() {
    const response = await fetch("/api/admin/branch-shift-warnings")
    if (!response.ok) return
    const result = await response.json()
    setShiftWarnings(result.warnings || [])
  }

  const fetchStats = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    if (isAdmin) {
      const { data: summaryData, error: summaryError } = await supabase
        .from("v_dashboard_monthly_totals")
        .select("toplam_gelir, toplam_gider, kalan")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .maybeSingle()

      if (!summaryError && summaryData) {
        setStats({
          toplamGelir: Number(summaryData.toplam_gelir) || 0,
          toplamGider: Number(summaryData.toplam_gider) || 0,
          kalan: Number(summaryData.kalan) || 0,
        })
        setLoading(false)
        return
      }
    }

    let gelirQuery = supabase
      .from("gelir_kayitlari")
      .select("toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    let giderQuery = supabase
      .from("gider_kayitlari")
      .select("genel_toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    if (!isAdmin) {
      gelirQuery = gelirQuery.eq("tarih", today)
      giderQuery = giderQuery.eq("tarih", today)
    }

    const [{ data: gelirData }, { data: giderData }] = await Promise.all([gelirQuery, giderQuery])

    let toplamGelir = 0
    let toplamKalan = 0

    if (gelirData) {
      toplamGelir = gelirData.reduce((sum, row) => sum + (Number(row.toplam) || 0), 0)
    }

    let toplamGider = 0
    if (giderData) {
      toplamGider = giderData.reduce((sum, row) => sum + (Number(row.genel_toplam) || 0), 0)
    }

    toplamKalan = toplamGelir - toplamGider

    setStats({
      toplamGelir,
      toplamGider,
      kalan: toplamKalan,
    })
    setLoading(false)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("tr-TR", { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    }).format(amount)
  }

  function canSeeMenu(key: string) {
    return menuVisibility[key] !== false
  }

  function getDashboardGridClass(itemCount: number) {
    if (itemCount <= 1) return "mx-auto grid max-w-md grid-cols-1 gap-4"
    if (itemCount === 2) return "mx-auto grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2"
    return "grid grid-cols-1 gap-4 md:grid-cols-3"
  }

  const combinedHesapInfo = getSubeHesapInfo(currentSube)
  const isCombinedBranch = Boolean(combinedHesapInfo)
  const combinedHesapVisible = isCombinedBranch && canSeeMenu("gelir") && canSeeMenu("gider")
  const combinedHesapHref = combinedHesapInfo?.href || "/dashboard/gelir"
  const combinedHesapTitle = combinedHesapInfo?.title || "Şube Hesap"
  const combinedHesapGradient = combinedHesapInfo?.key === "carsi"
    ? "from-cyan-600 to-emerald-600"
    : combinedHesapInfo?.key === "darica"
      ? "from-indigo-600 to-sky-600"
      : combinedHesapInfo?.key === "onDort"
        ? "from-lime-600 to-emerald-700"
        : "from-emerald-600 to-teal-700"
  const gelirHref = isCombinedBranch ? combinedHesapHref : "/dashboard/gelir"
  const giderHref = isCombinedBranch ? combinedHesapHref : "/dashboard/gider"
  const statsGridItemCount = 1 + (canSeeMenu("gelir") ? 1 : 0) + (canSeeMenu("gider") ? 1 : 0)
  const quickActionCount = isCombinedBranch
    ? [combinedHesapVisible, canSeeMenu("corbalar")].filter(Boolean).length
    : [canSeeMenu("gelir"), canSeeMenu("gider"), canSeeMenu("corbalar")].filter(Boolean).length

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Genel Bakış</h1>
          <p className="text-muted-foreground mt-1">{summaryScope === "monthly" ? "Aylık hesap özeti" : "Günlük hesap özeti"}</p>
        </div>
        
        {/* Ay/Yıl Seçimi */}
        {isAdmin && <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== 2026 || index >= START_MONTH_INDEX).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-full sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {shiftWarnings.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="space-y-2 p-4">
                {shiftWarnings.map(warning => (
                  <div key={`${warning.sube_id}-${warning.message}`} className="flex items-start gap-3 text-amber-900">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">Vardiya ipucu</p>
                      <p className="text-sm">{warning.message}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className={`${getDashboardGridClass(statsGridItemCount)} dashboard-stats-grid`}>
            {canSeeMenu("gelir") && (
            <Link href={gelirHref}>
              <Card className="dashboard-stat-card dashboard-stat-income h-full bg-emerald-50 border-emerald-200 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 mb-1">Toplam Gelir</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(stats.toplamGelir)} <span className="text-base font-normal">TL</span>
                      </p>
                    </div>
                    <div className="dashboard-stat-icon p-3 rounded-full bg-emerald-100">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            )}

            {canSeeMenu("gider") && (
            <Link href={giderHref}>
              <Card className="dashboard-stat-card dashboard-stat-expense h-full bg-red-50 border-red-200 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-1">Toplam Gider</p>
                      <p className="text-2xl font-bold text-red-700">
                        {formatCurrency(stats.toplamGider)} <span className="text-base font-normal">TL</span>
                      </p>
                    </div>
                    <div className="dashboard-stat-icon p-3 rounded-full bg-red-100">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            )}

            <Card className="dashboard-stat-card dashboard-stat-balance h-full bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Kalan</p>
                    <p className={`text-2xl font-bold ${stats.kalan >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatCurrency(stats.kalan)} <span className="text-base font-normal">TL</span>
                    </p>
                  </div>
                  <div className="dashboard-stat-icon p-3 rounded-full bg-blue-100">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            
          </div>

          {/* Net Durum */}
          <Card className={`${stats.toplamGelir - stats.toplamGider >= 0 ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-red-500 to-red-600"} border-none text-white`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white/80 mb-1">Net Durum (Gelir - Gider)</p>
                  <p className="text-4xl font-bold">
                    {stats.toplamGelir - stats.toplamGider >= 0 ? "+" : ""}{formatCurrency(stats.toplamGelir - stats.toplamGider)} TL
                  </p>
                </div>
                <div className="text-6xl opacity-20">
                  {stats.toplamGelir - stats.toplamGider >= 0 ? "+" : "-"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className={`${getDashboardGridClass(quickActionCount)} dashboard-stats-grid`}>
            {isCombinedBranch ? (
              combinedHesapVisible && (
                <Link href={combinedHesapHref}>
                  <Card className={`dashboard-stat-card h-full cursor-pointer border-none bg-gradient-to-br text-white transition-all hover:scale-[1.02] hover:shadow-lg ${combinedHesapGradient}`}>
                    <CardContent className="p-6">
                      <Wallet className="dashboard-stat-inline-icon h-8 w-8 mb-3 opacity-80" />
                      <h3 className="text-lg font-bold mb-1">{combinedHesapTitle}</h3>
                      <p className="text-white/85 text-sm">Gelir ve gider kayıtları tek sayfada</p>
                    </CardContent>
                  </Card>
                </Link>
              )
            ) : (
            <>
            {canSeeMenu("gelir") && (
            <Link href="/dashboard/gelir">
              <Card className="dashboard-stat-card dashboard-stat-income hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <TrendingUp className="dashboard-stat-inline-icon h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Gelir Tablosu</h3>
                  <p className="text-emerald-100 text-sm">Günlük gelir kayıtları</p>
                </CardContent>
              </Card>
            </Link>
            )}
            {canSeeMenu("gider") && (
            <Link href="/dashboard/gider">
              <Card className="dashboard-stat-card dashboard-stat-expense hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <TrendingDown className="dashboard-stat-inline-icon h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Gider Tablosu</h3>
                  <p className="text-red-100 text-sm">Günlük gider kayıtları</p>
                </CardContent>
              </Card>
            </Link>
            )}
            </>
            )}
            {canSeeMenu("corbalar") && (
            <Link href="/dashboard/corbalar">
              <Card className="dashboard-stat-card dashboard-stat-soup hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <Soup className="dashboard-stat-inline-icon h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Çorbalar</h3>
                  <p className="text-orange-100 text-sm">Personel çorba takibi</p>
                </CardContent>
              </Card>
            </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
