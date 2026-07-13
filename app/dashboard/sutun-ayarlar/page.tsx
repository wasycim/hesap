"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Plus, Save, Trash2 } from "lucide-react"
import {
  COLOR_OPTIONS,
  FIRMALAR_GROUP_KEY,
  ORTAKLAR_GROUP_KEY,
  PERSONELLER_GROUP_KEY,
  TableColumnSetting,
  TableType,
  getColumnTextColor,
  getColumnColorClass,
  getColumnColorStyle,
  getDefaultColumns,
  makeCustomColumnKey,
  mergeColumnSettings,
} from "@/lib/table-column-settings"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { logSecurityEvent } from "@/lib/audit-log"

function createDefaultRows(tableType: TableType) {
  return getDefaultColumns(tableType).map(column => ({ ...column }))
}

function columnIdentity(column: Pick<TableColumnSetting, "table_type" | "column_key">) {
  return `${column.table_type}:${column.column_key}`
}

interface DynamicColumnItem {
  id: string
  ad: string
  color?: string
  komisyon_orani?: number | null
}

export default function SutunAyarlarPage() {
  const [activeTab, setActiveTab] = useState<TableType>("gelir")
  const [columns, setColumns] = useState<Record<TableType, TableColumnSetting[]>>({
    gelir: createDefaultRows("gelir"),
    gider: createDefaultRows("gider"),
    on_dort_no_hesap: createDefaultRows("on_dort_no_hesap"),
  })
  const [newLabel, setNewLabel] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
  const [dragOverColumnKey, setDragOverColumnKey] = useState<string | null>(null)
  const [ortaklar, setOrtaklar] = useState<DynamicColumnItem[]>([])
  const [personeller, setPersoneller] = useState<DynamicColumnItem[]>([])
  const [firmalar, setFirmalar] = useState<DynamicColumnItem[]>([])
  const supabase = createClient()
  const { currentSube } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()

  useEffect(() => {
    if (currentSube) loadData()
  }, [currentSube?.id])

  useEffect(() => {
    registerSaveHandler(saveColumns)
    return () => registerSaveHandler(null)
  }, [columns, currentSube?.id, registerSaveHandler])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(Boolean(profile?.is_admin))
    if (!profile?.is_admin) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("kolon_ayarlari")
      .select("*")
      .or(`sube_id.eq.${currentSube.id},sube_id.is.null`)
      .order("sort_order", { ascending: true })

    if (error) {
      setSaveMessage({ type: "error", text: `Sütun ayarları yüklenemedi: ${error.message}` })
      setLoading(false)
      return
    }

    const [ortakRes, personelRes, firmaRes] = await Promise.all([
      supabase
        .from("ortaklar")
        .select("id, ad")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("personeller")
        .select("id, ad")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("gelir_firmalar")
        .select("id, ad, color, komisyon_orani")
        .eq("sube_id", currentSube.id)
        .eq("aktif", true)
        .order("sira", { ascending: true }),
    ])

    setOrtaklar(ortakRes.data || [])
    setPersoneller(personelRes.data || [])
    setFirmalar(firmaRes.data || [])

    const saved = (data || []) as TableColumnSetting[]
    const getSavedColumns = (tableType: TableType) => {
      const byKey = new Map<string, TableColumnSetting>()
      saved
        .filter(column => column.table_type === tableType)
        .forEach(column => {
          const previous = byKey.get(column.column_key)
          if (!previous || column.sube_id === currentSube.id) {
            byKey.set(column.column_key, { ...column, sube_id: currentSube.id })
          }
        })
      return [...byKey.values()]
    }

    setColumns({
      gelir: mergeColumnSettings("gelir", getSavedColumns("gelir")),
      gider: mergeColumnSettings("gider", getSavedColumns("gider")),
      on_dort_no_hesap: mergeColumnSettings("on_dort_no_hesap", getSavedColumns("on_dort_no_hesap")),
    })
    setLoading(false)
  }

  function updateColumns(tableType: TableType, updater: (items: TableColumnSetting[]) => TableColumnSetting[]) {
    setSaveMessage(null)
    markDirty()
    setColumns(prev => ({
      ...prev,
      [tableType]: updater(prev[tableType]).map((column, index) => ({ ...column, sort_order: index })),
    }))
  }

  function updateColumn(tableType: TableType, columnKey: string, patch: Partial<TableColumnSetting>) {
    const current = columns[tableType].find(column => column.column_key === columnKey)
    if (patch.aktif === false && current?.aktif) {
      logSecurityEvent("column_hide", {
        table_type: tableType,
        column_key: columnKey,
        label: current.label,
        sube_id: currentSube?.id,
      })
    }
    updateColumns(tableType, items => items.map(column => (
      column.column_key === columnKey ? { ...column, ...patch } : column
    )))
  }

  function moveColumn(tableType: TableType, columnKey: string, direction: -1 | 1) {
    updateColumns(tableType, items => {
      const index = items.findIndex(column => column.column_key === columnKey)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items
      const next = [...items]
      const current = next[index]
      next[index] = next[nextIndex]
      next[nextIndex] = current
      return next
    })
  }

  function dragColumn(tableType: TableType, targetColumnKey: string) {
    if (!draggedColumnKey || draggedColumnKey === targetColumnKey) return
    updateColumns(tableType, items => {
      const fromIndex = items.findIndex(column => column.column_key === draggedColumnKey)
      const toIndex = items.findIndex(column => column.column_key === targetColumnKey)
      if (fromIndex < 0 || toIndex < 0) return items
      const next = [...items]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
    setDragOverColumnKey(null)
  }

  function addColumn(tableType: TableType) {
    const label = newLabel.trim()
    if (!label) return
    if (!currentSube) return
    updateColumns(tableType, items => [
      ...items,
      {
        sube_id: currentSube.id,
        table_type: tableType,
        column_key: makeCustomColumnKey(label),
        label: label.toLocaleUpperCase("tr-TR"),
        color: "bg-blue-600",
        sort_order: items.length,
        aktif: true,
        builtin: false,
      },
    ])
    setNewLabel("")
  }

  function removeColumn(tableType: TableType, columnKey: string) {
    const current = columns[tableType].find(column => column.column_key === columnKey)
    logSecurityEvent("column_delete", {
      table_type: tableType,
      column_key: columnKey,
      label: current?.label,
      sube_id: currentSube?.id,
      builtin: current?.builtin,
    })
    updateColumns(tableType, items => items.flatMap(column => {
      if (column.column_key !== columnKey) return [column]
      return column.builtin ? [{ ...column, aktif: false }] : []
    }))
  }

  async function saveColumns() {
    if (!currentSube) return false
    setSaving(true)
    const rows = Object.values(columns).flat().map((column) => ({
      sube_id: currentSube.id,
      table_type: column.table_type,
      column_key: column.column_key,
      label: column.label,
      color: column.color,
      sort_order: column.sort_order,
      aktif: column.aktif,
      builtin: column.builtin,
      updated_at: new Date().toISOString(),
    }))
    const savedKeys = new Set(rows.map(columnIdentity))

    const { error: upsertError } = await supabase
      .from("kolon_ayarlari")
      .upsert(rows, { onConflict: "sube_id,table_type,column_key" })

    if (upsertError) {
      setSaving(false)
      setSaveMessage({ type: "error", text: `Sütun ayarları kaydedilemedi: ${upsertError.message}` })
      return false
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("kolon_ayarlari")
      .select("id, sube_id, table_type, column_key")
      .or(`sube_id.eq.${currentSube.id},sube_id.is.null`)
      .in("table_type", ["gelir", "gider", "on_dort_no_hesap"])

    if (existingError) {
      setSaving(false)
      setSaveMessage({ type: "error", text: `Eski sütun kayıtları kontrol edilemedi: ${existingError.message}` })
      return false
    }

    const staleIds = (existingRows || [])
      .filter(column => !column.sube_id || !savedKeys.has(columnIdentity(column)))
      .map(column => column.id)

    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("kolon_ayarlari")
        .delete()
        .in("id", staleIds)

      if (deleteError) {
        setSaving(false)
        setSaveMessage({ type: "error", text: `Silinen sütun kayıtları temizlenemedi: ${deleteError.message}` })
        return false
      }
    }

    setSaving(false)
    markClean()
    setSaveMessage({ type: "success", text: "Sütun ayarları kaydedildi." })
    toast.success("Değişiklikler kaydedildi ✅")
    loadData()
    return true
  }

  function renderColumnPreview(tableType: TableType) {
    const items = columns[tableType].filter(column => column.aktif)
    const previewItems = items.flatMap(column => {
      if (tableType === "gelir" && column.column_key === FIRMALAR_GROUP_KEY) {
        return firmalar.map(firma => ({
          ...column,
          column_key: `firma_${firma.id}`,
          label: firma.ad.toLocaleUpperCase("tr-TR"),
          color: firma.color || column.color,
        }))
      }

      if (tableType === "gider" && column.column_key === ORTAKLAR_GROUP_KEY) {
        return ortaklar.map(ortak => ({
          ...column,
          column_key: `ortak_${ortak.id}`,
          label: ortak.ad.toLocaleUpperCase("tr-TR"),
        }))
      }

      if (tableType === "gider" && column.column_key === PERSONELLER_GROUP_KEY) {
        return personeller.map(personel => ({
          ...column,
          column_key: `personel_${personel.id}`,
          label: personel.ad.toLocaleUpperCase("tr-TR"),
        }))
      }

      return [column]
    })

    return (
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Sütun Önizleme</h3>
          <p className="text-xs text-muted-foreground">Tabloda görünecek başlık sırası ve renkleri.</p>
        </div>
        <div className="mobile-scroll visible-x-scroll overflow-x-auto p-3 pb-4">
          <div className="flex min-w-max items-stretch">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-r-0 bg-muted text-sm font-bold text-muted-foreground">
              #
            </div>
            {previewItems.map(column => (
              <div
                key={column.column_key}
                className={`flex h-10 min-w-32 shrink-0 items-center justify-center border border-r-0 px-3 text-center text-sm font-bold leading-tight last:border-r ${
                  getColumnColorClass(column.color)
                  } ${getColumnTextColor(column.color)}`}
                style={getColumnColorStyle(column.color)}
                title={column.label}
              >
                <span className="whitespace-nowrap">{column.label || "SÜTUN"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderTableSettings(tableType: TableType) {
    const items = columns[tableType]

    return (
      <div className="space-y-4">
        {renderColumnPreview(tableType)}

        <div className="flex max-w-xl gap-2">
          <Input
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Yeni sütun adı"
            onKeyDown={(event) => event.key === "Enter" && addColumn(tableType)}
          />
          <Button onClick={() => addColumn(tableType)} className="gap-2">
            <Plus className="h-4 w-4" />
            Ekle
          </Button>
        </div>

        <div className="sticky-table-scroll rounded-lg border">
          <table className="sticky-table w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-3 text-left">Sıra</th>
                <th className="p-3 text-left">Sütun Adı</th>
                <th className="p-3 text-left">Renk</th>
                <th className="p-3 text-left">Önizleme</th>
                <th className="p-3 text-center">Durum</th>
                <th className="p-3 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((column, index) => (
                <tr
                  key={column.column_key}
                  draggable
                  onDragStart={() => {
                    setDraggedColumnKey(column.column_key)
                    setDragOverColumnKey(null)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (draggedColumnKey && draggedColumnKey !== column.column_key) {
                      setDragOverColumnKey(column.column_key)
                    }
                  }}
                  onDrop={() => dragColumn(tableType, column.column_key)}
                  onDragEnd={() => {
                    setDraggedColumnKey(null)
                    setDragOverColumnKey(null)
                  }}
                  className={`relative border-b transition-all duration-300 ease-out ${
                    !column.aktif ? "bg-muted/40 opacity-70" : ""
                  } ${
                    draggedColumnKey === column.column_key
                      ? "z-10 scale-[1.01] bg-blue-50/90 opacity-80 shadow-2xl shadow-blue-500/20 ring-2 ring-blue-400/50 dark:bg-blue-500/15"
                      : ""
                  } ${
                    dragOverColumnKey === column.column_key
                      ? "bg-amber-50 shadow-inner ring-2 ring-amber-400/70 dark:bg-amber-500/15 dark:ring-amber-300/50"
                      : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <GripVertical className={`h-4 w-4 cursor-grab text-muted-foreground transition-transform duration-300 ${draggedColumnKey === column.column_key ? "scale-125 text-blue-600 dark:text-blue-300" : ""}`} />
                      <Button variant="ghost" size="icon" onClick={() => moveColumn(tableType, column.column_key, -1)} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => moveColumn(tableType, column.column_key, 1)} disabled={index === items.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                  <td className="p-3">
                    <Input
                      value={column.label}
                      onChange={(event) => updateColumn(tableType, column.column_key, { label: event.target.value.toLocaleUpperCase("tr-TR") })}
                      disabled={
                        column.column_key === "tarih" ||
                        column.column_key === "vardiya" ||
                        column.column_key === FIRMALAR_GROUP_KEY ||
                        column.column_key === ORTAKLAR_GROUP_KEY ||
                        column.column_key === PERSONELLER_GROUP_KEY
                      }
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                        {[
                          { value: "bg-green-600", color: "#16a34a", label: "Yeşil" },
                          { value: "bg-blue-600", color: "#2563eb", label: "Mavi" },
                          { value: "bg-yellow-500", color: "#eab308", label: "Sarı" },
                          { value: "bg-orange-500", color: "#f97316", label: "Turuncu" },
                          { value: "bg-red-600", color: "#dc2626", label: "Kırmızı" },
                          { value: "bg-purple-600", color: "#9333ea", label: "Mor" },
                          { value: "bg-gray-700", color: "#374151", label: "Gri" },
                          { value: "bg-pink-600", color: "#db2777", label: "Pembe" },
                          { value: "bg-cyan-600", color: "#0891b2", label: "Turkuaz" },
                        ].map((preset) => {
                          const isSelected = column.color === preset.value;
                          return (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => updateColumn(tableType, column.column_key, { color: preset.value })}
                              className={`h-6 w-6 rounded-full border border-black/10 transition-all hover:scale-110 active:scale-95 shadow-sm ${
                                isSelected ? "ring-2 ring-indigo-500 ring-offset-1 scale-105" : "opacity-80 hover:opacity-100"
                              }`}
                              style={{ backgroundColor: preset.color }}
                              title={preset.label}
                            />
                          );
                        })}
                        {/* Custom Color Picker Button */}
                        <div className="relative h-6 w-6">
                          <input
                            type="color"
                            value={column.color.startsWith("#") ? column.color : "#2563eb"}
                            onChange={(e) => updateColumn(tableType, column.column_key, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                          />
                          <div
                            className={`h-6 w-6 rounded-full border border-dashed border-slate-400 flex items-center justify-center bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 hover:scale-110 transition-transform shadow-sm ${
                              column.color.startsWith("#") ? "ring-2 ring-indigo-500 ring-offset-1 scale-105" : "opacity-80"
                            }`}
                            title="Özel Renk Seç"
                          >
                            <span className="text-[11px] text-white font-black leading-none">+</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hex input if custom color is selected */}
                      {column.color.startsWith("#") && (
                        <input
                          type="text"
                          value={column.color}
                          onChange={(e) => updateColumn(tableType, column.column_key, { color: e.target.value })}
                          className="h-8 w-20 rounded border bg-background px-1.5 text-xs font-mono text-foreground outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          placeholder="#000000"
                        />
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div
                      className={`inline-flex min-w-32 justify-center rounded px-3 py-2 font-semibold ${getColumnColorClass(column.color)} ${getColumnTextColor(column.color)}`}
                      style={getColumnColorStyle(column.color)}
                    >
                      {column.label || "SÜTUN"}
                    </div>
                    {tableType === "gider" && column.column_key === ORTAKLAR_GROUP_KEY && (
                      <div className="mt-1 text-xs text-muted-foreground">Ön izlemede ortak adları görünür.</div>
                    )}
                    {tableType === "gider" && column.column_key === PERSONELLER_GROUP_KEY && (
                      <div className="mt-1 text-xs text-muted-foreground">Ön izlemede personel adları görünür.</div>
                    )}
                    {tableType === "gelir" && column.column_key === FIRMALAR_GROUP_KEY && (
                      <div className="mt-1 text-xs text-muted-foreground">On izlemede Ayarlar'daki firma renkleri gorunur.</div>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => updateColumn(tableType, column.column_key, { aktif: !column.aktif })}
                      disabled={column.column_key === "tarih"}
                    >
                      {column.aktif ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    {!column.aktif && <div className="mt-1 text-xs text-muted-foreground">Gizli</div>}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeColumn(tableType, column.column_key)}
                      disabled={column.column_key === "tarih"}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
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
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sütun Ayarları</h1>
          <p className="text-sm text-muted-foreground">
            {currentSube?.ad ? `${currentSube.ad} şubesi için gelir, gider ve 14 numara hesap sütun ayarları.` : "Şube seçimi bekleniyor."}
          </p>
        </div>
        <Button onClick={saveColumns} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
      {saveMessage && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            saveMessage.type === "success"
              ? "border-green-200 bg-green-50 text-green-700 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-200"
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tablo Ayarları</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TableType)}>
            <TabsList>
              <TabsTrigger value="gelir">Gelir Tablosu</TabsTrigger>
              <TabsTrigger value="gider">Gider Tablosu</TabsTrigger>
              <TabsTrigger value="on_dort_no_hesap">14 Numara Hesap</TabsTrigger>
            </TabsList>
            <TabsContent value="gelir" className="pt-4">
              {renderTableSettings("gelir")}
            </TabsContent>
            <TabsContent value="gider" className="pt-4">
              {renderTableSettings("gider")}
            </TabsContent>
            <TabsContent value="on_dort_no_hesap" className="pt-4">
              {renderTableSettings("on_dort_no_hesap")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
