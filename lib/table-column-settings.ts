export type TableType = "gelir" | "gider" | "on_dort_no_hesap"

export interface TableColumnSetting {
  id?: string
  sube_id?: string
  table_type: TableType
  column_key: string
  label: string
  color: string
  sort_order: number
  aktif: boolean
  builtin: boolean
}

export const ORTAKLAR_GROUP_KEY = "ortaklar_group"
export const PERSONELLER_GROUP_KEY = "personeller_group"
export const FIRMALAR_GROUP_KEY = "firmalar_group"
export const ON_DORT_FIRMALAR_KEY = "on_dort_firmalar"
export const ON_DORT_FIRMA_DETAYLARI_KEY = "on_dort_firma_detaylari"

export const COLOR_OPTIONS = [
  { label: "Yeşil", value: "bg-green-600", text: "text-white" },
  { label: "Mavi", value: "bg-blue-600", text: "text-white" },
  { label: "Açık Mavi", value: "bg-blue-500", text: "text-white" },
  { label: "Koyu Mavi", value: "bg-blue-700", text: "text-white" },
  { label: "Sarı", value: "bg-yellow-500", text: "text-white" },
  { label: "Turuncu", value: "bg-orange-500", text: "text-white" },
  { label: "Kırmızı", value: "bg-red-600", text: "text-white" },
  { label: "Koyu Kırmızı", value: "bg-red-700", text: "text-white" },
  { label: "Mor", value: "bg-purple-600", text: "text-white" },
  { label: "Gri", value: "bg-gray-500", text: "text-white" },
  { label: "Koyu Gri", value: "bg-gray-700", text: "text-white" },
  { label: "Açık Turuncu", value: "bg-orange-200", text: "text-orange-800" },
]

export function getColumnTextColor(color: string): string {
  if (!color) return "text-white"
  const trimmed = color.trim()
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    let hex = trimmed.replace("#", "")
    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("")
    }
    if (hex.length !== 6) return "text-white"
    const r = parseInt(hex.substring(0, 2), 16)
    const g = parseInt(hex.substring(2, 4), 16)
    const b = parseInt(hex.substring(4, 6), 16)
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000
    return yiq >= 128 ? "text-slate-900" : "text-white"
  }
  return COLOR_OPTIONS.find(option => option.value === color)?.text || "text-white"
}

export function getColumnColorClass(color: string): string {
  if (!color) return ""
  const trimmed = color.trim()
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    return ""
  }
  return color
}

export function getColumnColorStyle(color: string): Record<string, string> {
  if (!color) return {}
  const trimmed = color.trim()
  if (trimmed.startsWith("#") || trimmed.startsWith("rgb") || trimmed.startsWith("hsl")) {
    return { backgroundColor: trimmed }
  }
  return {}
}

export const GELIR_DEFAULT_COLUMNS: TableColumnSetting[] = [
  { table_type: "gelir", column_key: "tarih", label: "TARİH", color: "bg-green-600", sort_order: 0, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "vardiya", label: "VARDİYA", color: "bg-blue-600", sort_order: 1, aktif: true, builtin: true },
  { table_type: "gelir", column_key: FIRMALAR_GROUP_KEY, label: "FİRMALAR BÖLÜMÜ", color: "bg-yellow-500", sort_order: 2, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "pamukkale_turizm", label: "PAMUKKALE TURİZM", color: "bg-yellow-500", sort_order: 3, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "anadolu_ulasim", label: "ANADOLU ULAŞIM", color: "bg-yellow-500", sort_order: 4, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "inegol_seyahat", label: "İNEGÖL SEYAHAT", color: "bg-yellow-500", sort_order: 5, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "alasehir_turizm", label: "ALAŞEHİR TURİZM", color: "bg-yellow-500", sort_order: 6, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "unlu_1", label: "ÜNLÜ", color: "bg-yellow-500", sort_order: 7, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "unlu_2", label: "ÜNLÜ", color: "bg-yellow-500", sort_order: 8, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "pamukkale_kargo", label: "PAMUKKALE KARGO", color: "bg-yellow-500", sort_order: 9, aktif: true, builtin: true },
  { table_type: "gelir", column_key: ON_DORT_FIRMALAR_KEY, label: "14 NO FİRMALAR", color: "bg-lime-600", sort_order: 10, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "diger_komisyon", label: "DİĞER KOMİSYON", color: "bg-gray-500", sort_order: 11, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "kasa_gelen", label: "KASA-GELEN", color: "bg-purple-600", sort_order: 12, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "toplam", label: "TOPLAM", color: "bg-green-600", sort_order: 13, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "giderler", label: "GİDERLER", color: "bg-red-600", sort_order: 14, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "kalan", label: "KALAN", color: "bg-gray-700", sort_order: 15, aktif: true, builtin: true },
  { table_type: "gelir", column_key: "durum", label: "DURUM", color: "bg-orange-200", sort_order: 16, aktif: true, builtin: true },
]

export const GIDER_DEFAULT_COLUMNS: TableColumnSetting[] = [
  { table_type: "gider", column_key: "tarih", label: "TARİH", color: "bg-green-600", sort_order: 0, aktif: true, builtin: true },
  { table_type: "gider", column_key: "vardiya", label: "VARDİYA", color: "bg-blue-600", sort_order: 1, aktif: true, builtin: true },
  { table_type: "gider", column_key: "el_fisi_odeme", label: "EL FİŞİ ÖDEME", color: "bg-yellow-500", sort_order: 2, aktif: true, builtin: true },
  { table_type: "gider", column_key: ORTAKLAR_GROUP_KEY, label: "ORTAKLAR BÖLÜMÜ", color: "bg-yellow-500", sort_order: 3, aktif: true, builtin: true },
  { table_type: "gider", column_key: PERSONELLER_GROUP_KEY, label: "PERSONELLER BÖLÜMÜ", color: "bg-blue-600", sort_order: 4, aktif: true, builtin: true },
  { table_type: "gider", column_key: "personel_mesai", label: "PERSONEL MESAİ", color: "bg-blue-600", sort_order: 5, aktif: true, builtin: true },
  { table_type: "gider", column_key: "bil_iade", label: "BİL. İADE", color: "bg-red-600", sort_order: 6, aktif: true, builtin: true },
  { table_type: "gider", column_key: "inegol_donus", label: "İNEGÖL DÖNÜŞ", color: "bg-orange-500", sort_order: 7, aktif: true, builtin: true },
  { table_type: "gider", column_key: "yemek", label: "YEMEK", color: "bg-orange-500", sort_order: 8, aktif: true, builtin: true },
  { table_type: "gider", column_key: "yanmaz_bilet", label: "YANMAZ BİLET", color: "bg-orange-500", sort_order: 9, aktif: true, builtin: true },
  { table_type: "gider", column_key: "diger", label: "DİĞER", color: "bg-gray-500", sort_order: 10, aktif: true, builtin: true },
  { table_type: "gider", column_key: "ziraat_bankasi", label: "ZİRAAT BANKASI", color: "bg-green-600", sort_order: 11, aktif: true, builtin: true },
  { table_type: "gider", column_key: "is_bankasi", label: "İŞ BANKASI", color: "bg-green-600", sort_order: 12, aktif: true, builtin: true },
  { table_type: "gider", column_key: "kuveyt_turk", label: "KUVEYT TÜRK", color: "bg-green-600", sort_order: 13, aktif: true, builtin: true },
  { table_type: "gider", column_key: "bakiye_bilet", label: "BAKİYE BİLET", color: "bg-blue-500", sort_order: 14, aktif: true, builtin: true },
  { table_type: "gider", column_key: "kargo_cari", label: "KARGO CARİ", color: "bg-blue-500", sort_order: 15, aktif: true, builtin: true },
  { table_type: "gider", column_key: "hesaba_gelen", label: "HESABA GELEN", color: "bg-green-600", sort_order: 16, aktif: true, builtin: true },
  { table_type: "gider", column_key: "on_dort_noya_giden", label: "14 NOYA GİDEN", color: "bg-green-600", sort_order: 17, aktif: true, builtin: true },
  { table_type: "gider", column_key: "carsi_bilet", label: "ÇARŞI BİLET", color: "bg-blue-500", sort_order: 18, aktif: true, builtin: true },
  { table_type: "gider", column_key: "darica_bilet", label: "DARICA BİLET", color: "bg-blue-500", sort_order: 19, aktif: true, builtin: true },
  { table_type: "gider", column_key: "kredi_karti_bakiye", label: "K.KARTI BAKİYE", color: "bg-blue-500", sort_order: 20, aktif: true, builtin: true },
  { table_type: "gider", column_key: "bankaya_yatan", label: "BANKAYA YATAN", color: "bg-blue-700", sort_order: 21, aktif: true, builtin: true },
  { table_type: "gider", column_key: "genel_toplam", label: "GENEL TOPLAM", color: "bg-red-700", sort_order: 22, aktif: true, builtin: true },
]

export const ON_DORT_NO_HESAP_DEFAULT_COLUMNS: TableColumnSetting[] = [
  { table_type: "on_dort_no_hesap", column_key: "pamukkale_turizm", label: "PAMUKKALE TURİZM", color: "bg-yellow-500", sort_order: 0, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "anadolu_turizm", label: "ANADOLU TURİZM", color: "bg-yellow-500", sort_order: 1, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "inegol_seyahat", label: "İNEGÖL SEYAHAT", color: "bg-yellow-500", sort_order: 2, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "on_dort_no_giden", label: "14 NO GİDEN", color: "bg-orange-500", sort_order: 3, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "diger_kasa", label: "DİĞER - KASA", color: "bg-purple-600", sort_order: 4, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "gelir_toplam", label: "TOPLAM", color: "bg-green-600", sort_order: 5, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "kredi_karti_14_no", label: "14 NO KREDİ KARTI", color: "bg-blue-500", sort_order: 6, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "teslim", label: "TESLİM", color: "bg-blue-500", sort_order: 7, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "diger", label: "DİĞER", color: "bg-gray-500", sort_order: 8, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "gider_toplam", label: "TOPLAM", color: "bg-red-600", sort_order: 9, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "bankaya_gonderilen", label: "BANKAYA GÖNDERİLEN", color: "bg-blue-700", sort_order: 10, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "kontur_yukleme", label: "KONTÜR YÜKLEME", color: "bg-orange-500", sort_order: 11, aktif: true, builtin: true },
  { table_type: "on_dort_no_hesap", column_key: "kalan", label: "KALAN", color: "bg-gray-700", sort_order: 12, aktif: true, builtin: true },
]

export function getDefaultColumns(tableType: TableType): TableColumnSetting[] {
  if (tableType === "gelir") return GELIR_DEFAULT_COLUMNS
  if (tableType === "gider") return GIDER_DEFAULT_COLUMNS
  return ON_DORT_NO_HESAP_DEFAULT_COLUMNS
}

export function mergeColumnSettings(tableType: TableType, saved: TableColumnSetting[] | null | undefined): TableColumnSetting[] {
  const defaults = getDefaultColumns(tableType)
  const savedMap = new Map((saved || []).map(column => [column.column_key, column]))
  const mergedDefaults = defaults.map(column => ({ ...column, ...savedMap.get(column.column_key), builtin: true }))
  const customColumns = (saved || []).filter(column => !defaults.some(defaultColumn => defaultColumn.column_key === column.column_key))
  return [...mergedDefaults, ...customColumns]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((column, index) => ({ ...column, sort_order: index }))
}

export function makeCustomColumnKey(label: string): string {
  const base = label
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `custom_${base || "sutun"}_${Date.now()}`
}
