"use client"

import { useEffect, useState } from "react"
import { ChevronLeft, ChevronRight, Coins, Save, Users, Wallet } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useSube } from "@/contexts/sube-context"
import { MONTHS } from "@/lib/date-navigation"

interface Personel {
  id: string
  ad: string
  aktif: boolean
  isten_cikis_tarihi?: string | null
}

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function KargoPrimPage() {
  const currentYear = new Date().getFullYear()
  const startYear = 2026
  const [year, setYear] = useState(Math.max(startYear, currentYear))
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [toplamCiro, setToplamCiro] = useState<string>("")
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const { currentSube, isAdmin } = useSube()
  const ayYil = `${month}-${year}`

  const years = Array.from({ length: 10 }, (_, i) => startYear + i)

  useEffect(() => {
    if (currentSube) loadData()
  }, [currentSube?.id, ayYil])

  async function loadData() {
    if (!currentSube) return
    setLoading(true)

    const [personelRes, primRes] = await Promise.all([
      supabase
        .from("personeller")
        .select("id, ad, aktif")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("kargo_prim_kayitlari")
        .select("*")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .maybeSingle(),
    ])

    const activePersonelList = personelRes.data || []
    setPersoneller(activePersonelList)

    if (primRes.data) {
      setToplamCiro(String(primRes.data.toplam_ciro || ""))
    } else {
      setToplamCiro("")
    }

    setLoading(false)
  }

  // Formula Calculations based on PK KARGO HESAP.xlsx
  const ciroNum = Number(toplamCiro) || 0
  const kdvSizTutar = ciroNum > 0 ? ciroNum / 1.2 : 0
  const sigorta = kdvSizTutar > 0 ? kdvSizTutar / 6 : 0
  const kdvSigortasizTutar = Math.max(0, kdvSizTutar - sigorta)
  const firmaHakedis = kdvSigortasizTutar * 0.40
  const isciHakedis = kdvSigortasizTutar * 0.05
  const faturaKesilecekTutar = firmaHakedis * 1.2
  const activeCount = personeller.length
  const personelBasinaHakedis = activeCount > 0 ? isciHakedis / activeCount : 0

  async function handleSave() {
    if (!currentSube) return
    setSaving(true)

    const monthIndex = MONTHS.indexOf(month) + 1
    const tarih = `${year}-${String(monthIndex).padStart(2, "0")}-01`

    const payload = {
      sube_id: currentSube.id,
      tarih,
      ay_yil: ayYil,
      toplam_ciro: ciroNum,
      personel_sayisi: activeCount,
      isci_hakedis: isciHakedis,
      personel_hakedis: personelBasinaHakedis,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("kargo_prim_kayitlari")
      .upsert(payload, { onConflict: "sube_id,ay_yil" })

    setSaving(false)

    if (error) {
      toast.error("Kargo prim kaydedilemedi: " + error.message)
    } else {
      toast.success(`${month} ${year} Kargo prim hesaplaması kaydedildi ve maaşlara yansıtıldı.`)
      loadData()
    }
  }

  const prevMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > startYear) {
        setMonth(MONTHS[11])
        setYear(year - 1)
      }
    } else {
      setMonth(MONTHS[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 11) {
      setYear(year + 1)
      setMonth(MONTHS[0])
    } else {
      setMonth(MONTHS[currentIndex + 1])
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 icon-sway-container cursor-pointer">
            <Coins className="h-6 w-6 icon-sway" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kargo Prim Hesaplama</h1>
            <p className="text-sm text-muted-foreground">
              Aylık kargo toplam cirosuna göre otomatik firma ve işçi hakediş hesaplama tablosu.
            </p>
          </div>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={String(year)} onValueChange={val => setYear(Number(val))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Calculation Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Input Card */}
        <Card className="border-emerald-500/30 bg-emerald-500/5 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-5 w-5" />
              Girdi Bilgileri ({month} {year})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Toplam Ciro (₺)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={toplamCiro}
                onChange={e => setToplamCiro(e.target.value)}
                placeholder="Örn: 885800"
                className="h-12 text-lg font-bold"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Bu aya ait toplam kargo cirosunu yazınız. Diğer tüm değerler otomatik hesaplanır.
              </p>
            </div>

            <div className="rounded-lg bg-background/80 p-3 border text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Aktif Personel Sayısı:</span>
                <span className="font-bold">{activeCount} kişi</span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-1 border-t">
                <span>Personel Başına Prim:</span>
                <span>{formatMoney(personelBasinaHakedis)} ₺</span>
              </div>
            </div>

            {isAdmin && (
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base font-medium shadow"
              >
                <Save className="h-4 w-4" />
                {saving ? "Kaydediliyor..." : "Kaydet ve Maaşlara Yansıt"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Calculated Metrics Breakdown */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Formül ve Hakediş Detayları ({month} {year})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">K.D.V'siz Tutar (%20 KDV)</span>
                <div className="text-xl font-bold">{formatMoney(kdvSizTutar)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: Toplam Ciro / 1.20</div>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">Sigorta Tutarı</span>
                <div className="text-xl font-bold">{formatMoney(sigorta)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: KDV'siz Tutar / 6</div>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1">
                <span className="text-xs text-muted-foreground">K.D.V Sigortasız Net Tutar</span>
                <div className="text-xl font-bold">{formatMoney(kdvSigortasizTutar)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: KDV'siz Tutar - Sigorta</div>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1 bg-blue-500/5 border-blue-500/20">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Firma Hakediş (%40)</span>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatMoney(firmaHakedis)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: Net Tutar x %40</div>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1 bg-amber-500/5 border-amber-500/20">
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Fatura Kesilecek Tutar (KDV Dahil)</span>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatMoney(faturaKesilecekTutar)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: Firma Hakediş x 1.20</div>
              </div>

              <div className="rounded-lg border p-3.5 space-y-1 bg-emerald-500/10 border-emerald-500/30">
                <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">Toplam İşçi Hakediş (%5)</span>
                <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(isciHakedis)} ₺</div>
                <div className="text-[11px] text-muted-foreground">Formül: Net Tutar x %5</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Personnel Distribution Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-emerald-600" />
            Personel Dağılım Listesi ({month} {year})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {personeller.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aktif personel bulunamadı. Genel Ayarlar sayfasından personel ekleyebilirsiniz.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-3">Personel Adı</th>
                    <th className="p-3">Dağıtım Oranı</th>
                    <th className="p-3 text-right">Maaşa Yansıyacak Hakediş ({month} Ayı)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {personeller.map(p => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{p.ad}</td>
                      <td className="p-3 text-muted-foreground">Eşit Pay (1/{activeCount})</td>
                      <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatMoney(personelBasinaHakedis)} ₺
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/50 font-bold border-t">
                  <tr>
                    <td className="p-3" colSpan={2}>Toplam Dağıtılan İşçi Hakedişi:</td>
                    <td className="p-3 text-right text-emerald-700 dark:text-emerald-300">
                      {formatMoney(isciHakedis)} ₺
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
