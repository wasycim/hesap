"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Eye, Save } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { logSecurityEvent } from "@/lib/audit-log"

const MENU_OPTIONS = [
  { key: "dashboard", label: "Genel Bakış" },
  { key: "gelir", label: "Gelir Tablosu" },
  { key: "gider", label: "Gider Tablosu" },
  { key: "corbalar", label: "Çorbalar" },
  { key: "kargo_cari", label: "Kargo Cari" },
]

export default function GorunumAyarlarPage() {
  const { subeler, isAdmin } = useSube()
  const [selectedSubeId, setSelectedSubeId] = useState("")
  const [visibility, setVisibility] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!selectedSubeId && subeler.length > 0) {
      setSelectedSubeId(subeler[0].id)
    }
  }, [subeler, selectedSubeId])

  useEffect(() => {
    if (selectedSubeId) loadVisibility()
  }, [selectedSubeId])

  async function loadVisibility() {
    const defaults = Object.fromEntries(MENU_OPTIONS.map(option => [option.key, true]))
    const { data } = await supabase
      .from("sube_menu_izinleri")
      .select("menu_key, visible")
      .eq("sube_id", selectedSubeId)

    setVisibility({
      ...defaults,
      ...(data || []).reduce((acc, item) => ({ ...acc, [item.menu_key]: item.visible }), {}),
    })
  }

  async function saveVisibility() {
    setSaving(true)
    const rows = MENU_OPTIONS.map(option => ({
      sube_id: selectedSubeId,
      menu_key: option.key,
      visible: visibility[option.key] ?? true,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from("sube_menu_izinleri")
      .upsert(rows, { onConflict: "sube_id,menu_key" })

    if (!error) {
      await logSecurityEvent("visibility_update", { sube_id: selectedSubeId, visibility })
      toast.success("Değişiklikler kaydedildi ✅")
    } else {
      toast.error("Değişiklikler kaydedilemedi.")
    }
    setSaving(false)
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Erişim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Görünüm Ayarları</h1>
          <p className="text-sm text-muted-foreground">Şubelerin görebileceği menüleri seçin.</p>
        </div>
        <Button onClick={saveVisibility} disabled={saving || !selectedSubeId} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Şube ve Menüler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Select value={selectedSubeId} onValueChange={setSelectedSubeId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Şube seçin" />
            </SelectTrigger>
            <SelectContent>
              {subeler.map(sube => (
                <SelectItem key={sube.id} value={sube.id}>{sube.ad}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid gap-3 md:grid-cols-2">
            {MENU_OPTIONS.map(option => (
              <label key={option.key} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{option.label}</span>
                </div>
                <Checkbox
                  checked={visibility[option.key] ?? true}
                  onCheckedChange={(checked) => setVisibility(prev => ({ ...prev, [option.key]: Boolean(checked) }))}
                />
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
