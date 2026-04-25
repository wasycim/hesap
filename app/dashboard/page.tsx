"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TrendingUp, TrendingDown, Soup } from "lucide-react"
import Link from "next/link"
import { useSube } from "@/contexts/sube-context"

const months = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"
]
const years = [2026, 2027, 2028, 2029, 2030]

export default function DashboardPage() {
  const [month, setMonth] = useState("Nisan")
  const [year, setYear] = useState(2026)
  const [stats, setStats] = useState({
    toplamGelir: 0,
    toplamGider: 0,
    kalan: 0,
  })
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const { currentSube, refreshKey } = useSube()

  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) {
      fetchStats()
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
  }, [month, year, currentSube?.id, refreshKey])

  const fetchStats = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    // Şubeye göre gelir kayitlarini cek
    const { data: gelirData } = await supabase
      .from("gelir_kayitlari")
      .select("toplam, kalan")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    // Şubeye göre gider kayitlarini cek
    const { data: giderData } = await supabase
      .from("gider_kayitlari")
      .select("genel_toplam")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)

    let toplamGelir = 0
    let toplamKalan = 0

    if (gelirData) {
      toplamGelir = gelirData.reduce((sum, row) => sum + (Number(row.toplam) || 0), 0)
      toplamKalan = gelirData.reduce((sum, row) => sum + (Number(row.kalan) || 0), 0)
    }

    let toplamGider = 0
    if (giderData) {
      toplamGider = giderData.reduce((sum, row) => sum + (Number(row.genel_toplam) || 0), 0)
    }

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
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Genel Bakis</h1>
          <p className="text-muted-foreground mt-1">Aylik hesap ozeti</p>
        </div>
        
        {/* Ay/Yil Secimi */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <p className="text-emerald-100 text-sm">Gunluk gelir kayitlari</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/gider">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-red-500 to-red-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <TrendingDown className="h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Gider Tablosu</h3>
                  <p className="text-red-100 text-sm">Gunluk gider kayitlari</p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/dashboard/corbalar">
              <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none h-full">
                <CardContent className="p-6">
                  <Soup className="h-8 w-8 mb-3 opacity-80" />
                  <h3 className="text-lg font-bold mb-1">Corbalar</h3>
                  <p className="text-orange-100 text-sm">Personel corba takibi</p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
