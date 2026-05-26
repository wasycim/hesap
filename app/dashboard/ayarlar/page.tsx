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
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Trash2, Users, Package } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"
import { COLOR_OPTIONS, getColumnTextColor } from "@/lib/table-column-settings"
import { VardiyaSettingsCard } from "@/components/dashboard/vardiya-settings-card"

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
  sira: number
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
  const [savingOrtaklar, setSavingOrtaklar] = useState(false)
  const [savingGelirFirmalar, setSavingGelirFirmalar] = useState(false)
  const [savingKargoFirmalar, setSavingKargoFirmalar] = useState(false)
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const [draggedGelirFirmaId, setDraggedGelirFirmaId] = useState<string | null>(null)
  const [dragOverGelirFirmaId, setDragOverGelirFirmaId] = useState<string | null>(null)
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
    setOrtaklar(prev => prev.map(ortak => (
      ortak.id === id ? { ...ortak, aktif: !aktif } : ortak
    )))
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

  async function saveOrtaklar() {
    setSavingOrtaklar(true)
    for (const ortak of ortaklar) {
      await supabase
        .from("ortaklar")
        .update({ aktif: ortak.aktif })
        .eq("id", ortak.id)
    }
    setSavingOrtaklar(false)
    toast.success("Ortaklar kaydedildi.")
    loadData()
  }

  async function saveGelirFirmalar() {
    if (gelirFirmalar.some(firma => !firma.ad.trim())) {
      toast.error("Firma adları boş bırakılamaz.")
      return
    }

    setSavingGelirFirmalar(true)
    for (const [index, firma] of gelirFirmalar.entries()) {
      await supabase
        .from("gelir_firmalar")
        .update({
          ad: firma.ad.trim().toUpperCase(),
          komisyon_orani: firma.komisyon_orani,
          color: firma.color,
          aktif: firma.aktif,
          sira: index,
          updated_at: new Date().toISOString(),
        })
        .eq("id", firma.id)
    }
    setSavingGelirFirmalar(false)
    toast.success("Firmalar kaydedildi.")
    window.dispatchEvent(new Event("gelir-firmalar-changed"))
    loadData()
  }

  async function saveKargoFirmalar() {
    setSavingKargoFirmalar(true)
    for (const firma of kargoFirmalar) {
      await supabase
        .from("kargo_cari_firmalar")
        .update({ aktif: firma.aktif })
        .eq("id", firma.id)
    }
    setSavingKargoFirmalar(false)
    toast.success("Kargo cari firmaları kaydedildi.")
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
    loadData()
  }

  async function saveSettings() {
    setSavingSettings(true)
    await saveOrtaklar()
    await savePersonelSalaries()
    await saveGelirFirmalar()
    await saveKargoFirmalar()
    setSavingSettings(false)
    toast.success("Tüm ayarlar kaydedildi.")
  }

  async function toggleKargoFirma(id: string, aktif: boolean) {
    setKargoFirmalar(prev => prev.map(firma => (
      firma.id === id ? { ...firma, aktif: !aktif } : firma
    )))
  }

  async function toggleGelirFirma(id: string, aktif: boolean) {
    setGelirFirmalar(prev => prev.map(firma => (
      firma.id === id ? { ...firma, aktif: !aktif } : firma
    )))
  }

  async function updateGelirFirma(id: string, patch: Partial<Pick<GelirFirma, "ad" | "komisyon_orani" | "color">>) {
    setGelirFirmalar(prev => prev.map(firma => (
      firma.id === id ? { ...firma, ...patch } : firma
    )))
  }

  function moveGelirFirma(id: string, direction: -1 | 1) {
    setGelirFirmalar(prev => {
      const index = prev.findIndex(firma => firma.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const current = next[index]
      next[index] = next[nextIndex]
      next[nextIndex] = current
      return next.map((firma, sira) => ({ ...firma, sira }))
    })
  }

  function dragGelirFirma(targetId: string) {
    if (!draggedGelirFirmaId || draggedGelirFirmaId === targetId) return
    setGelirFirmalar(prev => {
      const fromIndex = prev.findIndex(firma => firma.id === draggedGelirFirmaId)
      const toIndex = prev.findIndex(firma => firma.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next.map((firma, sira) => ({ ...firma, sira }))
    })
    setDragOverGelirFirmaId(null)
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
      title: "Gelir firması silinsin mi?",
      description: "Bu firmayı silerseniz gelir tablosundaki eski tutarlar raporda firma adı olmadan kalabilir.",
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
      <h1 className="text-2xl font-bold text-foreground mb-2">Genel Ayarlar</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {currentSube?.ad ? `${currentSube.ad} şubesi için ayarlar` : "Şube seçimi bekleniyor"}
      </p>
      
      <div className="mb-6 flex justify-end">
        <Button onClick={saveSettings} disabled={savingSettings} className="gap-2">
          <Save className="h-4 w-4" />
          {savingSettings ? "Kaydediliyor..." : "Hepsini Kaydet"}
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
                placeholder="Yeni ortak adı..."
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
            <div className="mb-4 flex justify-end">
              <Button onClick={saveOrtaklar} disabled={savingOrtaklar} className="gap-2 bg-amber-500 hover:bg-amber-600">
                <Save className="h-4 w-4" />
                {savingOrtaklar ? "Kaydediliyor..." : "Ortakları Kaydet"}
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
                placeholder="Yeni personel adı..."
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
                <p className="text-emerald-100 text-sm">Gelir tablosunda Firmalar bölümü ve komisyon oranları</p>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="flex gap-3 mb-5 max-w-md">
              <Input
                value={yeniGelirFirma}
                onChange={(e) => setYeniGelirFirma(e.target.value)}
                placeholder="Yeni gelir firması..."
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
            <div className="mb-4 flex justify-end">
              <Button onClick={saveGelirFirmalar} disabled={savingGelirFirmalar} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Save className="h-4 w-4" />
                {savingGelirFirmalar ? "Kaydediliyor..." : "Firmaları Kaydet"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {gelirFirmalar.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Henüz gelir firması eklenmemiş. Yeni firma eklenince komisyon oranı varsayılan %20 olur.
                </div>
              ) : (
                gelirFirmalar.map((firma, index) => (
                  <div
                    key={firma.id}
                    draggable
                    onDragStart={() => setDraggedGelirFirmaId(firma.id)}
                    onDragEnd={() => {
                      setDraggedGelirFirmaId(null)
                      setDragOverGelirFirmaId(null)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setDragOverGelirFirmaId(firma.id)
                    }}
                    onDragLeave={() => setDragOverGelirFirmaId(prev => prev === firma.id ? null : prev)}
                    onDrop={(event) => {
                      event.preventDefault()
                      dragGelirFirma(firma.id)
                    }}
                    className={`cursor-grab rounded-lg border-l-4 p-3.5 transition-all active:cursor-grabbing ${
                      dragOverGelirFirmaId === firma.id && draggedGelirFirmaId !== firma.id
                        ? "scale-[1.01] ring-2 ring-emerald-500 ring-offset-2"
                        : ""
                    } ${
                      firma.aktif
                        ? "bg-emerald-50 border-emerald-400 dark:bg-emerald-500/15"
                        : "bg-muted/50 border-muted-foreground/30 opacity-60"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      <div className={`rounded px-2 py-1 text-xs font-bold ${firma.color} ${getColumnTextColor(firma.color)}`}>
                        SÜTUN
                      </div>
                    </div>
                    <Input
                      value={firma.ad}
                      onChange={(event) => updateGelirFirma(firma.id, { ad: event.target.value })}
                      className={`mb-3 h-9 font-semibold ${firma.aktif ? "" : "text-muted-foreground line-through"}`}
                      placeholder="Firma adı"
                    />
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
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => moveGelirFirma(firma.id, -1)}
                          disabled={index === 0}
                          title="Yukarı taşı"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => moveGelirFirma(firma.id, 1)}
                          disabled={index === gelirFirmalar.length - 1}
                          title="Aşağı taşı"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
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

            {gelirFirmalar.length > 0 && (
              <div className="mt-5 rounded-lg border bg-muted/20 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Firma Ön İzleme</h3>
                    <p className="text-xs text-muted-foreground">Gelir tablosunda Firmalar kategorisi içindeki görünüm.</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100">
                    {gelirFirmalar.filter(firma => firma.aktif).length} aktif
                  </span>
                </div>
                <div className="visible-x-scroll overflow-x-auto pb-2">
                  <div className="flex min-w-max overflow-hidden rounded-lg border">
                    {gelirFirmalar.map((firma, index) => (
                      <div
                        key={firma.id}
                        className={`min-w-40 border-r px-4 py-3 text-center last:border-r-0 ${firma.aktif ? firma.color : "bg-muted"} ${firma.aktif ? getColumnTextColor(firma.color) : "text-muted-foreground"}`}
                      >
                        <div className="text-[10px] font-bold uppercase opacity-80">#{index + 1}</div>
                        <div className={`mt-1 truncate text-sm font-extrabold ${firma.aktif ? "" : "line-through"}`}>
                          {firma.ad}
                        </div>
                        <div className="mt-1 text-[11px] font-semibold opacity-90">
                          {firma.komisyon_orani === null ? "Komisyon yok" : `%${firma.komisyon_orani} komisyon`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Kargo Cari Firmalar Card - Tam genislik */}
        <VardiyaSettingsCard />

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
                placeholder="Yeni firma adı..."
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
            <div className="mb-4 flex justify-end">
              <Button onClick={saveKargoFirmalar} disabled={savingKargoFirmalar} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                <Save className="h-4 w-4" />
                {savingKargoFirmalar ? "Kaydediliyor..." : "Kargo Cari Firmaları Kaydet"}
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
