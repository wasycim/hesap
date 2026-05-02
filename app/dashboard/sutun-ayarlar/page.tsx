"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react"
import {
  COLOR_OPTIONS,
  TableColumnSetting,
  TableType,
  getColumnTextColor,
  getDefaultColumns,
  makeCustomColumnKey,
  mergeColumnSettings,
} from "@/lib/table-column-settings"

function createDefaultRows(tableType: TableType) {
  return getDefaultColumns(tableType).map(column => ({ ...column }))
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
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

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

    const { data } = await supabase
      .from("kolon_ayarlari")
      .select("*")
      .order("sort_order", { ascending: true })

    const saved = (data || []) as TableColumnSetting[]
    setColumns({
      gelir: mergeColumnSettings("gelir", saved.filter(column => column.table_type === "gelir")),
      gider: mergeColumnSettings("gider", saved.filter(column => column.table_type === "gider")),
    })
    setLoading(false)
  }

  function updateColumns(tableType: TableType, updater: (items: TableColumnSetting[]) => TableColumnSetting[]) {
    setColumns(prev => ({
      ...prev,
      [tableType]: updater(prev[tableType]).map((column, index) => ({ ...column, sort_order: index })),
    }))
  }

  function updateColumn(tableType: TableType, columnKey: string, patch: Partial<TableColumnSetting>) {
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

  function addColumn(tableType: TableType) {
    const label = newLabel.trim()
    if (!label) return
    updateColumns(tableType, items => [
