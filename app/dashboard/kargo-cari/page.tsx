"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { CreditCard, FileText, History, Loader2, Package, Save, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { MONTHS, getInitialMonth, getInitialYear, getLocalDateString, makeYearWindow } from "@/lib/date-navigation"
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

interface OdemeHareketi {
  id: string
  tarih: string
  firma_id: string
  firma_ad: string
  toplam_borc: number
  odenen: number
  kalan_borc: number
  notlar: string
  created_at: string | null
}

interface OdemeFormu {
  firmaId: string
  tarih: string
  odenen: string
  notlar: string
}

export default function KargoCariOzetPage() {
  const [firmalar, setFirmalar] = useState<KargoFirma[]>([])
  const [borcOzetleri, setBorcOzetleri] = useState<FirmaBorcOzet[]>([])
  const [odemeHareketleri, setOdemeHareketleri] = useState<OdemeHareketi[]>([])
  const [odemeFormu, setOdemeFormu] = useState<OdemeFormu>({
    firmaId: "",
    tarih: getLocalDateString(),
    odenen: "",
    notlar: "",
  })
  const [odemeFormuKirli, setOdemeFormuKirli] = useState(false)
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

  const selectedOzet = useMemo(
    () => borcOzetleri.find(ozet => ozet.firma_id === odemeFormu.firmaId) || null,
    [borcOzetleri, odemeFormu.firmaId],
  )
  const odemeTutari = Number(odemeFormu.odenen) || 0
  const formKalanBorc = selectedOzet ? selectedOzet.kalan_borc - odemeTutari : 0
  const genelToplam = useMemo(() => borcOzetleri.reduce((acc, ozet) => ({
    toplam_borc: acc.toplam_borc + ozet.toplam_borc,
    odenen: acc.odenen + ozet.odenen,
    kalan_borc: acc.kalan_borc + ozet.kalan_borc,
  }), { toplam_borc: 0, odenen: 0, kalan_borc: 0 }), [borcOzetleri])

  useEffect(() => {
    if (currentSube) checkAdminAndLoadData()
  }, [currentSube?.id, scope, month, year])

  useEffect(() => {
    registerSaveHandler(saveYeniOdeme)
    return () => registerSaveHandler(null)
  }, [odemeFormu, odemeFormuKirli, selectedOzet, currentSube?.id, scope, ayYil])

  async function checkAdminAndLoadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, is_developer")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(Boolean(profile?.is_admin || profile?.is_developer))

    const { data: firmaData, error } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })

    if (error) {
      toast.error("Kargo firmaları okunamadı: " + error.message)
      setLoading(false)
      return
    }

    const firmaList = firmaData || []
    setFirmalar(firmaList)
    setOdemeFormu(prev => ({
      ...prev,
      firmaId: prev.firmaId && firmaList.some(firma => firma.id === prev.firmaId) ? prev.firmaId : firmaList[0]?.id || "",
    }))
    await loadBorcOzetleri(firmaList)
    setLoading(false)
  }

  async function loadBorcOzetleri(firmaList: KargoFirma[]) {
    if (!currentSube) return

    const ozetler: FirmaBorcOzet[] = []

    for (const firma of firmaList) {
      let kayitQuery = supabase
        .from("kargo_cari_kayitlar")
        .select("alinan_tutar")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)

      let odemeQuery = supabase
        .from("kargo_cari_odemeler")
        .select("odenen")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firma.id)

      if (scope === "monthly") {
        kayitQuery = kayitQuery.eq("ay_yil", ayYil)
        odemeQuery = odemeQuery.eq("ay_yil", ayYil)
      }

      const [{ data: kayitlar, error: kayitError }, { data: odemeData, error: odemeError }] = await Promise.all([
        kayitQuery,
        odemeQuery,
      ])

      if (kayitError) toast.error(`${firma.ad} borçları okunamadı: ${kayitError.message}`)
      if (odemeError) toast.error(`${firma.ad} ödemeleri okunamadı: ${odemeError.message}`)

      const toplamBorc = (kayitlar || []).reduce((sum, kayit) => sum + (Number(kayit.alinan_tutar) || 0), 0)
      const odenen = (odemeData || []).reduce((sum, item) => sum + (Number(item.odenen) || 0), 0)

      ozetler.push({
        firma_id: firma.id,
        firma_ad: firma.ad,
        toplam_borc: toplamBorc,
        odenen,
        kalan_borc: toplamBorc - odenen,
      })
    }

    setBorcOzetleri(ozetler)
    await loadOdemeHareketleri(firmaList)
  }

  async function loadOdemeHareketleri(firmaList: KargoFirma[]) {
    if (!currentSube) return

    let query = supabase
      .from("kargo_cari_odeme_hareketleri")
      .select("id, tarih, firma_id, toplam_borc, odenen, kalan_borc, notlar, created_at")
      .eq("sube_id", currentSube.id)
      .order("tarih", { ascending: false })
      .order("created_at", { ascending: false })

    if (scope === "monthly") query = query.eq("ay_yil", ayYil)

    const { data, error } = await query.limit(200)
    if (error) {
      setOdemeHareketleri([])
      if (error.code === "42P01") {
        toast.error("Ödeme hareketleri tablosu yok. 019 migration dosyasını uygulayın.")
      } else {
        toast.error("Ödeme hareketleri okunamadı: " + error.message)
      }
      return
    }

    const firmaAdlari = new Map(firmaList.map(firma => [firma.id, firma.ad]))
    setOdemeHareketleri((data || []).map(item => ({
      id: item.id,
      tarih: item.tarih,
      firma_id: item.firma_id,
      firma_ad: firmaAdlari.get(item.firma_id) || "Firma",
      toplam_borc: Number(item.toplam_borc) || 0,
      odenen: Number(item.odenen) || 0,
      kalan_borc: Number(item.kalan_borc) || 0,
      notlar: item.notlar || "",
      created_at: item.created_at,
    })))
  }

  function updateOdemeFormu(patch: Partial<OdemeFormu>) {
    const nextForm = { ...odemeFormu, ...patch }
    const isDirty = Boolean(nextForm.odenen || nextForm.notlar)
    setOdemeFormu(nextForm)
    setOdemeFormuKirli(isDirty)
    if (isDirty) {
      markDirty()
    } else {
      markClean()
    }
  }

  function handleOdemeNotuChange(hareketId: string, value: string) {
    setOdemeHareketleri(prev => prev.map(hareket => (
      hareket.id === hareketId ? { ...hareket, notlar: value } : hareket
    )))
  }

  async function saveOdemeNotu(hareketId: string, value: string) {
    const { error } = await supabase
      .from("kargo_cari_odeme_hareketleri")
      .update({ notlar: value })
      .eq("id", hareketId)

    if (error) toast.error("Ödeme notu kaydedilemedi: " + error.message)
  }

  async function getFreshDebtForFirm(firmaId: string) {
    if (!currentSube) return null

    const [{ data: kayitlar, error: kayitError }, { data: odemeler, error: odemeError }] = await Promise.all([
      supabase
        .from("kargo_cari_kayitlar")
        .select("alinan_tutar")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firmaId)
        .eq("ay_yil", ayYil),
      supabase
        .from("kargo_cari_odemeler")
        .select("odenen")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firmaId)
        .eq("ay_yil", ayYil),
    ])

    if (kayitError) throw kayitError
    if (odemeError) throw odemeError

    const toplamBorc = (kayitlar || []).reduce((sum, kayit) => sum + (Number(kayit.alinan_tutar) || 0), 0)
    const odenen = (odemeler || []).reduce((sum, odeme) => sum + (Number(odeme.odenen) || 0), 0)
    return { toplamBorc, odenen, kalanBorc: toplamBorc - odenen }
  }

  async function saveYeniOdeme() {
    if (!odemeFormuKirli && !odemeFormu.odenen) return true
    if (scope !== "monthly") {
      toast.error("Ödeme girmek için aylık görünümü seçin.")
      return false
    }

    const amount = Number(odemeFormu.odenen) || 0
    if (!odemeFormu.firmaId) {
      toast.error("Ödeme için firma seçin.")
      return false
    }
    if (!odemeFormu.tarih) {
      toast.error("Ödeme tarihi seçin.")
      return false
    }
    if (amount <= 0) {
      toast.error("Ödenen tutar 0'dan büyük olmalı.")
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
      const freshDebt = await getFreshDebtForFirm(odemeFormu.firmaId)
      if (!freshDebt) throw new Error("Firma borcu hesaplanamadı.")
      if (freshDebt.kalanBorc <= 0) {
        throw new Error("Bu firmanın ödenecek borcu kalmamış.")
      }
      if (amount > freshDebt.kalanBorc) {
        throw new Error(`Ödeme kalan borçtan büyük olamaz. Güncel kalan borç: ${formatNumber(freshDebt.kalanBorc)} TL`)
      }

      const yeniToplamOdeme = freshDebt.odenen + amount
      const yeniKalanBorc = freshDebt.toplamBorc - yeniToplamOdeme

      const { error: odemeError } = await supabase
        .from("kargo_cari_odemeler")
        .upsert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: odemeFormu.firmaId,
          ay_yil: ayYil,
          odenen: yeniToplamOdeme,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "sube_id,firma_id,ay_yil",
        })

      if (odemeError) throw odemeError

      const { error: hareketError } = await supabase
        .from("kargo_cari_odeme_hareketleri")
        .insert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: odemeFormu.firmaId,
          ay_yil: ayYil,
          tarih: odemeFormu.tarih,
          toplam_borc: freshDebt.kalanBorc,
          odenen: amount,
          kalan_borc: yeniKalanBorc,
          notlar: odemeFormu.notlar.trim(),
        })

      if (hareketError) throw hareketError

      setOdemeFormu(prev => ({ ...prev, odenen: "", notlar: "" }))
      setOdemeFormuKirli(false)
      markClean()
      await loadBorcOzetleri(firmalar)
      toast.success("Ödeme kaydedildi ve borçtan düşüldü.")
      setSaving(false)
      return true
    } catch (error: any) {
      const message = error?.message || "Ödeme kaydedilemedi."
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

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
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
      }, {
        title: "Ödeme Hareketleri",
        headers: ["Tarih", "Firma", "Güncel Borç", "Ödenen", "Kalan Borç", "Not"],
        firstColumnWidth: "18%",
        rows: odemeHareketleri.map(hareket => [
          formatDate(hareket.tarih),
          hareket.firma_ad,
          `${formatNumber(hareket.toplam_borc)} TL`,
          `${formatNumber(hareket.odenen)} TL`,
          `${formatNumber(hareket.kalan_borc)} TL`,
          hareket.notlar || "-",
        ]),
      }],
    })
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">Erişim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kargo Cari Borç Özeti</h1>
          <p className="mt-1 text-muted-foreground">
            {scope === "monthly" ? `${month} ${year} borç ve ödeme durumu` : "Tüm firmaların borç durumu"}
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
          {scope === "monthly" ? (
            <>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-full sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(item => <SelectItem key={item} value={item.toString()}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          ) : null}
          <Button onClick={exportBorcPdf} variant="outline" className="gap-2" disabled={borcOzetleri.length === 0}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/15">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-200">Toplam Borç</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-100">{formatNumber(genelToplam.toplam_borc)} <span className="text-base font-normal">TL</span></p>
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
                <p className="text-2xl font-bold text-green-700 dark:text-green-100">{formatNumber(genelToplam.odenen)} <span className="text-base font-normal">TL</span></p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-500/20">
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={genelToplam.kalan_borc > 0 ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/15"}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`mb-1 text-sm font-medium ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>Kalan Borç</p>
                <p className={`text-2xl font-bold ${genelToplam.kalan_borc > 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{formatNumber(genelToplam.kalan_borc)} <span className="text-base font-normal">TL</span></p>
              </div>
              <div className={`rounded-full p-3 ${genelToplam.kalan_borc > 0 ? "bg-red-100 dark:bg-red-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"}`}>
                <Wallet className={`h-6 w-6 ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-cyan-100 shadow-sm dark:border-cyan-500/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-cyan-500" />
            Firma Bazlı Borç Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {borcOzetleri.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Henüz firma veya borç kaydı yok.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {borcOzetleri.map(ozet => {
                const percent = ozet.toplam_borc > 0 ? Math.min(100, Math.max(0, (ozet.odenen / ozet.toplam_borc) * 100)) : 0
                return (
                  <div key={ozet.firma_id} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold text-foreground">{ozet.firma_ad}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Ödeme oranı %{percent.toFixed(0)}</p>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${ozet.kalan_borc > 0 ? "bg-orange-500/10 text-orange-700 dark:text-orange-200" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"}`}>
                        {ozet.kalan_borc > 0 ? "Borç var" : "Kapandı"}
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                      <div className="rounded-md bg-blue-500/10 p-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Toplam</p>
                        <p className="mt-1 font-bold text-blue-700 dark:text-blue-200">{formatNumber(ozet.toplam_borc)} TL</p>
                      </div>
                      <div className="rounded-md bg-emerald-500/10 p-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Ödenen</p>
                        <p className="mt-1 font-bold text-emerald-700 dark:text-emerald-200">{formatNumber(ozet.odenen)} TL</p>
                      </div>
                      <div className="rounded-md bg-orange-500/10 p-2">
                        <p className="text-[11px] font-semibold text-muted-foreground">Kalan</p>
                        <p className="mt-1 font-bold text-orange-700 dark:text-orange-200">{formatNumber(ozet.kalan_borc)} TL</p>
                      </div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-emerald-100 shadow-sm dark:border-emerald-500/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            Ödeme Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="sticky-table-scroll">
            <table className="sticky-table w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="p-3 text-left font-semibold text-foreground">FİRMA</th>
                  <th className="p-3 text-right font-semibold text-blue-700 dark:text-blue-200">GÜNCEL BORÇ</th>
                  <th className="p-3 text-left font-semibold text-foreground">ÖDEME TARİHİ</th>
                  <th className="p-3 text-right font-semibold text-emerald-700 dark:text-emerald-200">ÖDENEN</th>
                  <th className="p-3 text-right font-semibold text-orange-700 dark:text-orange-200">KALAN BORÇ</th>
                  <th className="p-3 text-left font-semibold text-foreground">NOT</th>
                  <th className="p-3 text-right font-semibold text-foreground">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">
                    <Select value={odemeFormu.firmaId} onValueChange={(value) => updateOdemeFormu({ firmaId: value })} disabled={scope !== "monthly"}>
                      <SelectTrigger className="h-10 min-w-60">
                        <SelectValue placeholder="Firma seç" />
                      </SelectTrigger>
                      <SelectContent>
                        {firmalar.map(firma => <SelectItem key={firma.id} value={firma.id}>{firma.ad}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right font-bold text-blue-700 dark:text-blue-200">
                    {formatNumber(selectedOzet?.kalan_borc || 0)} TL
                  </td>
                  <td className="p-3">
                    <ModernDatePicker
                      label="Ödeme tarihi"
                      value={odemeFormu.tarih}
                      onChange={(value) => updateOdemeFormu({ tarih: value })}
                      disabled={scope !== "monthly"}
                      buttonClassName="h-10 rounded-md"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={odemeFormu.odenen}
                      onChange={(event) => updateOdemeFormu({ odenen: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="ml-auto h-10 w-36 text-right font-semibold"
                      placeholder="0.00"
                    />
                  </td>
                  <td className={`p-3 text-right font-bold ${formKalanBorc > 0 ? "text-orange-600 dark:text-orange-200" : "text-emerald-600 dark:text-emerald-200"}`}>
                    {formatNumber(formKalanBorc)} TL
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      value={odemeFormu.notlar}
                      onChange={(event) => updateOdemeFormu({ notlar: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="h-10 min-w-60"
                      placeholder="Not yaz..."
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button onClick={saveYeniOdeme} disabled={saving || scope !== "monthly"} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Ödemeyi Kaydet
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {scope !== "monthly" ? (
            <div className="border-t bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-200">
              Ödeme girmek için aylık görünümü seçin.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-700">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="h-5 w-5 text-slate-500" />
            Ödeme Hareketleri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {odemeHareketleri.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">Bu dönem için kayıtlı ödeme hareketi yok.</div>
          ) : (
            <div className="sticky-table-scroll">
              <table className="sticky-table w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/60">
                    <th className="p-3 text-left font-semibold text-foreground">TARİH</th>
                    <th className="p-3 text-left font-semibold text-foreground">FİRMA</th>
                    <th className="p-3 text-right font-semibold text-blue-700 dark:text-blue-200">GÜNCEL BORÇ</th>
                    <th className="p-3 text-right font-semibold text-emerald-700 dark:text-emerald-200">ÖDENEN</th>
                    <th className="p-3 text-right font-semibold text-orange-700 dark:text-orange-200">KALAN BORÇ</th>
                    <th className="p-3 text-left font-semibold text-foreground">NOT</th>
                  </tr>
                </thead>
                <tbody>
                  {odemeHareketleri.map(hareket => (
                    <tr key={hareket.id} className="border-b transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-500/10">
                      <td className="p-4 font-medium text-muted-foreground">{formatDate(hareket.tarih)}</td>
                      <td className="p-4 font-semibold text-foreground">{hareket.firma_ad}</td>
                      <td className="p-4 text-right font-semibold text-blue-700 dark:text-blue-200">{formatNumber(hareket.toplam_borc)} TL</td>
                      <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-200">{formatNumber(hareket.odenen)} TL</td>
                      <td className={`p-4 text-right font-bold ${hareket.kalan_borc > 0 ? "text-orange-600 dark:text-orange-200" : "text-emerald-600 dark:text-emerald-200"}`}>{formatNumber(hareket.kalan_borc)} TL</td>
                      <td className="p-3">
                        <Input
                          type="text"
                          value={hareket.notlar || ""}
                          onChange={(event) => handleOdemeNotuChange(hareket.id, event.target.value)}
                          onBlur={(event) => saveOdemeNotu(hareket.id, event.target.value)}
                          className="h-10 min-w-56"
                          placeholder="Not yaz..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
