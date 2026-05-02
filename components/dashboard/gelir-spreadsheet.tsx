"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { TableColumnSetting, getColumnTextColor, mergeColumnSettings } from "@/lib/table-column-settings"

interface GelirRow {
  id?: string
  user_id?: string
  sube_id?: string
  tarih: string
  vardiya: string
  pamukkale_turizm: number
  anadolu_ulasim: number
  inegol_seyahat: number
  alasehir_turizm: number
  unlu_1: number
  unlu_2: number
  pamukkale_kargo: number
  diger_komisyon: number
  kasa_gelen: number
  toplam: number
  giderler: number
  kalan: number
  durum: string
  custom_values: Record<string, number>
}

interface GelirSpreadsheetProps {
  month: string
  year: number
}

const HEADER_COLORS: Record<string, string> = {
  tarih: "bg-green-600",
  vardiya: "bg-blue-600",
  pamukkale_turizm: "bg-yellow-500",
  anadolu_ulasim: "bg-yellow-500",
  inegol_seyahat: "bg-yellow-500",
  alasehir_turizm: "bg-yellow-500",
  unlu_1: "bg-yellow-500",
  unlu_2: "bg-yellow-500",
  pamukkale_kargo: "bg-yellow-500",
  diger_komisyon: "bg-gray-500",
  kasa_gelen: "bg-purple-600",
  toplam: "bg-green-600",
  giderler: "bg-red-600",
  kalan: "bg-gray-700",
  durum: "bg-orange-200",
}

const HEADER_LABELS: Record<string, string> = {
  tarih: "TARİH",
  vardiya: "VARDİYA",
  pamukkale_turizm: "PAMUKKALE TURİZM",
  anadolu_ulasim: "ANADOLU ULAŞIM",
  inegol_seyahat: "İNEGÖL SEYAHAT",
  alasehir_turizm: "ALAŞEHİR TURİZM",
  unlu_1: "ÜNLÜ",
  unlu_2: "ÜNLÜ",
  pamukkale_kargo: "PAMUKKALE KARGO",
  diger_komisyon: "DİĞER KOMİSYON",
  kasa_gelen: "KASA-GELEN",
  toplam: "TOPLAM",
  giderler: "GİDERLER",
  kalan: "KALAN",
  durum: "DURUM",
}

const COLUMNS = [
  "tarih", "vardiya", "pamukkale_turizm", "anadolu_ulasim", "inegol_seyahat", 
  "alasehir_turizm", "unlu_1", "unlu_2", "pamukkale_kargo",
  "diger_komisyon", "kasa_gelen", "toplam", "giderler", "kalan", "durum"
]

const VARDIYASIZ_SUBELER = ["carsi", "darica"]
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

export function GelirSpreadsheet({ month, year }: GelirSpreadsheetProps) {
  const [rows, setRows] = useState<GelirRow[]>([])
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("gelir", []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { currentSube, isAdmin, currentUserId, refreshKey, userVardiya } = useSube()
  
  const ayYil = `${month}-${year}`
  const isVardiyasizSube = currentSube
    ? VARDIYASIZ_SUBELER.includes(normalizeSubeName(currentSube.ad))
    : false
  const activeColumnSettings = columnSettings.filter(col => col.aktif && (!isVardiyasizSube || col.column_key !== "vardiya"))
  const visibleColumns = activeColumnSettings.map(col => col.column_key)
  const columnColorMap = Object.fromEntries(activeColumnSettings.map(col => [col.column_key, col.color]))
