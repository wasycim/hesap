"use client"

import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Package, TrendingUp, TrendingDown, Wallet, Save, Loader2 } from "lucide-react"

interface KargoFirma {
  id: string
  ad: string
}

interface FirmaBorcOzet {
  firma_id: string
  firma_ad: string
  toplam_borc: number
  odenen: number
  kalan_borc: number
}

export default function KargoCariOzetPage() {
  const [firmalar, setFirmalar] = useState<KargoFirma[]>([])
  const [borcOzetleri, setBorcOzetleri] = useState<FirmaBorcOzet[]>([])
  const [odemeler, setOdemeler] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const { currentSube } = useSube()
  const { markClean, registerSaveHandler } = useUnsavedChanges()

  useEffect(() => {
    if (currentSube) checkAdminAndLoadData()
  }, [currentSube?.id])

  useEffect(() => {
    registerSaveHandler(saveOdemeler)
    return () => registerSaveHandler(null)
  }, [odemeler, currentSube?.id])

  async function checkAdminAndLoadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    // Admin kontrolü
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(profile?.is_admin || false)

    // Firmaları yükle
    const { data: firmaData } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad")
      .eq("user_id", user.id)
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })

    if (firmaData) {
      setFirmalar(firmaData)
      await loadBorcOzetleri(user.id, firmaData)
    }
    setLoading(false)
  }

  async function loadBorcOzetleri(userId: string, firmaList: KargoFirma[]) {
    const ozetler: FirmaBorcOzet[] = []
    const odemeVerileri: Record<string, number> = {}

    for (const firma of firmaList) {
      // Tüm kayıtlardan toplam borcu hesapla (alınan tutar = bize olan borç)
      const { data: kayitlar } = await supabase
        .from("kargo_cari_kayitlar")
        .select("alinan_tutar")
        .eq("user_id", userId)
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)

      let toplamBorc = 0
      if (kayitlar) {
        kayitlar.forEach(kayit => {
          toplamBorc += Number(kayit.alinan_tutar) || 0
        })
      }

      // Ödenen tutarı al
      const { data: odemeData } = await supabase
        .from("kargo_cari_odemeler")
        .select("odenen")
        .eq("user_id", userId)
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)
        .single()

      const odenen = odemeData?.odenen || 0
      odemeVerileri[firma.id] = odenen

      ozetler.push({
        firma_id: firma.id,
        firma_ad: firma.ad,
        toplam_borc: toplamBorc,
        odenen: odenen,
        kalan_borc: toplamBorc - odenen,
      })
    }

    setBorcOzetleri(ozetler)
    setOdemeler(odemeVerileri)
  }

  async function handleOdemeChange(firmaId: string, value: string) {
    const numValue = Number(value) || 0
    setOdemeler(prev => ({ ...prev, [firmaId]: numValue }))
    
    // Özeti güncelle
    setBorcOzetleri(prev => prev.map(ozet => {
      if (ozet.firma_id === firmaId) {
        return {
          ...ozet,
          odenen: numValue,
          kalan_borc: ozet.toplam_borc - numValue
        }
      }
      return ozet
    }))
  }

  async function saveOdemeler() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return
    }

    for (const [firmaId, odenen] of Object.entries(odemeler)) {
      await supabase
        .from("kargo_cari_odemeler")
        .upsert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: firmaId,
          odenen: odenen,
          updated_at: new Date().toISOString()
        }, {
          onConflict: "sube_id,firma_id"
        })
    }

    setSaving(false)
    markClean()
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Genel toplamlar
  const genelToplam = borcOzetleri.reduce((acc, ozet) => ({
    toplam_borc: acc.toplam_borc + ozet.toplam_borc,
    odenen: acc.odenen + ozet.odenen,
    kalan_borc: acc.kalan_borc + ozet.kalan_borc,
  }), { toplam_borc: 0, odenen: 0, kalan_borc: 0 })

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Yukleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Erisim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yoneticiler erisebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kargo Cari Borc Ozeti</h1>
          <p className="text-muted-foreground mt-1">Tum firmalarin borc durumu (tum zamanlar)</p>
        </div>

        <Button onClick={saveOdemeler} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Odemeleri Kaydet
        </Button>
      </div>

      {/* Genel Toplam Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Toplam Borc</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatNumber(genelToplam.toplam_borc)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 mb-1">Toplam Odenen</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatNumber(genelToplam.odenen)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <TrendingDown className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${genelToplam.kalan_borc > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium mb-1 ${genelToplam.kalan_borc > 0 ? "text-red-600" : "text-emerald-600"}`}>Kalan Borc</p>
                <p className={`text-2xl font-bold ${genelToplam.kalan_borc > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {formatNumber(genelToplam.kalan_borc)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className={`p-3 rounded-full ${genelToplam.kalan_borc > 0 ? "bg-red-100" : "bg-emerald-100"}`}>
                <Wallet className={`h-6 w-6 ${genelToplam.kalan_borc > 0 ? "text-red-600" : "text-emerald-600"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Firma Bazli Borc Tablosu */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-cyan-500" />
            Firma Bazli Borc Durumu
          </CardTitle>
        </CardHeader>
        <CardContent>
          {firmalar.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henuz firma eklenmemis. Ayarlar sayfasindan firma ekleyebilirsiniz.
            </div>
          ) : (
            <div className="overflow-x-auto flex justify-center">
              <table className="text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b">
                    <th className="p-3 text-left font-semibold bg-gray-50">FIRMA ADI</th>
                    <th className="p-3 text-right font-semibold bg-blue-50 text-blue-700">TOPLAM BORC</th>
                    <th className="p-3 text-center font-semibold bg-green-50 text-green-700">ODENEN (Giriniz)</th>
                    <th className="p-3 text-right font-semibold bg-orange-50 text-orange-700">KALAN BORC</th>
                  </tr>
                </thead>
                <tbody>
                  {borcOzetleri.map((ozet) => (
                    <tr key={ozet.firma_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{ozet.firma_ad}</td>
                      <td className="p-3 text-right text-blue-700 font-semibold">{formatNumber(ozet.toplam_borc)} TL</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          value={odemeler[ozet.firma_id] || ""}
                          onChange={(e) => handleOdemeChange(ozet.firma_id, e.target.value)}
                          className="w-40 mx-auto text-center bg-green-50 border-green-200 focus:border-green-400"
                          placeholder="0.00"
                        />
                      </td>
                      <td className={`p-3 text-right font-bold ${ozet.kalan_borc > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatNumber(ozet.kalan_borc)} TL
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td className="p-3">GENEL TOPLAM</td>
                    <td className="p-3 text-right text-blue-700">{formatNumber(genelToplam.toplam_borc)} TL</td>
                    <td className="p-3 text-center text-green-700">{formatNumber(genelToplam.odenen)} TL</td>
                    <td className={`p-3 text-right ${genelToplam.kalan_borc > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {formatNumber(genelToplam.kalan_borc)} TL
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
