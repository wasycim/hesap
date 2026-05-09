"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Users, Package } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"

interface Ortak {
  id: string
  ad: string
  aktif: boolean
}

interface Personel {
  id: string
  ad: string
  aktif: boolean
}

interface KargoFirma {
  id: string
  ad: string
  aktif: boolean
}

export default function AyarlarPage() {
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [kargoFirmalar, setKargoFirmalar] = useState<KargoFirma[]>([])
  const [yeniOrtak, setYeniOrtak] = useState("")
  const [yeniPersonel, setYeniPersonel] = useState("")
  const [yeniKargoFirma, setYeniKargoFirma] = useState("")
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
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

    const [ortakRes, personelRes, kargoRes] = await Promise.all([
      supabase.from("ortaklar").select("*").eq("user_id", user.id).eq("sube_id", currentSube.id).order("sira"),
      supabase.from("personeller").select("*").eq("sube_id", currentSube.id).order("sira"),
      supabase.from("kargo_cari_firmalar").select("*").eq("sube_id", currentSube.id).order("sira"),
    ])

    if (ortakRes.data) setOrtaklar(ortakRes.data)
    if (personelRes.data) setPersoneller(personelRes.data)
    if (kargoRes.data) setKargoFirmalar(kargoRes.data)
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

    await supabase.from("personeller").insert({
      user_id: user.id,
      sube_id: currentSube.id,
      ad: yeniPersonel.toUpperCase(),
      sira: personeller.length,
      aktif: true,
    })
    setYeniPersonel("")
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

  async function toggleOrtak(id: string, aktif: boolean) {
    await supabase.from("ortaklar").update({ aktif: !aktif }).eq("id", id)
    loadData()
  }

  async function togglePersonel(id: string, aktif: boolean) {
    await supabase.from("personeller").update({ aktif: !aktif }).eq("id", id)
    loadData()
  }

  async function toggleKargoFirma(id: string, aktif: boolean) {
    await supabase.from("kargo_cari_firmalar").update({ aktif: !aktif }).eq("id", id)
    loadData()
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
  }

  async function deleteOrtak(id: string) {
    if (!confirm("Bu ortagi silmek istediginizden emin misiniz?")) return
    const ortak = ortaklar.find(item => item.id === id)
    await supabase.from("ortaklar").delete().eq("id", id)
    await logSecurityEvent("ortak_delete", { id, label: ortak?.ad, sube_id: currentSube?.id })
    loadData()
  }

  async function deletePersonel(id: string) {
    if (!confirm("Bu personeli silmek istediginizden emin misiniz?")) return
    const personel = personeller.find(item => item.id === id)
    await supabase.from("personeller").delete().eq("id", id)
    await logSecurityEvent("person_delete", { id, label: personel?.ad, sube_id: currentSube?.id })
    loadData()
  }

  async function deleteKargoFirma(id: string) {
    if (!confirm("Bu firmayı ve tüm kayıtlarını silmek istediğinizden emin misiniz?")) return
    const firma = kargoFirmalar.find(item => item.id === id)
    await supabase.from("kargo_cari_kayitlar").delete().eq("firma_id", id)
    await supabase.from("kargo_cari_firmalar").delete().eq("id", id)
    await logSecurityEvent("kargo_cari_delete", { id, label: firma?.ad, sube_id: currentSube?.id })
    loadData()
    window.dispatchEvent(new Event("kargo-firmalar-changed"))
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
    <div className="p-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">Ayarlar</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {currentSube?.ad ? `${currentSube.ad} şubesi için ayarlar` : "Şube seçimi bekleniyor"}
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
            <div className="flex gap-3 mb-5">
              <Input
                value={yeniPersonel}
                onChange={(e) => setYeniPersonel(e.target.value)}
                placeholder="Yeni personel adi..."
                className="flex-1 h-11"
                onKeyDown={(e) => e.key === "Enter" && addPersonel()}
              />
              <Button 
                onClick={addPersonel} 
                className="bg-blue-500 hover:bg-blue-600 text-white h-11 w-11 p-0"
              >
                <Plus className="w-5 h-5" />
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
                    <span className={`font-semibold ${personel.aktif ? "text-foreground" : "text-muted-foreground line-through"}`}>
                      {personel.ad}
                    </span>
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
    </div>
  )
}
