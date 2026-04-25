"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Plus, Save, Trash2 } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"

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
  user_id?: string
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

const OTHER_GIDER_COLUMNS = [
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

export function GiderSpreadsheet({ month, year }: GiderSpreadsheetProps) {
  const [rows, setRows] = useState<GiderRow[]>([])
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletedRows, setDeletedRows] = useState<GiderRow[]>([])
  const [activeColumnKeys, setActiveColumnKeys] = useState<string[] | null>(null)
  const supabase = createClient()
  const { currentSube, refreshKey, userVardiya, isAdmin } = useSube()
  const { markClean, registerSaveHandler } = useUnsavedChanges()
  
  const ayYil = `${month}-${year}`

  // Vardiyası olmayan normal kullanıcılar için tek vardiya modu.
  // Bu modda vardiya kolonu görünmez, satır yine arka planda "S" olarak kaydedilir.
  const isSingleVardiya = !isAdmin && !userVardiya

  const aktifGiderKolonlari = activeColumnKeys ?? [
  "el_fisi_odeme",
  "personel_mesai",
  "bil_iade",
  "inegol_donus",
  "yemek",
  "yanmaz_bilet",
  "diger",
  "ziraat_bankasi",
  "is_bankasi",
  "kuveyt_turk",
  "bakiye_bilet",
  "kargo_cari",
  "hesaba_gelen",
  "on_dort_noya_giden",
  "carsi_bilet",
  "darica_bilet",
  "kredi_karti_bakiye",
  "bankaya_yatan",
  "genel_toplam",
]

  useEffect(() => {
    // Şube değiştiğinde önce mevcut verileri temizle
    setRows([])
    setDeletedRows([])
    
    if (currentSube) {
      loadData()
    }

    // Realtime subscription
    const channel = supabase
      .channel(`gider_changes_${currentSube?.id || 'none'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'gider_kayitlari',
        },
        () => {
          if (currentSube) loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [month, year, currentSube?.id, refreshKey])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) return

    const { data: kolonAyarData } = await supabase
      .from("sube_kolon_ayarlari")
      .select("kolon_key, aktif, sira")
      .eq("sube_id", currentSube.id)
      .eq("tablo", "gider")
      .order("sira", { ascending: true })

    if (kolonAyarData && kolonAyarData.length > 0) {
      setActiveColumnKeys(kolonAyarData.filter(k => k.aktif).map(k => k.kolon_key))
    } else {
      setActiveColumnKeys(null)
    }

    // Ortakları yükle (tüm şubelerde aynı)
    const { data: ortakData } = await supabase
    .from("ortaklar")
    .select("*")
    .eq("sube_id", currentSube.id)
    .eq("aktif", true)
    .order("sira", { ascending: true })
    
    if (ortakData) setOrtaklar(ortakData)

    // Personelleri yükle (tüm şubelerde aynı)
    const { data: personelData } = await supabase
    .from("personeller")
    .select("*")
    .eq("sube_id", currentSube.id)
    .eq("aktif", true)
    .order("sira", { ascending: true })
    
    if (personelData) setPersoneller(personelData)

    // Şubeye göre gider kayıtlarını yükle
    let query = supabase
      .from("gider_kayitlari")
      .select("*")
      .eq("sube_id", currentSube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true })

    // Vardiyası olan kullanıcılar diğer vardiyayı da görür ama düzenleyemez.
    // Sadece vardiyasız tek-vardiya kullanıcıda arka planda "S" kayıtları gösterilir.
    if (!isAdmin && isSingleVardiya) {
      query = query.eq("vardiya", "S")
    }

    const { data, error } = await query

    if (!error && data) {
      setRows(data.map(row => ({
        id: row.id,
        user_id: row.user_id,
        tarih: row.tarih,
        vardiya: row.vardiya || "S",
        el_fisi_odeme: Number(row.el_fisi_odeme) || 0,
        ortak_paylari: row.ortak_pilarim || {},
        personel_paylari: row.personel_paylari || {},
        personel_mesai: Number(row.personel_mesai) || 0,
        bil_iade: Number(row.bil_iade) || 0,
        inegol_donus: Number(row.inegol_donus) || 0,
        yemek: Number(row.yemek) || 0,
        yanmaz_bilet: Number(row.yanmaz_bilet) || 0,
        diger: Number(row.diger) || 0,
        ziraat_bankasi: Number(row.ziraat_bankasi) || 0,
        is_bankasi: Number(row.is_bankasi) || 0,
        kuveyt_turk: Number(row.kuveyt_turk) || 0,
        bakiye_bilet: Number(row.bakiye_bilet) || 0,
        kargo_cari: Number(row.kargo_cari) || 0,
        hesaba_gelen: Number(row.hesaba_gelen) || 0,
        on_dort_noya_giden: Number(row.on_dort_noya_giden) || 0,
        carsi_bilet: Number(row.carsi_bilet) || 0,
        darica_bilet: Number(row.darica_bilet) || 0,
        kredi_karti_bakiye: Number(row.kredi_karti_bakiye) || 0,
        bankaya_yatan: Number(row.bankaya_yatan) || 0,
        genel_toplam: Number(row.genel_toplam) || 0,
      })))
    }
    setLoading(false)
  }

  function getNextDate(): string {
    const monthIndex = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", 
      "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"].indexOf(month)
    
    if (rows.length === 0) {
      return `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`
    }
    
    const lastDate = new Date(rows[rows.length - 1].tarih)
    lastDate.setDate(lastDate.getDate() + 1)
    return lastDate.toISOString().split("T")[0]
  }

  function calculateTotal(row: GiderRow): number {
    let total = row.el_fisi_odeme + row.personel_mesai + row.bil_iade + 
      row.inegol_donus + row.yemek + row.yanmaz_bilet + row.diger +
      row.ziraat_bankasi + row.is_bankasi + row.kuveyt_turk +
      row.bakiye_bilet + row.kargo_cari + row.hesaba_gelen +
      row.on_dort_noya_giden + row.carsi_bilet + row.darica_bilet +
      row.kredi_karti_bakiye + row.bankaya_yatan

    // Ortak paylarını ekle
    Object.values(row.ortak_paylari).forEach(val => {
      total += Number(val) || 0
    })

    // Personel paylarını ekle
    Object.values(row.personel_paylari).forEach(val => {
      total += Number(val) || 0
    })

    return total
  }

  function addRow() {
    const nextDate = getNextDate()

    const vardiyalarToAdd = isAdmin ? ["S", "A"] : [userVardiya || "S"]

    const newRowsToAdd: GiderRow[] = vardiyalarToAdd.map((vardiya) => ({
      tarih: nextDate,
      vardiya,
      el_fisi_odeme: 0,
      ortak_paylari: {},
      personel_paylari: {},
      personel_mesai: 0,
      bil_iade: 0,
      inegol_donus: 0,
      yemek: 0,
      yanmaz_bilet: 0,
      diger: 0,
      ziraat_bankasi: 0,
      is_bankasi: 0,
      kuveyt_turk: 0,
      bakiye_bilet: 0,
      kargo_cari: 0,
      hesaba_gelen: 0,
      on_dort_noya_giden: 0,
      carsi_bilet: 0,
      darica_bilet: 0,
      kredi_karti_bakiye: 0,
      bankaya_yatan: 0,
      genel_toplam: 0,
    }))

    const newRows = [...rows, ...newRowsToAdd].sort((a, b) => {
      const dateCompare = a.tarih.localeCompare(b.tarih)
      if (dateCompare !== 0) return dateCompare
      return a.vardiya.localeCompare(b.vardiya)
    })

    setRows(newRows)
  }

  function deleteRow(index: number) {
    const rowToDelete = rows[index]

    if (rowToDelete?.id) {
      setDeletedRows(prev => [...prev, rowToDelete])
    }

    const newRows = [...rows]
    newRows.splice(index, 1)
    setRows(newRows)
  }

  function updateCell(rowIndex: number, key: string, value: number, type?: "ortak" | "personel") {
    const newRows = [...rows]
    const row = { ...newRows[rowIndex] }
    
    if (type === "ortak") {
      row.ortak_paylari = { ...row.ortak_paylari, [key]: value }
    } else if (type === "personel") {
      row.personel_paylari = { ...row.personel_paylari, [key]: value }
    } else {
      (row as any)[key] = value
    }
    
    // Genel toplamı hesapla
    row.genel_toplam = calculateTotal(row)
    
    newRows[rowIndex] = row
    setRows(newRows)
  }

  async function saveData() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      return
    }

    // Sadece düzenleyebildiğim vardiyaları filtrele
    const editableRows = rows.filter(row => {
      if (isAdmin) return true
      if (isSingleVardiya) return row.vardiya === "S"
      return row.vardiya === userVardiya
    })

    // Çöp kutusuyla silinen kayıtları veritabanından sil
    const deletedEditableRows = deletedRows.filter(row => {
      if (isAdmin) return true
      if (isSingleVardiya) return row.vardiya === "S"
      return row.vardiya === userVardiya
    })

    for (const row of deletedEditableRows) {
      const { error: deleteError } = await supabase
        .from("gider_kayitlari")
        .delete()
        .eq("id", row.id)

      if (deleteError) {
        console.log("Gider silme hatası:", deleteError)
        alert("Gider silinemedi: " + deleteError.message)
        setSaving(false)
        return
      }
    }

    // Yeni kayıtları ekle
    if (editableRows.length > 0) {
      const insertData = editableRows.map(row => ({
        user_id: row.user_id || user.id,
        sube_id: currentSube.id,
        ay_yil: ayYil,
        tarih: row.tarih,
        vardiya: row.vardiya,
        el_fisi_odeme: aktifGiderKolonlari.includes("el_fisi_odeme") ? row.el_fisi_odeme : 0,
        ortak_pilarim: row.ortak_paylari,
        personel_paylari: row.personel_paylari,
        personel_mesai: aktifGiderKolonlari.includes("personel_mesai") ? row.personel_mesai : 0,
        bil_iade: aktifGiderKolonlari.includes("bil_iade") ? row.bil_iade : 0,
        inegol_donus: aktifGiderKolonlari.includes("inegol_donus") ? row.inegol_donus : 0,
        yemek: aktifGiderKolonlari.includes("yemek") ? row.yemek : 0,
        yanmaz_bilet: aktifGiderKolonlari.includes("yanmaz_bilet") ? row.yanmaz_bilet : 0,
        diger: aktifGiderKolonlari.includes("diger") ? row.diger : 0,
        ziraat_bankasi: aktifGiderKolonlari.includes("ziraat_bankasi") ? row.ziraat_bankasi : 0,
        is_bankasi: aktifGiderKolonlari.includes("is_bankasi") ? row.is_bankasi : 0,
        kuveyt_turk: aktifGiderKolonlari.includes("kuveyt_turk") ? row.kuveyt_turk : 0,
        bakiye_bilet: aktifGiderKolonlari.includes("bakiye_bilet") ? row.bakiye_bilet : 0,
        kargo_cari: aktifGiderKolonlari.includes("kargo_cari") ? row.kargo_cari : 0,
        hesaba_gelen: aktifGiderKolonlari.includes("hesaba_gelen") ? row.hesaba_gelen : 0,
        on_dort_noya_giden: aktifGiderKolonlari.includes("on_dort_noya_giden") ? row.on_dort_noya_giden : 0,
        carsi_bilet: aktifGiderKolonlari.includes("carsi_bilet") ? row.carsi_bilet : 0,
        darica_bilet: aktifGiderKolonlari.includes("darica_bilet") ? row.darica_bilet : 0,
        kredi_karti_bakiye: aktifGiderKolonlari.includes("kredi_karti_bakiye") ? row.kredi_karti_bakiye : 0,
        bankaya_yatan: aktifGiderKolonlari.includes("bankaya_yatan") ? row.bankaya_yatan : 0,
        genel_toplam: row.genel_toplam,
      }))

      const { error } = await supabase
        .from("gider_kayitlari")
        .upsert(insertData, {
          onConflict: "sube_id,ay_yil,tarih,vardiya",
        })

      if (error) {
        console.log("Gider kaydetme hatası:", error)
        alert("Gider kaydedilemedi: " + error.message)
        setSaving(false)
        return
      }

      // Gelir tablosundaki giderler sütununu güncelle (aynı tarihe göre)
      for (const row of editableRows) {
        await supabase
          .from("gelir_kayitlari")
          .update({ 
            giderler: row.genel_toplam,
            kalan: supabase.rpc ? undefined : 0 // kalan = toplam - giderler (frontend'de hesaplanacak)
          })
          .eq("sube_id", currentSube.id)
          .eq("ay_yil", ayYil)
          .eq("tarih", row.tarih)
          .eq("vardiya", row.vardiya)
      }
    }

    setDeletedRows([])
    markClean()
    setSaving(false)
    loadData()
  }

  useEffect(() => {
    registerSaveHandler(saveData)

    return () => {
      registerSaveHandler(null)
    }
  })

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const isStaticColumnVisible = (key: string) => {
    if (key === "tarih" || key === "vardiya" || key === "genel_toplam") return true
    if (!activeColumnKeys) return true
    return activeColumnKeys.includes(key)
  }

  const visibleFixedColumns = FIXED_COLUMNS.filter(col => {
    if (col.key === "vardiya" && isSingleVardiya) return false
    return isStaticColumnVisible(col.key)
  })
  const visibleOtherGiderColumns = OTHER_GIDER_COLUMNS.filter(col => isStaticColumnVisible(col.key))

  // Tüm sütunları oluştur
  const allColumns = [
    ...visibleFixedColumns,
    ...ortaklar.map(o => ({ key: `ortak_${o.id}`, label: o.ad.toUpperCase(), color: ORTAK_COLOR, editable: true, type: "ortak" as const })),
    ...personeller.map(p => ({ key: `personel_${p.id}`, label: p.ad.toUpperCase(), color: PERSONEL_COLOR, editable: true, type: "personel" as const })),
    ...visibleOtherGiderColumns,
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button onClick={addRow} size="sm" className="bg-green-600 hover:bg-green-700">
          <Plus className="w-4 h-4 mr-1" /> Satır Ekle
        </Button>
        <Button onClick={saveData} size="sm" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-1" /> {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>

      {(ortaklar.length === 0 || personeller.length === 0) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
          <strong>Dikkat:</strong> Önce &quot;Ayarlar&quot; sayfasından ortakları ve personelleri eklemeniz gerekiyor.
        </div>
      )}

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 border bg-gray-100 w-10 sticky left-0">#</th>
              {allColumns.map(col => (
                <th 
                  key={col.key} 
                  className={`p-2 border text-white font-semibold whitespace-nowrap ${col.color}`}
                >
                  {col.label}
                </th>
              ))}
              <th className="p-2 border bg-gray-100 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              // Vardiya kontrolü: userVardiya null ise hepsini düzenleyebilir, değilse sadece kendi vardiyasını
              const canEditVardiya = isAdmin || isSingleVardiya || userVardiya === row.vardiya
              
              return (
              <tr key={rowIndex} className={`hover:bg-gray-50 ${!canEditVardiya ? "bg-gray-100/50 opacity-70" : ""}`}>
                <td className="p-1 border text-center text-gray-500 sticky left-0 bg-white">{rowIndex + 1}</td>
                {allColumns.map(col => {
                  const isOrtak = col.key.startsWith("ortak_")
                  const isPersonel = col.key.startsWith("personel_")
                  const id = isOrtak ? col.key.replace("ortak_", "") : isPersonel ? col.key.replace("personel_", "") : null
                  
                  let value: number = 0
                  if (isOrtak && id) {
                    value = row.ortak_paylari[id] || 0
                  } else if (isPersonel && id) {
                    value = row.personel_paylari[id] || 0
                  } else {
                    value = (row as any)[col.key] || 0
                  }

                  return (
                    <td key={col.key} className="p-0 border">
                      {col.key === "tarih" ? (
                        <div className="px-2 py-1 bg-gray-100 text-center font-medium">
                          {formatDate(row.tarih)}
                        </div>
                      ) : col.key === "vardiya" ? (
                        <div className={`px-2 py-1 text-center font-bold ${
                          row.vardiya === "S" ? "bg-amber-100 text-amber-700" : "bg-indigo-100 text-indigo-700"
                        }`}>
                          {row.vardiya}
                        </div>
                      ) : col.key === "genel_toplam" ? (
                        <div className="px-2 py-1 text-right font-bold bg-red-100 text-red-800">
                          {formatNumber(row.genel_toplam)} ₺
                        </div>
                      ) : canEditVardiya ? (
                        <input
                          type="number"
                          value={value || ""}
                          onChange={(e) => {
                            const newVal = Number(e.target.value) || 0
                            if (isOrtak && id) {
                              updateCell(rowIndex, id, newVal, "ortak")
                            } else if (isPersonel && id) {
                              updateCell(rowIndex, id, newVal, "personel")
                            } else {
                              updateCell(rowIndex, col.key, newVal)
                            }
                          }}
                          className="w-full px-2 py-1 text-right focus:outline-none focus:bg-blue-50"
                          placeholder="0,00"
                        />
                      ) : (
                        <div className="px-2 py-1 text-right text-gray-600">
                          {formatNumber(value)} ₺
                        </div>
                      )}
                    </td>
                  )
                })}
                <td className="p-1 border">
                  {canEditVardiya && (
                    <button
                      onClick={() => deleteRow(rowIndex)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            )})}
            {rows.length === 0 && (
              <tr>
                <td colSpan={allColumns.length + 2} className="p-8 text-center text-gray-500">
                  Henüz kayıt yok. &quot;Satır Ekle&quot; butonuna tıklayarak başlayın.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
  <tfoot>
    <tr className="bg-gray-100 font-semibold">
      <td className="p-2 border"></td>

      {allColumns.map(col => {
        if (col.key === "tarih") {
          return (
            <td key={col.key} className="p-2 border text-center">
              TOPLAM
            </td>
          )
        }

        if (col.key === "vardiya") {
          return <td key={col.key} className="p-2 border"></td>
        }

        const total = rows.reduce((sum, row) => {
          if (col.key.startsWith("ortak_")) {
            const id = col.key.replace("ortak_", "")
            return sum + (Number(row.ortak_paylari[id]) || 0)
          }

          if (col.key.startsWith("personel_")) {
            const id = col.key.replace("personel_", "")
            return sum + (Number(row.personel_paylari[id]) || 0)
          }

          return sum + (Number((row as any)[col.key]) || 0)
        }, 0)

        return (
          <td key={col.key} className="p-2 border text-right">
            {formatNumber(total)} ₺
          </td>
        )
      })}

      <td className="p-2 border"></td>
    </tr>
  </tfoot>
)}
        </table>
      </div>
    </div>
  )
}
