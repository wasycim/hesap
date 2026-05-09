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
  TableColumnSetting,
  TableType,
  getColumnTextColor,
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

export default function SutunAyarlarPage() {
  const [activeTab, setActiveTab] = useState<TableType>("gelir")
  const [columns, setColumns] = useState<Record<TableType, TableColumnSetting[]>>({
    gelir: createDefaultRows("gelir"),
    gider: createDefaultRows("gider"),
  })
  const [newLabel, setNewLabel] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error", text: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)
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
        label: label.toUpperCase(),
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
    const rows = [...columns.gelir, ...columns.gider].map((column) => ({
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
      .in("table_type", ["gelir", "gider"])

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

    return (
      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3">
          <h3 className="font-semibold">Sütun Önizleme</h3>
          <p className="text-xs text-muted-foreground">Tabloda görünecek başlık sırası ve renkleri.</p>
        </div>
        <div className="overflow-x-auto p-3">
          <div className="flex min-w-max items-stretch">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-r-0 bg-gray-100 text-sm font-bold">
              #
            </div>
            {items.map(column => (
              <div
                key={column.column_key}
                className={`flex h-10 min-w-32 shrink-0 items-center justify-center border border-r-0 px-3 text-center text-sm font-bold leading-tight last:border-r ${
                  column.color
                  } ${getColumnTextColor(column.color)}`}
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

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[820px] text-sm">
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
                  onDragStart={() => setDraggedColumnKey(column.column_key)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dragColumn(tableType, column.column_key)}
                  onDragEnd={() => setDraggedColumnKey(null)}
                  className={`border-b ${!column.aktif ? "bg-muted/40 opacity-70" : ""} ${draggedColumnKey === column.column_key ? "bg-blue-50" : ""}`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
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
                      onChange={(event) => updateColumn(tableType, column.column_key, { label: event.target.value.toUpperCase() })}
                      disabled={column.column_key === "tarih" || column.column_key === "vardiya"}
                    />
                  </td>
                  <td className="p-3">
                    <Select value={column.color} onValueChange={(value) => updateColumn(tableType, column.column_key, { color: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COLOR_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3">
                    <div className={`inline-flex min-w-32 justify-center rounded px-3 py-2 font-semibold ${column.color} ${getColumnTextColor(column.color)}`}>
                      {column.label || "SÜTUN"}
                    </div>
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
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sütun Ayarları</h1>
          <p className="text-sm text-muted-foreground">
            {currentSube?.ad ? `${currentSube.ad} şubesi için gelir ve gider sütun ayarları.` : "Şube seçimi bekleniyor."}
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
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
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
            </TabsList>
            <TabsContent value="gelir" className="pt-4">
              {renderTableSettings("gelir")}
            </TabsContent>
            <TabsContent value="gider" className="pt-4">
              {renderTableSettings("gider")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
