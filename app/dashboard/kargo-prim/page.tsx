"use client"

import { useEffect, useState } from "react"
import { Check, ChevronLeft, ChevronRight, Coins, Save, ShieldAlert, Users, Wallet } from "lucide-react"
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
  const [seciliPersonelIds, setSeciliPersonelIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const { currentSube, isAdmin } = useSube()
  const ayYil = `${month}-${year}`

  const years = Array.from({ length: 10 }, (_, i) => startYear + i)

  useEffect(() => {
    if (currentSube) loadData()
  }, [currentSube?.id, ayYil])

  if (!isAdmin && !loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-center p-6">
        <ShieldAlert className="h-14 w-14 text-destructive animate-pulse" />
        <h2 className="text-2xl font-black">Erişim Engellendi 🔒</h2>
        <p className="max-w-md text-sm text-muted-foreground font-medium">
          Kargo Prim Hakediş sayfası <strong>sadece Yöneticiler (Admin) ve Developer</strong> hesaplarına özeldir.
        </p>
      </div>
    )
  }

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
      if (Array.isArray(primRes.data.secili_personeller)) {
        setSeciliPersonelIds(primRes.data.secili_personeller)
      } else {
        setSeciliPersonelIds(activePersonelList.map(p => p.id))
      }
    } else {
      setToplamCiro("")
      setSeciliPersonelIds(activePersonelList.map(p => p.id))
    }

    setLoading(false)
  }

  const togglePersonelSelection = (id: string) => {
    setSeciliPersonelIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const selectAllPersonel = () => {
    setSeciliPersonelIds(personeller.map(p => p.id))
  }

  const deselectAllPersonel = () => {
    setSeciliPersonelIds([])
  }

  // Formula Calculations based on PK KARGO HESAP.xlsx
  const ciroNum = Number(toplamCiro) || 0
  const kdvSizTutar = ciroNum > 0 ? ciroNum / 1.2 : 0
  const sigorta = kdvSizTutar > 0 ? kdvSizTutar / 6 : 0
  const kdvSigortasizTutar = Math.max(0, kdvSizTutar - sigorta)
  const firmaHakedis = kdvSigortasizTutar * 0.40
  const isciHakedis = kdvSigortasizTutar * 0.05
  const faturaKesilecekTutar = firmaHakedis * 1.2
  const totalActiveCount = personeller.length
  const selectedCount = seciliPersonelIds.length
  const personelBasinaHakedis = selectedCount > 0 ? isciHakedis / selectedCount : 0

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
      personel_sayisi: selectedCount,
      isci_hakedis: isciHakedis,
      personel_hakedis: personelBasinaHakedis,
      secili_personeller: seciliPersonelIds,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from("kargo_prim_kayitlari")
      .upsert(payload, { onConflict: "sube_id,ay_yil" })

    setSaving(false)

    if (error) {
      toast.error("Kargo prim kaydedilemedi: " + error.message)
    } else {
      toast.success(`${month} ${year} Kargo prim hesaplaması (${selectedCount} personel seçili) kaydedildi ve maaşlara yansıtıldı.`)
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
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-3 bg-emerald-700 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Coins className="h-6 w-6 transition-transform duration-300 hover:rotate-12 hover:scale-110" />
          <h1 className="text-xl font-bold">Kargo Prim Hesaplama</h1>
        </div>
        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-emerald-800">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(item => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(item => (
                <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-emerald-800">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-4">
        {/* Input & Key Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1 border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-emerald-800 dark:text-emerald-200">
                {month} {year} Ciro Girişi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Toplam Ciro (TL)</label>
                <div className="relative">
                  <Input
                    type="number"
                    value={toplamCiro}
                    onChange={(e) => setToplamCiro(e.target.value)}
                    placeholder="Örn: 254500"
                    className="h-11 font-bold text-lg pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-muted-foreground font-bold">₺</span>
                </div>
              </div>

              {isAdmin && (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 font-semibold gap-2 shadow"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Hesaplamayı Kaydet & Onayla"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hesaplama Özeti</CardTitle>
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
                  <div className="text-[11px] text-muted-foreground">Seçili {selectedCount} Kişiye Dağıtılır</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Personnel Distribution Table */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-emerald-600" />
              Personel Dağılım Listesi ({month} {year})
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                Seçili: {selectedCount} / {totalActiveCount} Personel
              </span>
              <Button variant="outline" size="sm" onClick={selectAllPersonel} className="h-8 text-xs">
                Tümünü Seç
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAllPersonel} className="h-8 text-xs text-muted-foreground">
                Temizle
              </Button>
            </div>
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
                      <th className="p-3 w-12 text-center">Seç</th>
                      <th className="p-3">Personel Adı</th>
                      <th className="p-3">Dağıtım Oranı</th>
                      <th className="p-3 text-right">Maaşa Yansıyacak Hakediş ({month} Ayı)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {personeller.map(p => {
                      const isSelected = seciliPersonelIds.includes(p.id)
                      return (
                        <tr key={p.id} className={`transition-colors ${isSelected ? "bg-card hover:bg-muted/30" : "bg-muted/20 opacity-60 hover:opacity-80"}`}>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => togglePersonelSelection(p.id)}
                              className={`mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                                isSelected
                                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-500"
                                  : "border-input bg-background hover:bg-muted text-transparent"
                              }`}
                              title={isSelected ? "Primi Kaldır" : "Prime Dahil Et"}
                            >
                              <Check className="h-4 w-4 stroke-[3]" />
                            </button>
                          </td>
                          <td className="p-3 font-semibold">
                            {p.ad}
                            {!isSelected && <span className="ml-2 text-xs font-normal text-muted-foreground">(Dahil Edilmedi)</span>}
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {isSelected ? `Eşit Pay (1/${selectedCount})` : "0 Pay"}
                          </td>
                          <td className={`p-3 text-right font-bold ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {isSelected ? `${formatMoney(personelBasinaHakedis)} ₺` : "0,00 ₺"}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-muted/50 font-bold border-t">
                    <tr>
                      <td className="p-3 text-center font-normal text-xs text-muted-foreground">{selectedCount}/{totalActiveCount}</td>
                      <td className="p-3" colSpan={2}>Toplam Dağıtılan İşçi Hakedişi:</td>
                      <td className="p-3 text-right text-emerald-700 dark:text-emerald-300">
                        {formatMoney(selectedCount > 0 ? isciHakedis : 0)} ₺
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
