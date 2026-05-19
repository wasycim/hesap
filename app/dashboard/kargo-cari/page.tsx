"use client"

import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Package, TrendingUp, TrendingDown, Wallet, Save, Loader2 } from "lucide-react"
import { MONTHS, getInitialMonth, getInitialYear, makeYearWindow } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"

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
  const [scope, setScope] = useState<"monthly" | "all">("monthly")
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const { currentSube } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)
  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) checkAdminAndLoadData()
  }, [currentSube?.id, scope, month, year])

  useEffect(() => {
    registerSaveHandler(saveOdemeler)
    return () => registerSaveHandler(null)
  }, [odemeler, currentSube?.id, firmalar, scope, ayYil])

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
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })

    if (firmaData) {
      setFirmalar(firmaData)
      await loadBorcOzetleri(firmaData)
    }
    setLoading(false)
  }

  async function loadBorcOzetleri(firmaList: KargoFirma[]) {
    if (!currentSube) return

    const ozetler: FirmaBorcOzet[] = []
    const odemeVerileri: Record<string, number> = {}

    for (const firma of firmaList) {
      // Tüm kayıtlardan toplam borcu hesapla (alınan tutar = bize olan borç)
      let kayitQuery = supabase
        .from("kargo_cari_kayitlar")
        .select("alinan_tutar")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)

      if (scope === "monthly") {
        kayitQuery = kayitQuery.eq("ay_yil", ayYil)
      }

      const { data: kayitlar } = await kayitQuery

      let toplamBorc = 0
      if (kayitlar) {
        kayitlar.forEach(kayit => {
          toplamBorc += Number(kayit.alinan_tutar) || 0
        })
      }

      // Ödenen tutarı al
      let odemeQuery = supabase
        .from("kargo_cari_odemeler")
        .select("odenen, ay_yil")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)

      if (scope === "monthly") {
        odemeQuery = odemeQuery.eq("ay_yil", ayYil)
      }

      const { data: odemeData, error: odemeError } = await odemeQuery
      if (odemeError) {
        toast.error("Kargo cari ödemeleri ay bazlı okunamadı. 007 migration dosyasını uygulayın.")
      }

      const odenen = (odemeData || []).reduce((sum, item) => sum + (Number(item.odenen) || 0), 0)
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
    if (scope !== "monthly") {
      toast.error("Ödeme düzenlemek için aylık görünümü seçin.")
      return
    }

    const numValue = Number(value) || 0
    setOdemeler(prev => ({ ...prev, [firmaId]: numValue }))
    markDirty()
    
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
    if (scope !== "monthly") {
      toast.error("Ödemeler yalnızca seçili aya kaydedilebilir.")
      return false
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      toast.error("Oturum veya şube bulunamadı.")
      return false
    }

    try {
      for (const [firmaId, odenen] of Object.entries(odemeler)) {
        const { error } = await supabase
          .from("kargo_cari_odemeler")
          .upsert({
            user_id: user.id,
            sube_id: currentSube.id,
            firma_id: firmaId,
            ay_yil: ayYil,
            odenen: odenen,
            updated_at: new Date().toISOString()
          }, {
            onConflict: "sube_id,firma_id,ay_yil"
          })

        if (error) throw error
      }

      await loadBorcOzetleri(firmalar)
      markClean()
      toast.success("Ödemeler kaydedildi.")
      setSaving(false)
      return true
    } catch (error: any) {
      const message = error?.message || "Ödemeler kaydedilemedi."
      if (
        message.includes("kargo_cari_odemeler_user_id_firma_id_key") ||
        message.includes("kargo_cari_odemeler_sube_firma_unique") ||
        message.includes("kargo_cari_odemeler_sube_firma_key")
      ) {
        toast.error("Eski kargo cari ödeme kuralı veritabanında kalmış. 007 migration dosyasını uygulayın.")
      } else {
        toast.error(message)
      }
      setSaving(false)
      return false
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function exportBorcPdf() {
    openPdfReport({
      title: "Kargo Cari Borç Özeti",
      subtitle: `${currentSube?.ad || ""} - ${scope === "monthly" ? `${month} ${year}` : "Tüm zamanlar"}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Borç", value: `${formatNumber(genelToplam.toplam_borc)} TL` },
        { label: "Toplam Ödenen", value: `${formatNumber(genelToplam.odenen)} TL` },
        { label: "Kalan Borç", value: `${formatNumber(genelToplam.kalan_borc)} TL` },
      ],
      tables: [{
        title: "Firma Bazlı Borç Durumu",
        headers: ["Firma", "Toplam Borç", "Ödenen", "Kalan Borç"],
        firstColumnWidth: "38%",
        rows: [
          ...borcOzetleri.map(ozet => [
            ozet.firma_ad,
            `${formatNumber(ozet.toplam_borc)} TL`,
            `${formatNumber(ozet.odenen)} TL`,
            `${formatNumber(ozet.kalan_borc)} TL`,
          ]),
          [
            "GENEL TOPLAM",
            `${formatNumber(genelToplam.toplam_borc)} TL`,
            `${formatNumber(genelToplam.odenen)} TL`,
            `${formatNumber(genelToplam.kalan_borc)} TL`,
          ],
        ],
      }],
    })
  }

  // Genel toplamlar
  const genelToplam = borcOzetleri.reduce((acc, ozet) => ({
    toplam_borc: acc.toplam_borc + ozet.toplam_borc,
    odenen: acc.odenen + ozet.odenen,
    kalan_borc: acc.kalan_borc + ozet.kalan_borc,
  }), { toplam_borc: 0, odenen: 0, kalan_borc: 0 })

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Yükleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Erişim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kargo Cari Borç Özeti</h1>
          <p className="text-muted-foreground mt-1">
            {scope === "monthly" ? `${month} ${year} borç durumu` : "Tüm firmaların borç durumu (tüm zamanlar)"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={scope} onValueChange={(value) => setScope(value as "monthly" | "all")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="all">Tüm zamanlar</SelectItem>
            </SelectContent>
          </Select>
          {scope === "monthly" && (
            <>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(item => (
                    <SelectItem key={item} value={item}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-full sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(item => (
                    <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <Button onClick={saveOdemeler} disabled={saving || scope !== "monthly"} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Odemeleri Kaydet
          </Button>
          <Button onClick={exportBorcPdf} variant="outline" className="gap-2" disabled={borcOzetleri.length === 0}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {/* Genel Toplam Kartlari */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/15">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-200">Toplam Borç</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-100">
                  {formatNumber(genelToplam.toplam_borc)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-500/20">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/15">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-green-600 dark:text-green-200">Toplam Ödenen</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-100">
                  {formatNumber(genelToplam.odenen)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-500/20">
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`${genelToplam.kalan_borc > 0 ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/15"}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`mb-1 text-sm font-medium ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>Kalan Borç</p>
                <p className={`text-2xl font-bold ${genelToplam.kalan_borc > 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>
                  {formatNumber(genelToplam.kalan_borc)} <span className="text-base font-normal">TL</span>
                </p>
              </div>
              <div className={`rounded-full p-3 ${genelToplam.kalan_borc > 0 ? "bg-red-100 dark:bg-red-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"}`}>
                <Wallet className={`h-6 w-6 ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Firma Bazlı Borç Tablosu */}
      <Card className="overflow-hidden border-cyan-100 shadow-sm dark:border-cyan-500/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-cyan-500" />
            Firma Bazlı Borç Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {firmalar.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Henüz firma eklenmemiş. Ayarlar sayfasından firma ekleyebilirsiniz.
            </div>
          ) : (
            <div className="mobile-scroll overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead>
                  <tr className="border-b bg-slate-950 text-white dark:bg-slate-900">
                    <th className="bg-muted p-3 text-left font-semibold text-foreground">FİRMA ADI</th>
                    <th className="bg-blue-50 p-3 text-right font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-200">TOPLAM BORÇ</th>
                    <th className="bg-green-50 p-3 text-center font-semibold text-green-700 dark:bg-green-500/15 dark:text-green-200">ÖDENEN (Giriniz)</th>
                    <th className="bg-orange-50 p-3 text-right font-semibold text-orange-700 dark:bg-orange-500/15 dark:text-orange-200">KALAN BORÇ</th>
                  </tr>
                </thead>
                <tbody>
                  {borcOzetleri.map((ozet) => (
                    <tr key={ozet.firma_id} className="border-b text-center transition-colors hover:bg-cyan-50/60 dark:hover:bg-cyan-500/10">
                      <td className="p-4 font-semibold">{ozet.firma_ad}</td>
                      <td className="p-4 font-semibold text-blue-700 dark:text-blue-200">{formatNumber(ozet.toplam_borc)} TL</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          value={odemeler[ozet.firma_id] || ""}
                          onChange={(e) => handleOdemeChange(ozet.firma_id, e.target.value)}
                          disabled={scope !== "monthly"}
                          className="mx-auto h-10 w-40 rounded-md border-emerald-200 bg-emerald-50 text-center font-semibold dark:border-emerald-500/30 dark:bg-emerald-500/15"
                          placeholder="0.00"
                        />
                      </td>
                      <td className={`p-4 font-bold ${ozet.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>
                        {formatNumber(ozet.kalan_borc)} TL
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/70 text-center font-bold text-foreground">
                    <td className="p-4">GENEL TOPLAM</td>
                    <td className="p-4 text-blue-700 dark:text-blue-200">{formatNumber(genelToplam.toplam_borc)} TL</td>
                    <td className="p-4 text-green-700 dark:text-green-200">{formatNumber(genelToplam.odenen)} TL</td>
                    <td className={`p-4 ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>
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
