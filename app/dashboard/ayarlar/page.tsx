"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Save, Trash2, Users, Package } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"
import { COLOR_OPTIONS, getColumnTextColor } from "@/lib/table-column-settings"

interface Ortak {
  id: string
  ad: string
  aktif: boolean
}

interface Personel {
  id: string
  ad: string
  aktif: boolean
  aylik_maas?: number
  saatlik_mesai_ucreti?: number
}

interface KargoFirma {
  id: string
  ad: string
  aktif: boolean
}

interface GelirFirma {
  id: string
  ad: string
  komisyon_orani: number | null
  color: string
  aktif: boolean
}

interface ConfirmState {
  title: string
  description: string
  action: () => void
}

export default function AyarlarPage() {
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [kargoFirmalar, setKargoFirmalar] = useState<KargoFirma[]>([])
  const [gelirFirmalar, setGelirFirmalar] = useState<GelirFirma[]>([])
  const [yeniOrtak, setYeniOrtak] = useState("")
  const [yeniPersonel, setYeniPersonel] = useState("")
  const [yeniPersonelMaas, setYeniPersonelMaas] = useState("")
  const [yeniKargoFirma, setYeniKargoFirma] = useState("")
  const [yeniGelirFirma, setYeniGelirFirma] = useState("")
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [salaryDrafts, setSalaryDrafts] = useState<Record<string, string>>({})
  const [savingSalaries, setSavingSalaries] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const supabase = createClient()
  const { currentSube } = useSube()

  useEffect(() => {
    if (currentSube) loadData()
  }, [currentSube?.id])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    // Admin kontrolü
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(profile?.is_admin || false)
    
    // Admin değilse erişimi engelle
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }

    const [ortakRes, personelRes, kargoRes, gelirRes] = await Promise.all([
      supabase.from("ortaklar").select("*").eq("sube_id", currentSube.id).order("sira"),
      supabase.from("personeller").select("*").eq("sube_id", currentSube.id).order("sira"),
      supabase.from("kargo_cari_firmalar").select("*").eq("sube_id", currentSube.id).order("sira"),
      supabase.from("gelir_firmalar").select("*").eq("sube_id", currentSube.id).order("sira"),
    ])

    if (ortakRes.data) setOrtaklar(ortakRes.data)
    if (personelRes.data) {
      setPersoneller(personelRes.data)
      setSalaryDrafts(Object.fromEntries(personelRes.data.map(personel => [
        personel.id,
        String(Number(personel.aylik_maas || 0)),
      ])))
    }
    if (kargoRes.data) setKargoFirmalar(kargoRes.data)
    if (gelirRes.data) setGelirFirmalar(gelirRes.data)
    setLoading(false)
  }

  async function addOrtak() {
    if (!yeniOrtak.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    await supabase.from("ortaklar").insert({
      user_id: user.id,
      sube_id: currentSube.id,
      ad: yeniOrtak.toUpperCase(),
      sira: ortaklar.length,
      aktif: true,
    })
    setYeniOrtak("")
    loadData()
  }

  async function addPersonel() {
    if (!yeniPersonel.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return
    const aylikMaas = Number(yeniPersonelMaas) || 0
    const saatlikMesaiUcreti = aylikMaas > 0 ? aylikMaas / 30 / 8 : 0

    await supabase.from("personeller").insert({
      user_id: user.id,
      sube_id: currentSube.id,
      ad: yeniPersonel.toUpperCase(),
      aylik_maas: aylikMaas,
      saatlik_mesai_ucreti: saatlikMesaiUcreti,
      sira: personeller.length,
      aktif: true,
    })
    setYeniPersonel("")
    setYeniPersonelMaas("")
    loadData()
  }

  async function addKargoFirma() {
    if (!yeniKargoFirma.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    await supabase.from("kargo_cari_firmalar").insert({
      user_id: user.id,
      sube_id: currentSube.id,
      ad: yeniKargoFirma.toUpperCase(),
      sira: kargoFirmalar.length,
      aktif: true,
    })
    setYeniKargoFirma("")
    loadData()
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
  }

  async function addGelirFirma() {
    if (!yeniGelirFirma.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    await supabase.from("gelir_firmalar").insert({
      user_id: user.id,
      sube_id: currentSube.id,
      ad: yeniGelirFirma.toUpperCase(),
      komisyon_orani: 20,
      color: "bg-yellow-500",
      sira: gelirFirmalar.length,
      aktif: true,
    })
    setYeniGelirFirma("")
    loadData()
    window.dispatchEvent(new Event("gelir-firmalar-changed"))
  }

  async function toggleOrtak(id: string, aktif: boolean) {
    await supabase.from("ortaklar").update({ aktif: !aktif }).eq("id", id)
    loadData()
  }

  async function togglePersonel(id: string, aktif: boolean) {
    await supabase.from("personeller").update({ aktif: !aktif }).eq("id", id)
    loadData()
  }

  async function savePersonelSalaries() {
    setSavingSalaries(true)
    for (const personel of personeller) {
      const aylikMaas = Number(salaryDrafts[personel.id]) || 0
      await supabase
        .from("personeller")
        .update({
          aylik_maas: aylikMaas,
          saatlik_mesai_ucreti: aylikMaas > 0 ? aylikMaas / 30 / 8 : 0,
        })
        .eq("id", personel.id)
    }
    toast.success("Maaşlar kaydedildi.")
    setSavingSalaries(false)
    loadData()
  }

  async function saveSettings() {
    setSavingSettings(true)

    for (const personel of personeller) {
      const aylikMaas = Number(salaryDrafts[personel.id]) || 0
      await supabase
        .from("personeller")
        .update({
          aylik_maas: aylikMaas,
          saatlik_mesai_ucreti: aylikMaas > 0 ? aylikMaas / 30 / 8 : 0,
        })
        .eq("id", personel.id)
    }

    for (const firma of gelirFirmalar) {
      await supabase
        .from("gelir_firmalar")
        .update({
          komisyon_orani: firma.komisyon_orani,
          color: firma.color,
          aktif: firma.aktif,
          updated_at: new Date().toISOString(),
        })
        .eq("id", firma.id)
    }

    setSavingSettings(false)
    toast.success("Ayarlar kaydedildi.")
    window.dispatchEvent(new Event("gelir-firmalar-changed"))
    loadData()
  }

  async function toggleKargoFirma(id: string, aktif: boolean) {
    await supabase.from("kargo_cari_firmalar").update({ aktif: !aktif }).eq("id", id)
    loadData()
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
  }

  async function toggleGelirFirma(id: string, aktif: boolean) {
    setGelirFirmalar(prev => prev.map(firma => (
      firma.id === id ? { ...firma, aktif: !aktif } : firma
    )))
  }

  async function updateGelirFirma(id: string, patch: Partial<Pick<GelirFirma, "komisyon_orani" | "color">>) {
    setGelirFirmalar(prev => prev.map(firma => (
      firma.id === id ? { ...firma, ...patch } : firma
    )))
  }

  async function deleteOrtak(id: string) {
    setConfirmState({
      title: "Ortak silinsin mi?",
      description: "Bu ortağı silmek istediğinizden emin misiniz?",
      action: () => performDeleteOrtak(id),
    })
  }

  async function performDeleteOrtak(id: string) {
    const ortak = ortaklar.find(item => item.id === id)
    await supabase.from("ortaklar").delete().eq("id", id)
    await logSecurityEvent("ortak_delete", { id, label: ortak?.ad, sube_id: currentSube?.id })
    loadData()
  }

  async function deletePersonel(id: string) {
    setConfirmState({
      title: "Personel silinsin mi?",
      description: "Bu personeli silmek istediğinizden emin misiniz?",
      action: () => performDeletePersonel(id),
    })
  }

  async function performDeletePersonel(id: string) {
    const personel = personeller.find(item => item.id === id)
    await supabase.from("personeller").delete().eq("id", id)
    await logSecurityEvent("person_delete", { id, label: personel?.ad, sube_id: currentSube?.id })
    loadData()
  }

  async function deleteKargoFirma(id: string) {
    setConfirmState({
      title: "Firma silinsin mi?",
      description: "Bu firmayı ve tüm kayıtlarını silmek istediğinizden emin misiniz?",
      action: () => performDeleteKargoFirma(id),
    })
  }

  async function deleteGelirFirma(id: string) {
    setConfirmState({
      title: "Gelir firmasi silinsin mi?",
      description: "Bu firmayi silerseniz gelir tablosundaki eski tutarlar raporda firma adi olmadan kalabilir.",
      action: () => performDeleteGelirFirma(id),
    })
  }

  async function performDeleteKargoFirma(id: string) {
    const firma = kargoFirmalar.find(item => item.id === id)
    await supabase.from("kargo_cari_kayitlar").delete().eq("firma_id", id)
    await supabase.from("kargo_cari_firmalar").delete().eq("id", id)
    await logSecurityEvent("kargo_cari_delete", { id, label: firma?.ad, sube_id: currentSube?.id })
    loadData()
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
  }

  async function performDeleteGelirFirma(id: string) {
    const firma = gelirFirmalar.find(item => item.id === id)
    await supabase.from("gelir_firmalar").delete().eq("id", id)
    await logSecurityEvent("gelir_firma_delete", { id, label: firma?.ad, sube_id: currentSube?.id })
    loadData()
    window.dispatchEvent(new Event("gelir-firmalar-changed"))
  }

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
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">Ayarlar</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {currentSube?.ad ? `${currentSube.ad} şubesi için ayarlar` : "Şube seçimi bekleniyor"}
      </p>
      
      <div className="mb-6 flex justify-end">
        <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
          <Save className="h-4 w-4" />
          {savingSettings ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Ortaklar Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-amber-400 to-yellow-500 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Ortaklar</h2>
                <p className="text-amber-100 text-sm">Gider tablosunda sarı sütunlar</p>
              </div>
            </div>
          </div>
          
          <div className="p-5">
            <div className="flex gap-3 mb-5">
              <Input
                value={yeniOrtak}
                onChange={(e) => setYeniOrtak(e.target.value)}
                placeholder="Yeni ortak adi..."
                className="flex-1 h-11"
                onKeyDown={(e) => e.key === "Enter" && addOrtak()}
              />
              <Button 
                onClick={addOrtak} 
                className="bg-amber-500 hover:bg-amber-600 text-white h-11 w-11 p-0"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {ortaklar.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz ortak eklenmemiş
                </div>
              ) : (
                ortaklar.map((ortak) => (
                  <div 
                    key={ortak.id} 
                    className={`flex items-center justify-between p-3.5 rounded-lg transition-all ${
                      ortak.aktif 
                        ? "bg-amber-50 border-l-4 border-amber-400 dark:bg-amber-500/15 dark:text-amber-100" 
                        : "bg-muted/50 border-l-4 border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <span className={`font-semibold ${ortak.aktif ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {ortak.ad}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleOrtak(ortak.id, ortak.aktif)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          ortak.aktif 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {ortak.aktif ? "Aktif" : "Pasif"}
                      </button>
                      <button
                        onClick={() => deleteOrtak(ortak.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Personeller Card */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Personeller</h2>
                <p className="text-blue-100 text-sm">Gider tablosunda mavi sütunlar</p>
              </div>
            </div>
          </div>
          
          <div className="p-5">
            <div className="grid gap-3 mb-5 sm:grid-cols-[1fr_9rem_auto]">
              <Input
                value={yeniPersonel}
                onChange={(e) => setYeniPersonel(e.target.value)}
                placeholder="Yeni personel adi..."
                className="flex-1 h-11"
                onKeyDown={(e) => e.key === "Enter" && addPersonel()}
              />
              <Input
                value={yeniPersonelMaas}
                onChange={(e) => setYeniPersonelMaas(e.target.value)}
                placeholder="Maaş"
                className="h-11"
                type="number"
                min="0"
              />
              <Button 
                onClick={addPersonel} 
                className="bg-blue-500 hover:bg-blue-600 text-white h-11 w-11 p-0"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            <div className="mb-4 flex justify-end">
              <Button onClick={savePersonelSalaries} disabled={savingSalaries} className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4" />
                {savingSalaries ? "Kaydediliyor..." : "Maaşları Kaydet"}
              </Button>
            </div>
            
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {personeller.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Henüz personel eklenmemiş
                </div>
              ) : (
                personeller.map((personel) => (
                  <div 
                    key={personel.id} 
                    className={`flex items-center justify-between p-3.5 rounded-lg transition-all ${
                      personel.aktif 
                        ? "bg-blue-50 border-l-4 border-blue-400 dark:bg-blue-500/15 dark:text-blue-100" 
                        : "bg-muted/50 border-l-4 border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className={`block font-semibold ${personel.aktif ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {personel.ad}
                      </span>
                      <Input
                        className="mt-2 h-8 w-32"
                        type="number"
                        min="0"
                        value={salaryDrafts[personel.id] ?? String(Number(personel.aylik_maas || 0))}
                        onChange={(event) => setSalaryDrafts(prev => ({ ...prev, [personel.id]: event.target.value }))}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePersonel(personel.id, personel.aktif)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          personel.aktif 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {personel.aktif ? "Aktif" : "Pasif"}
                      </button>
                      <button
                        onClick={() => deletePersonel(personel.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Gelir Firmalar Card */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Firmalar</h2>
                <p className="text-emerald-100 text-sm">Gelir tablosunda Firmalar bolumu ve komisyon oranlari</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex gap-3 mb-5 max-w-md">
              <Input
                value={yeniGelirFirma}
                onChange={(e) => setYeniGelirFirma(e.target.value)}
                placeholder="Yeni gelir firmasi..."
                className="flex-1 h-11"
                onKeyDown={(e) => e.key === "Enter" && addGelirFirma()}
              />
              <Button
                onClick={addGelirFirma}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-11 w-11 p-0"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gelirFirmalar.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Henuz gelir firmasi eklenmemis. Yeni firma eklenince komisyon orani varsayilan %20 olur.
                </div>
              ) : (
                gelirFirmalar.map((firma) => (
                  <div
                    key={firma.id}
                    className={`rounded-lg border-l-4 p-3.5 transition-all ${
                      firma.aktif
                        ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-500/15"
                        : "bg-muted/50 border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className={`font-semibold ${firma.aktif ? "text-foreground" : "text-muted-foreground line-through"}`}>
                        {firma.ad}
                      </span>
                      <div className={`rounded px-2 py-1 text-xs font-bold ${firma.color} ${getColumnTextColor(firma.color)}`}>
                        SUTUN
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_7rem] gap-2">
                      <Select value={firma.color} onValueChange={(value) => updateGelirFirma(firma.id, { color: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COLOR_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="% yok"
                        value={firma.komisyon_orani ?? ""}
                        onChange={(event) => updateGelirFirma(firma.id, {
                          komisyon_orani: event.target.value === "" ? null : Number(event.target.value) || 0,
                        })}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Komisyon: {firma.komisyon_orani === null ? "Yok" : `%${firma.komisyon_orani}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleGelirFirma(firma.id, firma.aktif)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            firma.aktif
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          {firma.aktif ? "Aktif" : "Pasif"}
                        </button>
                        <button
                          onClick={() => deleteGelirFirma(firma.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors dark:hover:bg-red-500/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kargo Cari Firmalar Card - Tam genislik */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-white">Kargo Cari Firmalar</h2>
                <p className="text-cyan-100 text-sm">Menüde Kargo Cari altında görünecek firmalar</p>
              </div>
            </div>
          </div>
          
          <div className="p-5">
            <div className="flex gap-3 mb-5 max-w-md">
              <Input
                value={yeniKargoFirma}
                onChange={(e) => setYeniKargoFirma(e.target.value)}
                placeholder="Yeni firma adi..."
                className="flex-1 h-11"
                onKeyDown={(e) => e.key === "Enter" && addKargoFirma()}
              />
              <Button 
                onClick={addKargoFirma} 
                className="bg-cyan-500 hover:bg-cyan-600 text-white h-11 w-11 p-0"
              >
                <Plus className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {kargoFirmalar.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Henüz firma eklenmemiş. Firma ekleyince menüde Kargo Cari altında görünecek.
                </div>
              ) : (
                kargoFirmalar.map((firma) => (
                  <div 
                    key={firma.id} 
                    className={`flex items-center justify-between p-3.5 rounded-lg transition-all ${
                      firma.aktif 
                        ? "bg-cyan-50 border-l-4 border-cyan-400 dark:bg-cyan-500/15 dark:text-cyan-100" 
                        : "bg-muted/50 border-l-4 border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <span className={`font-semibold ${firma.aktif ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {firma.ad}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKargoFirma(firma.id, firma.aktif)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                          firma.aktif 
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100" 
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {firma.aktif ? "Aktif" : "Pasif"}
                      </button>
                      <button
                        onClick={() => deleteKargoFirma(firma.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors dark:hover:bg-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      <AlertDialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <AlertDialogContent className="animate-modal-pop rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmState?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmState?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                const action = confirmState?.action
                setConfirmState(null)
                action?.()
              }}
            >
              Tamam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
