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
  makeYearWindow,
} from "@/lib/date-navigation"

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
  const supabase = createClient()
  const { currentSube, refreshKey, isAdmin } = useSube()

  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) {
      fetchStats()
    }
    if (isAdmin) {
      fetchShiftWarnings()
    } else {
      setShiftWarnings([])
    }

    // Realtime subscription - birden fazla tablo
    const gelirChannel = supabase
      .channel(`dashboard_gelir_${currentSube?.id || 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gelir_kayitlari' }, () => {
        if (currentSube) fetchStats()
      })
      .subscribe()

    const giderChannel = supabase
      .channel(`dashboard_gider_${currentSube?.id || 'none'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gider_kayitlari' }, () => {
        if (currentSube) fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(gelirChannel)
      supabase.removeChannel(giderChannel)
    }
  }, [month, year, currentSube?.id, refreshKey, isAdmin])

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

    // Şubeye göre gelir kayıtlarını çek
    const { data: gelirData } = await supabase
      .from("gelir_kayitlari")
      .select("toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    // Şubeye göre gider kayıtlarını çek
    const { data: giderData } = await supabase
      .from("gider_kayitlari")
      .select("genel_toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Genel Bakış</h1>
          <p className="text-muted-foreground mt-1">Aylık hesap özeti</p>
        </div>
        
        {/* Ay/Yıl Seçimi */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
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
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/gelir">
              <Card className="bg-emerald-50 border-emerald-200 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-emerald-600 mb-1">Toplam Gelir</p>
                      <p className="text-2xl font-bold text-emerald-700">
                        {formatCurrency(stats.toplamGelir)} <span className="text-base font-normal">TL</span>
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-emerald-100">
                      <TrendingUp className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard/gider">
              <Card className="bg-red-50 border-red-200 hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600 mb-1">Toplam Gider</p>
                      <p className="text-2xl font-bold text-red-700">
                        {formatCurrency(stats.toplamGider)} <span className="text-base font-normal">TL</span>
                      </p>
                    </div>
                    <div className="p-3 rounded-full bg-red-100">
                      <TrendingDown className="h-6 w-6 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Kalan</p>
                    <p className={`text-2xl font-bold ${stats.kalan >= 0 ? "text-blue-700" : "text-red-700"}`}>
                      {formatCurrency(stats.kalan)} <span className="text-base font-normal">TL</span>
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-100">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/dashboard/gelir">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <TrendingUp className="h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Gelir Tablosu</h3>
                  <p className="text-emerald-100 text-sm">Günlük gelir kayıtları</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/gider">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <TrendingDown className="h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Gider Tablosu</h3>
                  <p className="text-red-100 text-sm">Günlük gider kayıtları</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/corbalar">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <Soup className="h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Çorbalar</h3>
                  <p className="text-orange-100 text-sm">Personel çorba takibi</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
