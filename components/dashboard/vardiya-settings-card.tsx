"use client"

import { useEffect, useState } from "react"
import { Clock3, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSube } from "@/contexts/sube-context"

type ShiftDefinition = {
  id: string
  ad: string
  simge?: string | null
  baslangic: string
  bitis: string
  aktif: boolean
  sira: number
}

type FixedShiftDefinition = {
  kod: string
  ad: string
  simge?: string | null
  baslangic: string | null
  bitis: string | null
  aktif: boolean
}

export function VardiyaSettingsCard() {
  const { currentSube } = useSube()
  const [rows, setRows] = useState<ShiftDefinition[]>([])
  const [fixedRows, setFixedRows] = useState<FixedShiftDefinition[]>([])
  const [ad, setAd] = useState("")
  const [simge, setSimge] = useState("")
  const [baslangic, setBaslangic] = useState("09:00")
  const [bitis, setBitis] = useState("19:00")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (currentSube) loadRows()
  }, [currentSube?.id])

  async function loadRows() {
    if (!currentSube) return

    const response = await fetch(`/api/dashboard/vardiya-tanimlari?subeId=${currentSube.id}`, {
      cache: "no-store",
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload.error || "Vardiya tanımları yüklenemedi.")
      return
    }

    setRows(payload.shifts || [])
    setFixedRows(payload.fixedShifts || [])
  }

  async function addRow() {
    if (!currentSube || !ad.trim()) return

    setLoading(true)
    const response = await fetch("/api/dashboard/vardiya-tanimlari", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subeId: currentSube.id, ad, simge, baslangic, bitis }),
    })
    const payload = await response.json().catch(() => ({}))
    setLoading(false)

    if (!response.ok) {
      toast.error(payload.error || "Vardiya eklenemedi.")
      return
    }

    setAd("")
    setSimge("")
    toast.success("Vardiya eklendi.")
    loadRows()
  }

  async function updateFixedRow(row: FixedShiftDefinition) {
    if (!currentSube) return

    const response = await fetch("/api/dashboard/vardiya-tanimlari", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, type: "fixed", subeId: currentSube.id }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload.error || "Hazır vardiya güncellenemedi.")
      return
    }

    toast.success("Hazır vardiya kaydedildi.")
    loadRows()
  }

  async function updateRow(row: ShiftDefinition) {
    if (!currentSube) return

    const response = await fetch("/api/dashboard/vardiya-tanimlari", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...row, subeId: currentSube.id }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload.error || "Vardiya güncellenemedi.")
      return
    }

    toast.success("Vardiya kaydedildi.")
    loadRows()
  }

  async function deleteRow(row: ShiftDefinition) {
    if (!currentSube) return

    const response = await fetch("/api/dashboard/vardiya-tanimlari", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, subeId: currentSube.id }),
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      toast.error(payload.error || "Vardiya silinemedi.")
      return
    }

    toast.success("Vardiya silindi.")
    loadRows()
  }

  return (
    <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="bg-gradient-to-r from-violet-500 to-violet-600 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/20 p-2">
            <Clock3 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Vardiya Ayarları</h2>
            <p className="text-sm text-violet-100">Hazır vardiyaları ve şubeye özel vardiyaları düzenleyin.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5">
        <div className="grid gap-2 rounded-lg border bg-muted/20 p-3">
          <div className="text-sm font-semibold">Hazır vardiyalar</div>
          {fixedRows.map((row) => (
            <div key={row.kod} className="grid gap-2 rounded-md border bg-background p-2 md:grid-cols-[1fr_5rem_8rem_8rem_auto]">
              <Input value={row.ad} onChange={(event) => setFixedRows((current) => current.map((item) => item.kod === row.kod ? { ...item, ad: event.target.value } : item))} />
              <Input value={row.simge || ""} onChange={(event) => setFixedRows((current) => current.map((item) => item.kod === row.kod ? { ...item, simge: event.target.value.slice(0, 4) } : item))} placeholder="Simge" maxLength={4} />
              <Input value={row.baslangic || ""} onChange={(event) => setFixedRows((current) => current.map((item) => item.kod === row.kod ? { ...item, baslangic: event.target.value } : item))} type="time" disabled={row.kod === "I"} />
              <Input value={row.bitis || ""} onChange={(event) => setFixedRows((current) => current.map((item) => item.kod === row.kod ? { ...item, bitis: event.target.value } : item))} type="time" disabled={row.kod === "I"} />
              <Button type="button" variant="outline" onClick={() => updateFixedRow(row)} className="gap-2">
                <Save className="h-4 w-4" />
                Kaydet
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-2 md:grid-cols-[1fr_5rem_8rem_8rem_auto]">
          <Input value={ad} onChange={(event) => setAd(event.target.value)} placeholder="Örn. Çarşı vardiya" />
          <Input value={simge} onChange={(event) => setSimge(event.target.value.slice(0, 4))} placeholder="Ç" maxLength={4} />
          <Input value={baslangic} onChange={(event) => setBaslangic(event.target.value)} type="time" />
          <Input value={bitis} onChange={(event) => setBitis(event.target.value)} type="time" />
          <Button type="button" onClick={addRow} disabled={loading} className="gap-2">
            <Plus className="h-4 w-4" />
            Ekle
          </Button>
        </div>

        <div className="grid gap-2">
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
              Özel vardiya tanımı yok.
            </div>
          ) : rows.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-md border bg-background p-2 md:grid-cols-[1fr_5rem_8rem_8rem_auto_auto]">
              <Input value={row.ad} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, ad: event.target.value } : item))} />
              <Input value={row.simge || ""} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, simge: event.target.value.slice(0, 4) } : item))} placeholder="Simge" maxLength={4} />
              <Input value={row.baslangic} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, baslangic: event.target.value } : item))} type="time" />
              <Input value={row.bitis} onChange={(event) => setRows((current) => current.map((item) => item.id === row.id ? { ...item, bitis: event.target.value } : item))} type="time" />
              <Button type="button" variant="outline" onClick={() => updateRow(row)} className="gap-2">
                <Save className="h-4 w-4" />
                Kaydet
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="Sil" onClick={() => deleteRow(row)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
