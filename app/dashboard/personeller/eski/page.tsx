"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isTestPersonnel } from "@/lib/utils/test-personnel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, CreditCard, FileSearch, UserX, Wallet, ArrowLeft, Printer, Sparkles, Scissors, CheckCircle2, Building2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { openPdfReport } from "@/lib/pdf-report"
import { useRouter } from "next/navigation"

interface Personel {
  id: string
  ad: string
  aktif: boolean
  aylik_maas?: number
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
  sube_id?: string
}

interface AvansEntry {
  tarih: string
  subeAd: string
  tutar: number
  aciklama: string
}

interface MaasOnayEntry {
  ay_yil: string
  subeAd: string
  bankaya_gonderilen: number
  kalan_nakit: number
  nakit_odeme_tarihi?: string | null
}

function formatDate(val?: string | null) {
  if (!val) return "-"
  const [y, m, d] = val.split("-")
  if (!y || !m || !d) return val
  return `${d}.${m}.${y}`
}

function formatMoney(amount: number) {
  return amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function normalizeName(value: string | null | undefined) {
  const str = String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
  if (str.includes("FATMAGÜL KARAKAYA") || str.includes("FATMA GÜL KARAKAYA") || str.includes("FATMA GÜL DURANAY")) {
    return "FATMA GÜL DURANAY"
  }
  return str
}

function formatSeniority(iseGirisTarihi?: string | null, istenCikisTarihi?: string | null): string {
  if (!iseGirisTarihi) return "Giriş tarihi belirtilmemiş"
  const start = new Date(iseGirisTarihi)
  if (isNaN(start.getTime())) return "-"
  const end = istenCikisTarihi ? new Date(istenCikisTarihi) : new Date()

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0).getDate()
    days += prevMonthEnd
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) parts.push(`${years} yıl`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0 || parts.length === 0) parts.push(`${days} gün`)

  return `${parts.join(" ")} çalıştı`
}

export default function EskiPersonellerPage() {
  const supabase = createClient()
  const router = useRouter()
  const { currentSube, subeler } = useSube()
  const [exitedPersoneller, setExitedPersoneller] = useState<Personel[]>([])
  const [selectedPersonel, setSelectedPersonel] = useState<Personel | null>(null)
  const [advancesHistory, setAdvancesHistory] = useState<AvansEntry[]>([])
  const [maasOnayHistory, setMaasOnayHistory] = useState<MaasOnayEntry[]>([])
  const [kesintilerHistory, setKesintilerHistory] = useState<any[]>([])
  const [ilavelerHistory, setIlavelerHistory] = useState<any[]>([])
  const [bilgiFormuData, setBilgiFormuData] = useState<any | null>(null)
  const [totalAdvanceSum, setTotalAdvanceSum] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadExitedPersoneller()
  }, [currentSube?.id])

  useEffect(() => {
    if (selectedPersonel) {
      loadPersonelHistory(selectedPersonel)
    }
  }, [selectedPersonel?.id])

  async function loadExitedPersoneller() {
    setLoading(true)
    const { data } = await supabase
      .from("personeller")
      .select("*")
      .order("sira")

    if (data) {
      const exited = data.filter(p => {
        if (isTestPersonnel(p)) return false
        return !p.aktif || Boolean(p.isten_cikis_tarihi)
      })
      setExitedPersoneller(exited)
      if (exited.length > 0 && !selectedPersonel) {
        setSelectedPersonel(exited[0])
      }
    }
    setLoading(false)
  }

  async function loadPersonelHistory(personel: Personel) {
    const subeMap = new Map(subeler.map(s => [s.id, s.ad]))
    const pNameNorm = normalizeName(personel.ad)

    // 1. Fetch all gider_kayitlari across all branches to extract advances taken by this personnel
    const [giderRes, avansRes, onayRes, kesintiRes, ilaveRes, bilgiRes] = await Promise.all([
      supabase.from("gider_kayitlari").select("*").order("tarih", { ascending: false }),
      supabase.from("avans_talepleri").select("*").eq("durum", "onaylandi").order("created_at", { ascending: false }),
      supabase.from("maas_onaylari").select("*").eq("personel_id", personel.id).order("ay_yil", { ascending: false }),
      supabase.from("maas_kesintileri").select("*").eq("personel_id", personel.id).order("tarih", { ascending: false }),
      supabase.from("maas_ilaveleri").select("*").eq("personel_id", personel.id).order("tarih", { ascending: false }),
      supabase.from("personel_bilgi_formlari").select("*").eq("personel_id", personel.id).maybeSingle(),
    ])

    const history: AvansEntry[] = []

    if (giderRes.data) {
      giderRes.data.forEach(row => {
        if (row.personel_paylari) {
          Object.entries(row.personel_paylari).forEach(([k, v]) => {
            const val = Number(v)
            if (val > 0) {
              const kNorm = normalizeName(k)
              const isMatch =
                k === personel.id ||
                kNorm === pNameNorm ||
                (kNorm && pNameNorm && (kNorm.includes(pNameNorm) || pNameNorm.includes(kNorm)))

              if (isMatch) {
                history.push({
                  tarih: row.tarih,
                  subeAd: subeMap.get(row.sube_id) || "Şube",
                  tutar: val,
                  aciklama: `Gider Tablosu Avansı (${row.ay_yil || "Avans"})`,
                })
              }
            }
          })
        }
      })
    }

    if (avansRes.data) {
      avansRes.data.forEach(req => {
        const reqName = normalizeName(req.user_name)
        const isMatch =
          req.tc_kimlik === personel.id ||
          (reqName && pNameNorm && (reqName === pNameNorm || reqName.includes(pNameNorm) || pNameNorm.includes(reqName)))

        if (isMatch) {
          history.push({
            tarih: req.odeme_tarihi || (req.created_at ? req.created_at.split("T")[0] : ""),
            subeAd: "Avans Talepleri Sistemi",
            tutar: Number(req.tutar || 0),
            aciklama: req.aciklama || "Onaylı Avans Talebi",
          })
        }
      })
    }

    history.sort((a, b) => b.tarih.localeCompare(a.tarih))
    setAdvancesHistory(history)
    setTotalAdvanceSum(history.reduce((sum, h) => sum + h.tutar, 0))

    if (onayRes.data) {
      setMaasOnayHistory(
        onayRes.data.map(item => ({
          ay_yil: item.ay_yil,
          subeAd: subeMap.get(item.sube_id) || "Şube",
          bankaya_gonderilen: Number(item.bankaya_gonderilen || 0),
          kalan_nakit: Number(item.kalan_nakit || 0),
          nakit_odeme_tarihi: item.nakit_odeme_tarihi,
        }))
      )
    } else {
      setMaasOnayHistory([])
    }

    setKesintilerHistory(kesintiRes.data || [])
    setIlavelerHistory(ilaveRes.data || [])
    setBilgiFormuData(bilgiRes.data || null)
  }

  function exportHistoryPdf() {
    if (!selectedPersonel) return

    openPdfReport({
      title: `${selectedPersonel.ad} - Eski Personel Arşiv Raporu`,
      subtitle: `${currentSube?.ad || ""} · İşten Ayrılan Personel Tüm Detayları`,
      orientation: "portrait",
      metrics: [
        { label: "İşe Giriş Tarihi", value: formatDate(selectedPersonel.ise_giris_tarihi), side: "left", color: "green" },
        { label: "İşten Çıkış Tarihi", value: formatDate(selectedPersonel.isten_cikis_tarihi), side: "left", color: "red" },
        { label: "Toplam Çalışma Süresi", value: formatSeniority(selectedPersonel.ise_giris_tarihi, selectedPersonel.isten_cikis_tarihi), side: "right", color: "black" },
        { label: "Toplam Alınan Avans", value: `${formatMoney(totalAdvanceSum)} TL`, side: "right", color: "red" },
      ],
      tables: [
        {
          title: "TÜM GEÇMİŞ AVANSLAR DETAYI",
          headers: ["Tarih", "Şube", "Açıklama", "Tutar"],
          firstColumnWidth: "22%",
          rows: advancesHistory.map(item => [
            formatDate(item.tarih),
            item.subeAd,
            item.aciklama,
            `-${formatMoney(item.tutar)} TL`,
          ]),
        },
        ...(maasOnayHistory.length > 0 ? [{
          title: "GEÇMİŞ MAAŞ VE ÖDEME ONAYLARI",
          headers: ["Dönem", "Şube", "Bankaya Gönderilen", "Ödenen Nakit", "Nakit Ödeme Tarihi"],
          firstColumnWidth: "20%",
          rows: maasOnayHistory.map(item => [
            item.ay_yil,
            item.subeAd,
            `${formatMoney(item.bankaya_gonderilen)} TL`,
            `${formatMoney(item.kalan_nakit)} TL`,
            formatDate(item.nakit_odeme_tarihi),
          ]),
        }] : []),
      ],
    })
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-xl">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Eski Personeller Arşivi</h1>
            <p className="text-xs text-muted-foreground">İşten ayrılan personellerin çalışma süresi, geçmiş tüm avansları, maaş hakedişleri ve bilgi formları</p>
          </div>
        </div>

        {selectedPersonel && (
          <div className="flex items-center gap-2">
            <Button onClick={exportHistoryPdf} variant="outline" className="h-10 text-xs gap-1.5 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 font-bold">
              <Printer className="w-4 h-4" /> Arşiv PDF İndir
            </Button>
            <Button onClick={() => router.push(`/dashboard/personeller/bilgi`)} variant="outline" className="h-10 text-xs gap-1.5 font-bold">
              <FileSearch className="w-4 h-4 text-sky-500" /> Bilgi Formuna Git
            </Button>
          </div>
        )}
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Exited Personnel List */}
        <Card className="border shadow-sm lg:col-span-1">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <UserX className="w-4 h-4 text-rose-600" />
              Ayrılan Personeller ({exitedPersoneller.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            {exitedPersoneller.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Kayıtlı eski/ayrılan personel bulunmuyor.
              </div>
            ) : (
              <div className="space-y-2 max-h-[650px] overflow-y-auto pr-1">
                {exitedPersoneller.map(p => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPersonel(p)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedPersonel?.id === p.id
                        ? "border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm"
                        : "border-border bg-card hover:bg-accent/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-foreground">{p.ad}</span>
                      <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[10px] px-2 py-0.5">
                        Ayrıldı
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Çıkış: {formatDate(p.isten_cikis_tarihi)}</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {formatSeniority(p.ise_giris_tarihi, p.isten_cikis_tarihi)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Side: Selected Personnel Full History Details */}
        <div className="lg:col-span-2 space-y-6">
          {selectedPersonel ? (
            <>
              {/* Summary Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card className="border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="p-4">
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 block mb-1">İşe Giriş Tarihi</span>
                    <span className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100">
                      {formatDate(selectedPersonel.ise_giris_tarihi)}
                    </span>
                  </CardContent>
                </Card>

                <Card className="border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800">
                  <CardContent className="p-4">
                    <span className="text-xs font-semibold text-rose-800 dark:text-rose-300 block mb-1">İşten Çıkış Tarihi</span>
                    <span className="text-lg font-extrabold text-rose-900 dark:text-rose-100">
                      {formatDate(selectedPersonel.isten_cikis_tarihi)}
                    </span>
                  </CardContent>
                </Card>

                <Card className="border bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800">
                  <CardContent className="p-4">
                    <span className="text-xs font-semibold text-sky-800 dark:text-sky-300 block mb-1">Toplam Çalışma Süresi</span>
                    <span className="text-sm font-extrabold text-sky-900 dark:text-sky-100 block mt-1">
                      {formatSeniority(selectedPersonel.ise_giris_tarihi, selectedPersonel.isten_cikis_tarihi)}
                    </span>
                  </CardContent>
                </Card>
              </div>

              {/* SECTION 1: Advances History Table */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-rose-600" />
                      Tüm Geçmiş Avanslar Dökümü ({advancesHistory.length} İşlem)
                    </CardTitle>
                    <CardDescription className="text-xs">Çalıştığı süre boyunca tüm şubelerden aldığı avanslar</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-muted-foreground block">Toplam Avans</span>
                    <span className="text-base font-extrabold text-rose-600 dark:text-rose-400">-{formatMoney(totalAdvanceSum)} TL</span>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {advancesHistory.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      Bu personele ait geçmiş avans kaydı bulunamadı.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-bold text-muted-foreground uppercase">
                          <tr>
                            <th className="p-3">Tarih</th>
                            <th className="p-3">Kaynak / Şube</th>
                            <th className="p-3">Açıklama</th>
                            <th className="p-3 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {advancesHistory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-semibold">{formatDate(item.tarih)}</td>
                              <td className="p-3">
                                <Badge variant="outline" className="text-[10px] font-semibold">
                                  {item.subeAd}
                                </Badge>
                              </td>
                              <td className="p-3 text-muted-foreground">{item.aciklama}</td>
                              <td className="p-3 text-right font-bold text-rose-600 dark:text-rose-400">
                                -{formatMoney(item.tutar)} TL
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SECTION 2: Salary Payouts & Approvals History */}
              <Card className="border shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/20">
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Geçmiş Maaş Ödeme ve Onay Kayıtları ({maasOnayHistory.length} Dönem)
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {maasOnayHistory.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground">
                      Geçmiş dönem maaş onay kaydı bulunmuyor.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-muted-foreground uppercase">
                          <tr>
                            <th className="p-3">Maaş Dönemi</th>
                            <th className="p-3">Şube</th>
                            <th className="p-3 text-right">Bankaya Gönderilen</th>
                            <th className="p-3 text-right">Ödenen Nakit</th>
                            <th className="p-3 text-right">Ödeme Tarihi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {maasOnayHistory.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/20 transition-colors">
                              <td className="p-3 font-bold">{item.ay_yil}</td>
                              <td className="p-3">{item.subeAd}</td>
                              <td className="p-3 text-right font-semibold text-blue-600">{formatMoney(item.bankaya_gonderilen)} TL</td>
                              <td className="p-3 text-right font-bold text-emerald-600">{formatMoney(item.kalan_nakit)} TL</td>
                              <td className="p-3 text-right text-muted-foreground">{formatDate(item.nakit_odeme_tarihi)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SECTION 3: Personel Bilgi Formu Quick Summary */}
              {bilgiFormuData && (
                <Card className="border border-sky-200 dark:border-sky-900 bg-sky-50/20 dark:bg-sky-950/10 shadow-sm">
                  <CardHeader className="pb-3 border-b bg-sky-50/50 dark:bg-sky-900/20 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-sky-900 dark:text-sky-200">
                      <FileSearch className="w-4 h-4 text-sky-600" />
                      Kayıtlı İş Talep ve Bilgi Formu Özeti
                    </CardTitle>
                    <Button onClick={() => router.push(`/dashboard/personeller/bilgi`)} variant="ghost" size="sm" className="h-7 text-xs text-sky-700 font-bold">
                      Formun Tamamını Gör ➔
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground block">T.C. Kimlik No:</span>
                      <span className="font-bold text-foreground">{bilgiFormuData.tc_kimlik_no || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Cep Telefonu:</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-300">{bilgiFormuData.cep_telefon || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Medeni Durum / Çocuk:</span>
                      <span className="font-bold text-foreground">{bilgiFormuData.medeni_durumu || "-"} ({bilgiFormuData.cocuk_sayisi || "0"} çocuk)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Talep Edilen Görev:</span>
                      <span className="font-bold text-sky-700 dark:text-sky-300">{bilgiFormuData.talep_edilen_gorev || "-"}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-16 bg-card rounded-2xl border text-muted-foreground text-xs">
              Lütfen soldaki listeden detaylarını görmek istediğiniz eski personeli seçin.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
