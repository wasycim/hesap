"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { TableColumnSetting, getColumnTextColor, mergeColumnSettings } from "@/lib/table-column-settings"

interface Ortak {
  id: string
  ad: string
}

interface Personel {
  id: string
  ad: string
}

interface GiderRow {
  id?: string
  tarih: string
  vardiya: string
  el_fisi_odeme: number
  ortak_paylari: Record<string, number>
  personel_paylari: Record<string, number>
  personel_mesai: number
  bil_iade: number
  inegol_donus: number
  yemek: number
  yanmaz_bilet: number
  diger: number
  ziraat_bankasi: number
  is_bankasi: number
  kuveyt_turk: number
  bakiye_bilet: number
  kargo_cari: number
  hesaba_gelen: number
  on_dort_noya_giden: number
  carsi_bilet: number
  darica_bilet: number
  kredi_karti_bakiye: number
  bankaya_yatan: number
  genel_toplam: number
  custom_values: Record<string, number>
}

interface GiderSpreadsheetProps {
  month: string
  year: number
}

// Sabit sütunlar ve renkleri
const FIXED_COLUMNS = [
  { key: "tarih", label: "TARİH", color: "bg-green-600", editable: false },
  { key: "vardiya", label: "VARDİYA", color: "bg-blue-600", editable: false },
  { key: "el_fisi_odeme", label: "EL FİŞİ ÖDEME", color: "bg-yellow-500", editable: true },
]

const ORTAK_COLOR = "bg-yellow-500"
const PERSONEL_COLOR = "bg-blue-600"

const MIDDLE_COLUMNS = [
  { key: "personel_mesai", label: "PERSONEL MESAİ", color: "bg-blue-600", editable: true },
  { key: "bil_iade", label: "BİL.İADE", color: "bg-red-600", editable: true },
  { key: "inegol_donus", label: "İNEGÖL DÖNÜŞ", color: "bg-orange-500", editable: true },
  { key: "yemek", label: "YEMEK", color: "bg-orange-500", editable: true },
  { key: "yanmaz_bilet", label: "YANMAZ BİLET", color: "bg-orange-500", editable: true },
  { key: "diger", label: "DİĞER", color: "bg-gray-500", editable: true },
  { key: "ziraat_bankasi", label: "ZİRAAT BANKASI", color: "bg-green-600", editable: true },
  { key: "is_bankasi", label: "İŞ BANKASI", color: "bg-green-600", editable: true },
  { key: "kuveyt_turk", label: "KUVEYT TÜRK", color: "bg-green-600", editable: true },
  { key: "bakiye_bilet", label: "BAKİYE BİLET", color: "bg-blue-500", editable: true },
  { key: "kargo_cari", label: "KARGO CARİ", color: "bg-blue-500", editable: true },
  { key: "hesaba_gelen", label: "HESABA GELEN", color: "bg-green-600", editable: true },
  { key: "on_dort_noya_giden", label: "14 NOYA GİDEN", color: "bg-green-600", editable: true },
  { key: "carsi_bilet", label: "ÇARŞI BİLET", color: "bg-blue-500", editable: true },
  { key: "darica_bilet", label: "DARICA BİLET", color: "bg-blue-500", editable: true },
  { key: "kredi_karti_bakiye", label: "K.KARTI BAKİYE", color: "bg-blue-500", editable: true },
  { key: "bankaya_yatan", label: "BANKAYA YATAN", color: "bg-blue-700", editable: true },
  { key: "genel_toplam", label: "GENEL TOPLAM", color: "bg-red-700", editable: false },
]

const VARDIYASIZ_SUBELER = ["carsi", "darica"]
const VARDIYA_SIRASI: Record<string, number> = { S: 0, A: 1, "": 2 }

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

export function GiderSpreadsheet({ month, year }: GiderSpreadsheetProps) {
  const [rows, setRows] = useState<GiderRow[]>([])
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [columnSettings, setColumnSettings] = useState<TableColumnSetting[]>(mergeColumnSettings("gider", []))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const { currentSube, refreshKey, userVardiya, isAdmin } = useSube()
  
