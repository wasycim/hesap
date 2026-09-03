"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isTestPersonnel } from "@/lib/utils/test-personnel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Save, Printer, User, Building2, Phone, MapPin, GraduationCap, Briefcase, Heart, CheckCircle2, Sparkles, ChevronLeft } from "lucide-react"
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
}

interface PersonelBilgiFormu {
  id?: string
  personel_id: string
  firma_unvani?: string
  ad_soyad?: string
  tc_kimlik_no?: string
  sgk_sicil_no?: string
  vergi_kimlik_no?: string
  dogum_yeri_tarihi?: string
  cinsiyet?: string
  kan_grubu?: string
  adres?: string
  telefon?: string
  cep_telefon?: string
  askerlik_durumu?: string
  terhis_tarihi_birlik?: string
  medeni_durumu?: string
  cocuk_sayisi?: string
  baba_adi_meslegi?: string
  anne_adi_meslegi?: string
  ev_mulkiyet_durumu?: string
  ogrenim_ilkogretim?: string
  ogrenim_ortaogretim?: string
  is_tecrubesi_firma?: string
  is_tecrubesi_gorev?: string
  is_tecrubesi_ucret?: string
  is_tecrubesi_ayrilis_nedeni?: string
  is_tecrubesi_ise_baslama?: string
  surucu_belgesi?: string
  saglik_sorunu?: string
  seyahat_engeli?: string
  mecburi_hizmet_borcu?: string
  adli_sicil?: string
  sigara?: string
  boy?: string
  kilo?: string
  talep_edilen_gorev?: string
  son_net_ucret?: string
  talep_edilen_net_ucret?: string
  baslama_zamani?: string
  ikamet_degisikligi?: string
  fazla_mesai_vardiya?: string
  form_tarihi?: string
}

export default function PersonelBilgiPage() {
  const supabase = createClient()
  const router = useRouter()
  const { currentSube } = useSube()
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [selectedPersonelId, setSelectedPersonelId] = useState<string>("")
  const [formState, setFormState] = useState<Partial<PersonelBilgiFormu>>({
    firma_unvani: "ÜNLÜ GIDA SAN. TİC. LTD. ŞTİ.",
    cinsiyet: "Erkek",
    medeni_durumu: "Bekar",
    ev_mulkiyet_durumu: "Kira",
    surucu_belgesi: "Hayır",
    saglik_sorunu: "Hayır",
    seyahat_engeli: "Hayır",
    mecburi_hizmet_borcu: "Hayır",
    adli_sicil: "Hayır",
    sigara: "Evet",
    ikamet_degisikligi: "Hayır",
    fazla_mesai_vardiya: "Evet",
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentSube) loadPersoneller()
  }, [currentSube?.id])

  useEffect(() => {
    if (selectedPersonelId) {
      loadForm(selectedPersonelId)
    }
  }, [selectedPersonelId])

  async function loadPersoneller() {
    setLoading(true)
    const { data } = await supabase
      .from("personeller")
      .select("*")
      .eq("sube_id", currentSube?.id || "")
      .order("sira")

    if (data) {
      const filtered = data.filter(p => !isTestPersonnel(p))
      setPersoneller(filtered)
      if (filtered.length > 0 && !selectedPersonelId) {
        setSelectedPersonelId(filtered[0].id)
      }
    }
    setLoading(false)
  }

  async function loadForm(personelId: string) {
    try {
      const res = await fetch(`/api/admin/personel-bilgi-formu?personelId=${personelId}`)
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        setFormState(data.items[0])
      } else {
        const targetP = personeller.find(p => p.id === personelId)
        setFormState({
          personel_id: personelId,
          firma_unvani: "ÜNLÜ GIDA SAN. TİC. LTD. ŞTİ.",
          ad_soyad: targetP?.ad || "",
          cinsiyet: "Erkek",
          medeni_durumu: "Bekar",
          ev_mulkiyet_durumu: "Kira",
          surucu_belgesi: "Hayır",
          saglik_sorunu: "Hayır",
          seyahat_engeli: "Hayır",
          mecburi_hizmet_borcu: "Hayır",
          adli_sicil: "Hayır",
          sigara: "Evet",
          ikamet_degisikligi: "Hayır",
          fazla_mesai_vardiya: "Evet",
          form_tarihi: new Date().toISOString().slice(0, 10),
        })
      }
    } catch {
      toast.error("Form verileri yüklenirken hata oluştu.")
    }
  }

  async function handleSave() {
    if (!selectedPersonelId) {
      toast.error("Lütfen bir personel seçin.")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/personel-bilgi-formu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          personel_id: selectedPersonelId,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success("Personel bilgi formu başarıyla kaydedildi.")
        if (data.item) setFormState(data.item)
      } else {
        toast.error(data.error || "Kaydedilemedi.")
      }
    } catch {
      toast.error("İşlem sırasında hata oluştu.")
    } finally {
      setSaving(false)
    }
  }

  function exportFormPdf() {
    const targetP = personeller.find(p => p.id === selectedPersonelId)
    const pName = formState.ad_soyad || targetP?.ad || "Personel"

    openPdfReport({
      title: "İŞ TALEP VE BİLGİ FORMU",
      subtitle: `${formState.firma_unvani || "ÜNLÜ GIDA SAN. TİC. LTD. ŞTİ."} · ${currentSube?.ad || ""}`,
      orientation: "portrait",
      metrics: [
        { label: "Personel Adı", value: pName, side: "left", color: "black" },
        { label: "T.C. Kimlik No", value: formState.tc_kimlik_no || "-", side: "left", color: "black" },
        { label: "Cep Telefonu", value: formState.cep_telefon || "-", side: "right", color: "green" },
        { label: "Form Tarihi", value: formState.form_tarihi || "-", side: "right", color: "black" },
      ],
      tables: [
        {
          title: "KİMLİK VE BİLEŞEN BİLGİLERİ",
          headers: ["Bilgi Başlığı", "Detay Bilgisi"],
          firstColumnWidth: "40%",
          rows: [
            ["Firma Ünvanı", formState.firma_unvani || "-"],
            ["Adı Soyadı", pName],
            ["T.C. Kimlik No", formState.tc_kimlik_no || "-"],
            ["SGK Sicil No", formState.sgk_sicil_no || "-"],
            ["Doğum Yeri ve Tarihi", formState.dogum_yeri_tarihi || "-"],
            ["Cinsiyet / Kan Grubu", `${formState.cinsiyet || "-"} / ${formState.kan_grubu || "-"}`],
            ["İkametgah Adresi", formState.adres || "-"],
            ["Cep Telefonu", formState.cep_telefon || "-"],
          ],
        },
        {
          title: "AİLEVİ VE ÖĞRENİM DURUMU",
          headers: ["Bilgi Başlığı", "Detay Bilgisi"],
          firstColumnWidth: "40%",
          rows: [
            ["Medeni Durum / Çocuk Sayısı", `${formState.medeni_durumu || "-"} (Çocuk: ${formState.cocuk_sayisi || "0"})`],
            ["Baba Adı / Mesleği", formState.baba_adi_meslegi || "-"],
            ["Anne Adı / Mesleği", formState.anne_adi_meslegi || "-"],
            ["Ev Mülkiyet Durumu", formState.ev_mulkiyet_durumu || "-"],
            ["İlköğretim Okul Adı", formState.ogrenim_ilkogretim || "-"],
            ["Ortaöğretim (Lise) Okul Adı", formState.ogrenim_ortaogretim || "-"],
          ],
        },
        {
          title: "İŞ TECRÜBESİ BİLGİLERİ",
          headers: ["Son İşyeri Ünvanı", "Göreviniz", "Ayrılış Sebebi ve Tarihi"],
          firstColumnWidth: "35%",
          rows: [
            [
              formState.is_tecrubesi_firma || "-",
              formState.is_tecrubesi_gorev || "-",
              `${formState.is_tecrubesi_ayrilis_nedeni || "-"} (${formState.is_tecrubesi_ise_baslama || "-"})`,
            ],
          ],
        },
        {
          title: "ÖZEL BİLGİLER VE DEĞERLENDİRME",
          headers: ["Soru / Kriter", "Yanıt", "Açıklama / Detay"],
          firstColumnWidth: "45%",
          rows: [
            ["Sürücü Belgeniz Var mı?", formState.surucu_belgesi || "Hayır", "-"],
            ["Sağlık Sorununuz Var mı?", formState.saglik_sorunu || "Hayır", "-"],
            ["Seyahat Engeliniz Var mı?", formState.seyahat_engeli || "Hayır", "-"],
            ["Adli Sicil Kaydınız Var mı?", formState.adli_sicil || "Hayır", "-"],
            ["Sigara Kullanıyor musunuz?", formState.sigara || "Evet", "-"],
            ["Fiziksel Ölçüler", `Boy: ${formState.boy || "-"} cm`, `Kilo: ${formState.kilo || "-"} kg`],
          ],
        },
        {
          title: "GÖREV VE ÜCRET TALEPLERİ",
          headers: ["Talep Kriteri", "Personel Beyanı"],
          firstColumnWidth: "45%",
          rows: [
            ["Talep Edilen Görev", formState.talep_edilen_gorev || "-"],
            ["En Son Kurumdan Aldığı Net Ücret", `${formState.son_net_ucret || "-"} TL`],
            ["Talep Ettiği Net Ücret", `${formState.talep_edilen_net_ucret || "-"} TL`],
            ["Ne Zaman Başlayabilir?", formState.baslama_zamani || "HEMEN"],
            ["Fazla Mesai & Vardiya Kabulü", formState.fazla_mesai_vardiya || "EVET"],
            ["İkamet Değişikliği Yapabilir mi?", formState.ikamet_degisikligi || "HAYIR"],
          ],
        },
      ],
    })
  }

  const updateField = (key: keyof PersonelBilgiFormu, val: string) => {
    setFormState(prev => ({ ...prev, [key]: val }))
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-5 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Personel Bilgisi & İş Talep Formu</h1>
            <p className="text-xs text-muted-foreground">Resmi İş Talep ve Bilgi Formunu doldurun, kaydedin ve PDF olarak indirin</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedPersonelId} onValueChange={setSelectedPersonelId}>
            <SelectTrigger className="w-56 h-10 text-xs font-semibold bg-background border-input">
              <SelectValue placeholder="Personel Seçin..." />
            </SelectTrigger>
            <SelectContent>
              {personeller.map(p => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {p.ad} {p.isten_cikis_tarihi ? "(Ayrıldı)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={exportFormPdf} variant="outline" className="h-10 text-xs gap-1.5 border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300">
            <Printer className="w-4 h-4" /> PDF İndir
          </Button>

          <Button onClick={handleSave} disabled={saving} className="h-10 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <Save className="w-4 h-4" /> {saving ? "Kaydediliyor..." : "Formu Kaydet"}
          </Button>
        </div>
      </div>

      {/* Form Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Kimlik & Genel Bilgiler */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-sky-600" />
              1. Kimlik & İletişim Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <label className="font-semibold block mb-1">Firma Ünvanı</label>
              <Input
                value={formState.firma_unvani || ""}
                onChange={e => updateField("firma_unvani", e.target.value)}
                placeholder="Örn: ÜNLÜ GIDA SAN. TİC. LTD. ŞTİ."
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Adı Soyadı</label>
                <Input
                  value={formState.ad_soyad || ""}
                  onChange={e => updateField("ad_soyad", e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">T.C. Kimlik No</label>
                <Input
                  value={formState.tc_kimlik_no || ""}
                  onChange={e => updateField("tc_kimlik_no", e.target.value)}
                  placeholder="11 Hane"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">SGK Sicil No</label>
                <Input
                  value={formState.sgk_sicil_no || ""}
                  onChange={e => updateField("sgk_sicil_no", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Doğum Yeri ve Tarihi</label>
                <Input
                  value={formState.dogum_yeri_tarihi || ""}
                  onChange={e => updateField("dogum_yeri_tarihi", e.target.value)}
                  placeholder="Örn: GEBZE / 09.03.2007"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Cinsiyet</label>
                <Select value={formState.cinsiyet || "Erkek"} onValueChange={v => updateField("cinsiyet", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Erkek">Erkek</SelectItem>
                    <SelectItem value="Kadın">Kadın</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Kan Grubu</label>
                <Input
                  value={formState.kan_grubu || ""}
                  onChange={e => updateField("kan_grubu", e.target.value)}
                  placeholder="Örn: A Rh(+)"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">İkametgah Adresi</label>
              <Textarea
                value={formState.adres || ""}
                onChange={e => updateField("adres", e.target.value)}
                placeholder="Açık Mahalle, Sokak, No..."
                className="text-xs min-h-[60px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Cep Telefonu</label>
                <Input
                  value={formState.cep_telefon || ""}
                  onChange={e => updateField("cep_telefon", e.target.value)}
                  placeholder="Örn: 0546 739 20 61"
                  className="h-9 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Sabit / Diğer Tel</label>
                <Input
                  value={formState.telefon || ""}
                  onChange={e => updateField("telefon", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Ailevi & Öğrenim Bilgileri */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Heart className="w-4 h-4 text-rose-500" />
              2. Ailevi & Öğrenim Durumu
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold block mb-1">Medeni Durum</label>
                <Select value={formState.medeni_durumu || "Bekar"} onValueChange={v => updateField("medeni_durumu", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bekar">Bekar</SelectItem>
                    <SelectItem value="Evli">Evli</SelectItem>
                    <SelectItem value="Dul">Dul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Çocuk Sayısı</label>
                <Input
                  value={formState.cocuk_sayisi || "0"}
                  onChange={e => updateField("cocuk_sayisi", e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Ev Mülkiyeti</label>
                <Select value={formState.ev_mulkiyet_durumu || "Kira"} onValueChange={v => updateField("ev_mulkiyet_durumu", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Kendine Ait">Kendine Ait</SelectItem>
                    <SelectItem value="Kira">Kira</SelectItem>
                    <SelectItem value="Aile Fertlerinden Birine Ait">Aileye Ait</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Baba Adı & Mesleği</label>
                <Input
                  value={formState.baba_adi_meslegi || ""}
                  onChange={e => updateField("baba_adi_meslegi", e.target.value)}
                  placeholder="Örn: CEMİL ÇETİN - ŞÖFÖR"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Anne Adı & Mesleği</label>
                <Input
                  value={formState.anne_adi_meslegi || ""}
                  onChange={e => updateField("anne_adi_meslegi", e.target.value)}
                  placeholder="Örn: REMZİYE ÇETİN - EV HANIMI"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="pt-2 border-t font-semibold text-muted-foreground uppercase text-[10px]">Öğrenim Durumu</div>

            <div>
              <label className="font-semibold block mb-1">İlköğretim Okul Adı / Yeri</label>
              <Input
                value={formState.ogrenim_ilkogretim || ""}
                onChange={e => updateField("ogrenim_ilkogretim", e.target.value)}
                placeholder="Örn: NENEHATUN İLKOKUL"
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Ortaöğretim (Lise) Okul & Bölümü</label>
              <Input
                value={formState.ogrenim_ortaogretim || ""}
                onChange={e => updateField("ogrenim_ortaogretim", e.target.value)}
                placeholder="Örn: İBNİ SİNA MTAL - BİLİŞİM"
                className="h-9 text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: İş Tecrübesi */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              3. Son İş Tecrübesi Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div>
              <label className="font-semibold block mb-1">Son Çalıştığınız İşyeri Ünvanı</label>
              <Input
                value={formState.is_tecrubesi_firma || ""}
                onChange={e => updateField("is_tecrubesi_firma", e.target.value)}
                placeholder="Örn: EKOL LOJİSTİK"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Göreviniz / Unvanınız</label>
                <Input
                  value={formState.is_tecrubesi_gorev || ""}
                  onChange={e => updateField("is_tecrubesi_gorev", e.target.value)}
                  placeholder="Örn: KALİTE KONTROL"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Alınan Ücret (TL)</label>
                <Input
                  value={formState.is_tecrubesi_ucret || ""}
                  onChange={e => updateField("is_tecrubesi_ucret", e.target.value)}
                  placeholder="Örn: 22104"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Ayrılış Sebebi</label>
                <Input
                  value={formState.is_tecrubesi_ayrilis_nedeni || ""}
                  onChange={e => updateField("is_tecrubesi_ayrilis_nedeni", e.target.value)}
                  placeholder="Örn: KENDİ İSTEĞİ"
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Ayrılma Tarihi</label>
                <Input
                  value={formState.is_tecrubesi_ise_baslama || ""}
                  onChange={e => updateField("is_tecrubesi_ise_baslama", e.target.value)}
                  placeholder="Örn: 27.06.2025"
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Özel Bilgiler & Görev/Ücret Talepleri */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
              4. Özel Bilgiler & Görev/Ücret Talepleri
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold block mb-1">Sürücü Belgesi</label>
                <Select value={formState.surucu_belgesi || "Hayır"} onValueChange={v => updateField("surucu_belgesi", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Evet">Evet</SelectItem><SelectItem value="Hayır">Hayır</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Sağlık Sorunu</label>
                <Select value={formState.saglik_sorunu || "Hayır"} onValueChange={v => updateField("saglik_sorunu", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Evet">Evet</SelectItem><SelectItem value="Hayır">Hayır</SelectItem></SelectContent>
                </Select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Sigara Kullanımı</label>
                <Select value={formState.sigara || "Evet"} onValueChange={v => updateField("sigara", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Evet">Evet</SelectItem><SelectItem value="Hayır">Hayır</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Boy (cm)</label>
                <Input value={formState.boy || ""} onChange={e => updateField("boy", e.target.value)} placeholder="158" className="h-9 text-xs" />
              </div>
              <div>
                <label className="font-semibold block mb-1">Kilo (kg)</label>
                <Input value={formState.kilo || ""} onChange={e => updateField("kilo", e.target.value)} placeholder="55" className="h-9 text-xs" />
              </div>
            </div>

            <div className="pt-2 border-t font-semibold text-muted-foreground uppercase text-[10px]">Görev ve Ücret Talepleri</div>

            <div>
              <label className="font-semibold block mb-1">Talep Edilen Görev</label>
              <Input
                value={formState.talep_edilen_gorev || ""}
                onChange={e => updateField("talep_edilen_gorev", e.target.value)}
                placeholder="Örn: BİLET SATIŞ PERSONELİ"
                className="h-9 text-xs font-bold text-sky-700 dark:text-sky-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Son Net Ücret (TL)</label>
                <Input value={formState.son_net_ucret || ""} onChange={e => updateField("son_net_ucret", e.target.value)} placeholder="22104" className="h-9 text-xs" />
              </div>
              <div>
                <label className="font-semibold block mb-1">Talep Edilen Net Ücret</label>
                <Input value={formState.talep_edilen_net_ucret || ""} onChange={e => updateField("talep_edilen_net_ucret", e.target.value)} placeholder="22104" className="h-9 text-xs font-bold text-emerald-600" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Ne Zaman Başlayabilir?</label>
                <Input value={formState.baslama_zamani || "HEMEN"} onChange={e => updateField("baslama_zamani", e.target.value)} className="h-9 text-xs" />
              </div>
              <div>
                <label className="font-semibold block mb-1">Vardiyalı / Fazla Mesai?</label>
                <Select value={formState.fazla_mesai_vardiya || "Evet"} onValueChange={v => updateField("fazla_mesai_vardiya", v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Evet">Evet</SelectItem><SelectItem value="Hayır">Hayır</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
