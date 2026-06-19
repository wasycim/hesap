"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CreditCard, FileText, History, Loader2, Package, Save, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { useSube } from "@/contexts/sube-context"
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { MONTHS, getInitialMonth, getInitialYear, getLocalDateString, makeYearWindow } from "@/lib/date-navigation"
import { openPdfReport } from "@/lib/pdf-report"

interface KargoFirma {
  id: string
  ad: string
}

interface FirmaBorcOzet {
  firma_id: string
  firma_ad: string
  onceki_borc: number
  ay_borcu: number
  toplam_borc: number
  odenen: number
  kalan_borc: number
}

interface OdemeHareketi {
  id: string
  tarih: string
  firma_id: string
  firma_ad: string
  toplam_borc: number
  odenen: number
  kalan_borc: number
  notlar: string
  created_at: string | null
}

interface OdemeFormu {
  firmaId: string
  tarih: string
  odenen: string
  notlar: string
}

interface OdemeDuzeltmeFormu {
  firmaId: string
  tarih: string
  tutar: string
  notlar: string
}

export default function KargoCariOzetPage() {
  const [firmalar, setFirmalar] = useState<KargoFirma[]>([])
  const [borcOzetleri, setBorcOzetleri] = useState<FirmaBorcOzet[]>([])
  const [odemeHareketleri, setOdemeHareketleri] = useState<OdemeHareketi[]>([])
  const [odemeFormu, setOdemeFormu] = useState<OdemeFormu>({
    firmaId: "",
    tarih: getLocalDateString(),
    odenen: "",
    notlar: "",
  })
  const [duzeltmeFormu, setDuzeltmeFormu] = useState<OdemeDuzeltmeFormu>({
    firmaId: "",
    tarih: getLocalDateString(),
    tutar: "",
    notlar: "",
  })
  const [odemeFormuKirli, setOdemeFormuKirli] = useState(false)
  const [duzeltmeFormuKirli, setDuzeltmeFormuKirli] = useState(false)
  const [scope, setScope] = useState<"monthly" | "all">("monthly")
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [correcting, setCorrecting] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = createClient()
  const { currentSube } = useSube()
  const { markClean, markDirty, registerSaveHandler } = useUnsavedChanges()
  const years = makeYearWindow(year)
  const ayYil = `${month}-${year}`
  const selectedMonthIndex = MONTHS.findIndex(item => item === month)

  const selectedOzet = useMemo(
    () => borcOzetleri.find(ozet => ozet.firma_id === odemeFormu.firmaId) || null,
    [borcOzetleri, odemeFormu.firmaId],
  )
  const selectedDuzeltmeOzet = useMemo(
    () => borcOzetleri.find(ozet => ozet.firma_id === duzeltmeFormu.firmaId) || null,
    [borcOzetleri, duzeltmeFormu.firmaId],
  )
  const odemeTutari = Number(odemeFormu.odenen) || 0
  const duzeltmeTutari = Number(duzeltmeFormu.tutar) || 0
  const formKalanBorc = selectedOzet ? selectedOzet.kalan_borc - odemeTutari : 0
  const duzeltmeSonrasiOdenen = selectedDuzeltmeOzet ? selectedDuzeltmeOzet.odenen - duzeltmeTutari : 0
  const duzeltmeSonrasiKalan = selectedDuzeltmeOzet ? selectedDuzeltmeOzet.kalan_borc + duzeltmeTutari : 0
  const genelToplam = useMemo(() => borcOzetleri.reduce((acc, ozet) => ({
    onceki_borc: acc.onceki_borc + ozet.onceki_borc,
    ay_borcu: acc.ay_borcu + ozet.ay_borcu,
    toplam_borc: acc.toplam_borc + ozet.toplam_borc,
    odenen: acc.odenen + ozet.odenen,
    kalan_borc: acc.kalan_borc + ozet.kalan_borc,
  }), { onceki_borc: 0, ay_borcu: 0, toplam_borc: 0, odenen: 0, kalan_borc: 0 }), [borcOzetleri])

  useEffect(() => {
    if (currentSube) checkAdminAndLoadData()
  }, [currentSube?.id, scope, month, year])

  useEffect(() => {
    registerSaveHandler(async () => {
      const odemeKaydedildi = await saveYeniOdeme()
      if (!odemeKaydedildi) return false
      return saveOdemeDuzeltme()
    })
    return () => registerSaveHandler(null)
  }, [odemeFormu, odemeFormuKirli, duzeltmeFormu, duzeltmeFormuKirli, selectedOzet, selectedDuzeltmeOzet, currentSube?.id, scope, ayYil])

  function sumField<T extends Record<string, any>>(rows: T[] | null, key: keyof T) {
    return (rows || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0)
  }

  function parseAyYil(value: string | null | undefined) {
    const text = String(value || "").trim()
    const parts = text.split(/[-\s/]+/).filter(Boolean)
    const monthPart = parts[0] || ""
    const yearPart = parts.find(part => /^\d{4}$/.test(part)) || ""
    const monthIndex = MONTHS.findIndex(item => item.toLocaleLowerCase("tr-TR") === monthPart.toLocaleLowerCase("tr-TR"))
    const parsedYear = Number(yearPart)

    if (monthIndex < 0 || !Number.isFinite(parsedYear)) return null
    return { monthIndex, year: parsedYear }
  }

  function isAyYilBefore(value: string | null | undefined) {
    const parsed = parseAyYil(value)
    if (!parsed || selectedMonthIndex < 0) return false

    return parsed.year < year || (parsed.year === year && parsed.monthIndex < selectedMonthIndex)
  }

  function isCurrentAyYil(value: string | null | undefined) {
    const parsed = parseAyYil(value)
    if (!parsed || selectedMonthIndex < 0) return false

    return parsed.year === year && parsed.monthIndex === selectedMonthIndex
  }

  function buildPaymentTotals(
    aggregateRows: Array<{ ay_yil: string | null; odenen: number | string | null }> | null,
    movementRows: Array<{ ay_yil: string | null; odenen: number | string | null }> | null,
  ) {
    const movementTotals = new Map<string, number>()
    for (const row of movementRows || []) {
      const key = String(row.ay_yil || "").trim()
      if (!key) continue
      movementTotals.set(key, (movementTotals.get(key) || 0) + (Number(row.odenen) || 0))
    }

    const totals = new Map<string, number>()
    for (const row of aggregateRows || []) {
      const key = String(row.ay_yil || "").trim()
      if (!key) continue
      totals.set(key, Number(row.odenen) || 0)
    }

    for (const [key, value] of movementTotals) {
      if (!totals.has(key)) totals.set(key, value)
    }

    return totals
  }

  async function calculateFirmDebt(firmaId: string) {
    if (!currentSube) return null

    if (scope === "monthly") {
      const [
        { data: kayitlar, error: kayitError },
        { data: odemeler, error: odemeError },
        { data: odemeHareketleriData, error: odemeHareketleriError },
      ] = await Promise.all([
        supabase
          .from("kargo_cari_kayitlar")
          .select("alinan_tutar, ay_yil")
          .eq("sube_id", currentSube.id)
          .eq("firma_id", firmaId),
        supabase
          .from("kargo_cari_odemeler")
          .select("odenen, ay_yil")
          .eq("sube_id", currentSube.id)
          .eq("firma_id", firmaId),
        supabase
          .from("kargo_cari_odeme_hareketleri")
          .select("odenen, ay_yil")
          .eq("sube_id", currentSube.id)
          .eq("firma_id", firmaId),
      ])

      if (kayitError) throw kayitError
      if (odemeError) throw odemeError
      if (odemeHareketleriError) throw odemeHareketleriError

      const currentKayitlar = (kayitlar || []).filter(kayit => isCurrentAyYil(kayit.ay_yil))
      const priorKayitlar = (kayitlar || []).filter(kayit => isAyYilBefore(kayit.ay_yil))
      const paymentTotals = buildPaymentTotals(odemeler, odemeHareketleriData)
      const ayBorcu = sumField(currentKayitlar, "alinan_tutar")
      const priorDebt = sumField(priorKayitlar, "alinan_tutar")
      const priorPaid = Array.from(paymentTotals.entries())
        .filter(([period]) => isAyYilBefore(period))
        .reduce((sum, [, paid]) => sum + paid, 0)
      const odenen = Array.from(paymentTotals.entries())
        .filter(([period]) => isCurrentAyYil(period))
        .reduce((sum, [, paid]) => sum + paid, 0)
      const oncekiBorc = priorDebt - priorPaid
      const toplamBorc = oncekiBorc + ayBorcu

      return {
        oncekiBorc,
        ayBorcu,
        toplamBorc,
        odenen,
        kalanBorc: toplamBorc - odenen,
      }
    }

    const [
      { data: kayitlar, error: kayitError },
      { data: odemeler, error: odemeError },
      { data: odemeHareketleriData, error: odemeHareketleriError },
    ] = await Promise.all([
      supabase
        .from("kargo_cari_kayitlar")
        .select("alinan_tutar")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firmaId),
      supabase
        .from("kargo_cari_odemeler")
        .select("odenen")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firmaId),
      supabase
        .from("kargo_cari_odeme_hareketleri")
        .select("odenen, ay_yil")
        .eq("sube_id", currentSube.id)
        .eq("firma_id", firmaId),
    ])

    if (kayitError) throw kayitError
    if (odemeError) throw odemeError
    if (odemeHareketleriError) throw odemeHareketleriError

    const toplamBorc = sumField(kayitlar, "alinan_tutar")
    const aggregatePaid = sumField(odemeler, "odenen")
    const movementPaid = sumField(odemeHareketleriData, "odenen")
    const odenen = Math.max(aggregatePaid, movementPaid)

    return {
      oncekiBorc: 0,
      ayBorcu: toplamBorc,
      toplamBorc,
      odenen,
      kalanBorc: toplamBorc - odenen,
    }
  }

  async function checkAdminAndLoadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("is_admin, is_developer")
      .eq("user_id", user.id)
      .single()

    setIsAdmin(Boolean(profile?.is_admin || profile?.is_developer))

    const { data: firmaData, error } = await supabase
      .from("kargo_cari_firmalar")
      .select("id, ad")
      .eq("sube_id", currentSube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true })

    if (error) {
      toast.error("Kargo firmaları okunamadı: " + error.message)
      setLoading(false)
      return
    }

    const firmaList = firmaData || []
    setFirmalar(firmaList)
    setOdemeFormu(prev => ({
      ...prev,
      firmaId: prev.firmaId && firmaList.some(firma => firma.id === prev.firmaId) ? prev.firmaId : firmaList[0]?.id || "",
    }))
    setDuzeltmeFormu(prev => ({
      ...prev,
      firmaId: prev.firmaId && firmaList.some(firma => firma.id === prev.firmaId) ? prev.firmaId : firmaList[0]?.id || "",
    }))
    await loadBorcOzetleri(firmaList)
    setLoading(false)
  }

  async function loadBorcOzetleri(firmaList: KargoFirma[]) {
    if (!currentSube) return

    const ozetler: FirmaBorcOzet[] = []

    for (const firma of firmaList) {
      let borc

      try {
        borc = await calculateFirmDebt(firma.id)
      } catch (error: any) {
        toast.error(`${firma.ad} borçları okunamadı: ${error?.message || "Bilinmeyen hata"}`)
        borc = null
      }

      ozetler.push({
        firma_id: firma.id,
        firma_ad: firma.ad,
        onceki_borc: borc?.oncekiBorc || 0,
        ay_borcu: borc?.ayBorcu || 0,
        toplam_borc: borc?.toplamBorc || 0,
        odenen: borc?.odenen || 0,
        kalan_borc: borc?.kalanBorc || 0,
      })
    }

    setBorcOzetleri(ozetler)
    await loadOdemeHareketleri(firmaList)
  }

  async function loadOdemeHareketleri(firmaList: KargoFirma[]) {
    if (!currentSube) return

    let query = supabase
      .from("kargo_cari_odeme_hareketleri")
      .select("id, tarih, firma_id, toplam_borc, odenen, kalan_borc, notlar, created_at")
      .eq("sube_id", currentSube.id)
      .order("tarih", { ascending: false })
      .order("created_at", { ascending: false })

    if (scope === "monthly") query = query.eq("ay_yil", ayYil)

    const { data, error } = await query.limit(200)
    if (error) {
      setOdemeHareketleri([])
      if (error.code === "42P01") {
        toast.error("Ödeme hareketleri tablosu yok. 019 migration dosyasını uygulayın.")
      } else {
        toast.error("Ödeme hareketleri okunamadı: " + error.message)
      }
      return
    }

    const firmaAdlari = new Map(firmaList.map(firma => [firma.id, firma.ad]))
    setOdemeHareketleri((data || []).map(item => ({
      id: item.id,
      tarih: item.tarih,
      firma_id: item.firma_id,
      firma_ad: firmaAdlari.get(item.firma_id) || "Firma",
      toplam_borc: Number(item.toplam_borc) || 0,
      odenen: Number(item.odenen) || 0,
      kalan_borc: Number(item.kalan_borc) || 0,
      notlar: item.notlar || "",
      created_at: item.created_at,
    })))
  }

  function updateOdemeFormu(patch: Partial<OdemeFormu>) {
    const nextForm = { ...odemeFormu, ...patch }
    const isDirty = Boolean(nextForm.odenen || nextForm.notlar)
    setOdemeFormu(nextForm)
    setOdemeFormuKirli(isDirty)
    if (isDirty || duzeltmeFormuKirli) {
      markDirty()
    } else {
      markClean()
    }
  }

  function updateDuzeltmeFormu(patch: Partial<OdemeDuzeltmeFormu>) {
    const nextForm = { ...duzeltmeFormu, ...patch }
    const isDirty = Boolean(nextForm.tutar || nextForm.notlar)
    setDuzeltmeFormu(nextForm)
    setDuzeltmeFormuKirli(isDirty)
    if (isDirty || odemeFormuKirli) {
      markDirty()
    } else {
      markClean()
    }
  }

  function handleOdemeNotuChange(hareketId: string, value: string) {
    setOdemeHareketleri(prev => prev.map(hareket => (
      hareket.id === hareketId ? { ...hareket, notlar: value } : hareket
    )))
  }

  async function saveOdemeNotu(hareketId: string, value: string) {
    const { error } = await supabase
      .from("kargo_cari_odeme_hareketleri")
      .update({ notlar: value })
      .eq("id", hareketId)

    if (error) toast.error("Ödeme notu kaydedilemedi: " + error.message)
  }

  async function getFreshDebtForFirm(firmaId: string) {
    return calculateFirmDebt(firmaId)
  }

  async function saveYeniOdeme() {
    if (!odemeFormuKirli && !odemeFormu.odenen) return true
    if (scope !== "monthly") {
      toast.error("Ödeme girmek için aylık görünümü seçin.")
      return false
    }

    const amount = Number(odemeFormu.odenen) || 0
    if (!odemeFormu.firmaId) {
      toast.error("Ödeme için firma seçin.")
      return false
    }
    if (!odemeFormu.tarih) {
      toast.error("Ödeme tarihi seçin.")
      return false
    }
    if (amount <= 0) {
      toast.error("Ödenen tutar 0'dan büyük olmalı.")
      return false
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setSaving(false)
      toast.error("Oturum veya şube bulunamadı.")
      return false
    }

    try {
      const freshDebt = await getFreshDebtForFirm(odemeFormu.firmaId)
      if (!freshDebt) throw new Error("Firma borcu hesaplanamadı.")
      const yeniToplamOdeme = freshDebt.odenen + amount
      const yeniKalanBorc = freshDebt.toplamBorc - yeniToplamOdeme

      const { error: odemeError } = await supabase
        .from("kargo_cari_odemeler")
        .upsert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: odemeFormu.firmaId,
          ay_yil: ayYil,
          odenen: yeniToplamOdeme,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "sube_id,firma_id,ay_yil",
        })

      if (odemeError) throw odemeError

      const { error: hareketError } = await supabase
        .from("kargo_cari_odeme_hareketleri")
        .insert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: odemeFormu.firmaId,
          ay_yil: ayYil,
          tarih: odemeFormu.tarih,
          toplam_borc: freshDebt.kalanBorc,
          odenen: amount,
          kalan_borc: yeniKalanBorc,
          notlar: odemeFormu.notlar.trim(),
        })

      if (hareketError) throw hareketError

      setOdemeFormu(prev => ({ ...prev, odenen: "", notlar: "" }))
      setOdemeFormuKirli(false)
      if (duzeltmeFormuKirli) {
        markDirty()
      } else {
        markClean()
      }
      await loadBorcOzetleri(firmalar)
      toast.success(yeniKalanBorc < 0
        ? "Ödeme kaydedildi. Fazla tutar sonraki borca devredilecek."
        : "Ödeme kaydedildi ve borçtan düşüldü.")
      setSaving(false)
      return true
    } catch (error: any) {
      const message = error?.message || "Ödeme kaydedilemedi."
      if (
        message.includes("kargo_cari_odemeler_user_id_firma_id_key") ||
        message.includes("kargo_cari_odemeler_sube_firma_unique") ||
        message.includes("kargo_cari_odemeler_sube_firma_key")
      ) {
        toast.error("Eski kargo cari ödeme kuralı veritabanında kalmış. 007 migration dosyasını uygulayın.")
      } else {
        toast.error(message)
      }
      setSaving(false)
      return false
    }
  }

  async function saveOdemeDuzeltme() {
    if (!duzeltmeFormuKirli && !duzeltmeFormu.tutar) return true
    if (scope !== "monthly") {
      toast.error("Ödeme silmek için aylık görünümü seçin.")
      return false
    }

    const amount = Number(duzeltmeFormu.tutar) || 0
    if (!duzeltmeFormu.firmaId) {
      toast.error("Düzeltme için firma seçin.")
      return false
    }
    if (!duzeltmeFormu.tarih) {
      toast.error("Düzeltme tarihi seçin.")
      return false
    }
    if (amount <= 0) {
      toast.error("Silinecek ödeme tutarı 0'dan büyük olmalı.")
      return false
    }

    setCorrecting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !currentSube) {
      setCorrecting(false)
      toast.error("Oturum veya şube bulunamadı.")
      return false
    }

    try {
      const freshDebt = await getFreshDebtForFirm(duzeltmeFormu.firmaId)
      if (!freshDebt) throw new Error("Firma ödemesi hesaplanamadı.")
      if (freshDebt.odenen <= 0) {
        throw new Error("Bu firma için silinecek ödeme bulunmuyor.")
      }
      if (amount > freshDebt.odenen) {
        throw new Error(`Silinecek tutar ödenen toplamdan büyük olamaz. Bu ay ödenen: ${formatNumber(freshDebt.odenen)} TL`)
      }

      const yeniToplamOdeme = freshDebt.odenen - amount
      const yeniKalanBorc = freshDebt.toplamBorc - yeniToplamOdeme

      const { error: odemeError } = await supabase
        .from("kargo_cari_odemeler")
        .upsert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: duzeltmeFormu.firmaId,
          ay_yil: ayYil,
          odenen: yeniToplamOdeme,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "sube_id,firma_id,ay_yil",
        })

      if (odemeError) throw odemeError

      const duzeltmeNotu = duzeltmeFormu.notlar.trim()
      const { error: hareketError } = await supabase
        .from("kargo_cari_odeme_hareketleri")
        .insert({
          user_id: user.id,
          sube_id: currentSube.id,
          firma_id: duzeltmeFormu.firmaId,
          ay_yil: ayYil,
          tarih: duzeltmeFormu.tarih,
          toplam_borc: freshDebt.kalanBorc,
          odenen: -amount,
          kalan_borc: yeniKalanBorc,
          notlar: duzeltmeNotu ? `Ödeme silindi: ${duzeltmeNotu}` : "Ödeme silindi / düzeltme",
        })

      if (hareketError) throw hareketError

      setDuzeltmeFormu(prev => ({ ...prev, tutar: "", notlar: "" }))
      setDuzeltmeFormuKirli(false)
      if (odemeFormuKirli) {
        markDirty()
      } else {
        markClean()
      }
      await loadBorcOzetleri(firmalar)
      toast.success("Ödeme düzeltildi ve ödenen toplamdan düşüldü.")
      setCorrecting(false)
      return true
    } catch (error: any) {
      toast.error(error?.message || "Ödeme düzeltmesi kaydedilemedi.")
      setCorrecting(false)
      return false
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr)
    return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  function exportBorcPdf() {
    const borcHeaders = scope === "monthly"
      ? ["Firma", "Önceki Borç", "Ay Borcu", "Toplam Borç", "Ödenen", "Kalan Borç"]
      : ["Firma", "Toplam Borç", "Ödenen", "Kalan Borç"]
    const borcRows = scope === "monthly"
      ? [
          ...borcOzetleri.map(ozet => [
            ozet.firma_ad,
            `${formatNumber(ozet.onceki_borc)} TL`,
            `${formatNumber(ozet.ay_borcu)} TL`,
            `${formatNumber(ozet.toplam_borc)} TL`,
            `${formatNumber(ozet.odenen)} TL`,
            `${formatNumber(ozet.kalan_borc)} TL`,
          ]),
          [
            "GENEL TOPLAM",
            `${formatNumber(genelToplam.onceki_borc)} TL`,
            `${formatNumber(genelToplam.ay_borcu)} TL`,
            `${formatNumber(genelToplam.toplam_borc)} TL`,
            `${formatNumber(genelToplam.odenen)} TL`,
            `${formatNumber(genelToplam.kalan_borc)} TL`,
          ],
        ]
      : [
          ...borcOzetleri.map(ozet => [
            ozet.firma_ad,
            `${formatNumber(ozet.toplam_borc)} TL`,
            `${formatNumber(ozet.odenen)} TL`,
            `${formatNumber(ozet.kalan_borc)} TL`,
          ]),
          [
            "GENEL TOPLAM",
            `${formatNumber(genelToplam.toplam_borc)} TL`,
            `${formatNumber(genelToplam.odenen)} TL`,
            `${formatNumber(genelToplam.kalan_borc)} TL`,
          ],
        ]

    openPdfReport({
      title: "Kargo Cari Borç Özeti",
      subtitle: `${currentSube?.ad || ""} - ${scope === "monthly" ? `${month} ${year}` : "Tüm zamanlar"}`,
      orientation: "landscape",
      metrics: [
        ...(scope === "monthly" ? [
          { label: "Önceki Borç", value: `${formatNumber(genelToplam.onceki_borc)} TL` },
          { label: "Ay Borcu", value: `${formatNumber(genelToplam.ay_borcu)} TL` },
        ] : []),
        { label: "Toplam Borç", value: `${formatNumber(genelToplam.toplam_borc)} TL` },
        { label: "Toplam Ödenen", value: `${formatNumber(genelToplam.odenen)} TL` },
        { label: "Kalan Borç", value: `${formatNumber(genelToplam.kalan_borc)} TL` },
      ],
      tables: [{
        title: "Firma Bazlı Borç Durumu",
        headers: borcHeaders,
        firstColumnWidth: "38%",
        rows: borcRows,
      }, {
        title: "Ödeme Hareketleri",
        headers: ["Tarih", "Firma", "Güncel Borç", "Ödenen", "Kalan Borç", "Not"],
        firstColumnWidth: "18%",
        rows: odemeHareketleri.map(hareket => [
          formatDate(hareket.tarih),
          hareket.firma_ad,
          `${formatNumber(hareket.toplam_borc)} TL`,
          `${formatNumber(hareket.odenen)} TL`,
          `${formatNumber(hareket.kalan_borc)} TL`,
          hareket.notlar || "-",
        ]),
      }],
    })
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">Erişim Engellendi</h2>
          <p className="text-muted-foreground">Bu sayfaya sadece yöneticiler erişebilir.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kargo Cari Borç Özeti</h1>
          <p className="mt-1 text-muted-foreground">
            {scope === "monthly" ? `${month} ${year} borç ve ödeme durumu` : "Tüm firmaların borç durumu"}
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Select value={scope} onValueChange={(value) => setScope(value as "monthly" | "all")}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Aylık</SelectItem>
              <SelectItem value="all">Tüm zamanlar</SelectItem>
            </SelectContent>
          </Select>
          {scope === "monthly" ? (
            <>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-full sm:w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-full sm:w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(item => <SelectItem key={item} value={item.toString()}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          ) : null}
          <Button onClick={exportBorcPdf} variant="outline" className="gap-2" disabled={borcOzetleri.length === 0}>
            <FileText className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${scope === "monthly" ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {scope === "monthly" ? (
          <Card className="border-slate-200 bg-slate-50 dark:border-slate-500/30 dark:bg-slate-500/15">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-600 dark:text-slate-200">Önceki Borç</p>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-100">{formatNumber(genelToplam.onceki_borc)} <span className="text-base font-normal">TL</span></p>
                </div>
                <div className="rounded-full bg-slate-100 p-3 dark:bg-slate-500/20">
                  <History className="h-6 w-6 text-slate-600 dark:text-slate-200" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/15">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-blue-600 dark:text-blue-200">Toplam Borç</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-100">{formatNumber(genelToplam.toplam_borc)} <span className="text-base font-normal">TL</span></p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-500/20">
                <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-500/30 dark:bg-green-500/15">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-sm font-medium text-green-600 dark:text-green-200">Toplam Ödenen</p>
                <p className="text-2xl font-bold text-green-700 dark:text-green-100">{formatNumber(genelToplam.odenen)} <span className="text-base font-normal">TL</span></p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-500/20">
                <TrendingDown className="h-6 w-6 text-green-600 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={genelToplam.kalan_borc > 0 ? "border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15" : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/15"}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`mb-1 text-sm font-medium ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>Kalan Borç</p>
                <p className={`text-2xl font-bold ${genelToplam.kalan_borc > 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{formatNumber(genelToplam.kalan_borc)} <span className="text-base font-normal">TL</span></p>
              </div>
              <div className={`rounded-full p-3 ${genelToplam.kalan_borc > 0 ? "bg-red-100 dark:bg-red-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"}`}>
                <Wallet className={`h-6 w-6 ${genelToplam.kalan_borc > 0 ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-cyan-100 shadow-sm dark:border-cyan-500/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="h-5 w-5 text-cyan-500" />
            Firma Bazlı Borç Durumu
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {borcOzetleri.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Henüz firma veya borç kaydı yok.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {borcOzetleri.map(ozet => {
                const percent = ozet.toplam_borc > 0 ? Math.min(100, Math.max(0, (ozet.odenen / ozet.toplam_borc) * 100)) : 0
                const detailItems = scope === "monthly"
                  ? [
                      { label: "Önceki", value: ozet.onceki_borc, className: "bg-slate-500/10 text-slate-700 dark:text-slate-200" },
                      { label: "Ay Borcu", value: ozet.ay_borcu, className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-200" },
                      { label: "Toplam", value: ozet.toplam_borc, className: "bg-blue-500/10 text-blue-700 dark:text-blue-200" },
                      { label: "Ödenen", value: ozet.odenen, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" },
                      { label: "Kalan", value: ozet.kalan_borc, className: "bg-orange-500/10 text-orange-700 dark:text-orange-200" },
                    ]
                  : [
                      { label: "Toplam", value: ozet.toplam_borc, className: "bg-blue-500/10 text-blue-700 dark:text-blue-200" },
                      { label: "Ödenen", value: ozet.odenen, className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" },
                      { label: "Kalan", value: ozet.kalan_borc, className: "bg-orange-500/10 text-orange-700 dark:text-orange-200" },
                    ]

                return (
                  <div key={ozet.firma_id} className="rounded-lg border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/kargo-cari/${ozet.firma_id}`}
                          className="block truncate text-base font-bold text-foreground hover:text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {ozet.firma_ad}
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">Ödeme oranı %{percent.toFixed(0)}</p>
                      </div>
                      <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${ozet.kalan_borc > 0 ? "bg-orange-500/10 text-orange-700 dark:text-orange-200" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"}`}>
                        {ozet.kalan_borc > 0 ? "Borç var" : "Kapandı"}
                      </div>
                    </div>
                    <div className={`mt-4 grid gap-2 text-sm ${scope === "monthly" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3"}`}>
                      {detailItems.map(item => (
                        <div key={item.label} className={`rounded-md p-2 ${item.className}`}>
                          <p className="text-[11px] font-semibold text-muted-foreground">{item.label}</p>
                          <p className="mt-1 break-words font-bold">{formatNumber(item.value)} TL</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-emerald-100 shadow-sm dark:border-emerald-500/20">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CreditCard className="h-5 w-5 text-emerald-500" />
            Ödeme Listesi
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="sticky-table-scroll">
            <table className="sticky-table w-full min-w-[1120px] text-sm">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="p-3 text-left font-semibold text-foreground">FİRMA</th>
                  <th className="p-3 text-right font-semibold text-blue-700 dark:text-blue-200">GÜNCEL BORÇ</th>
                  <th className="p-3 text-left font-semibold text-foreground">ÖDEME TARİHİ</th>
                  <th className="p-3 text-right font-semibold text-emerald-700 dark:text-emerald-200">ÖDENEN</th>
                  <th className="p-3 text-right font-semibold text-orange-700 dark:text-orange-200">KALAN BORÇ</th>
                  <th className="p-3 text-left font-semibold text-foreground">NOT</th>
                  <th className="p-3 text-right font-semibold text-foreground">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">
                    <Select value={odemeFormu.firmaId} onValueChange={(value) => updateOdemeFormu({ firmaId: value })} disabled={scope !== "monthly"}>
                      <SelectTrigger className="h-10 min-w-60">
                        <SelectValue placeholder="Firma seç" />
                      </SelectTrigger>
                      <SelectContent>
                        {firmalar.map(firma => <SelectItem key={firma.id} value={firma.id}>{firma.ad}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right font-bold text-blue-700 dark:text-blue-200">
                    <div>{formatNumber(selectedOzet?.kalan_borc || 0)} TL</div>
                    {selectedOzet && scope === "monthly" ? (
                      <div className="mt-1 text-xs font-medium text-muted-foreground">
                        Önceki {formatNumber(selectedOzet.onceki_borc)} + Ay {formatNumber(selectedOzet.ay_borcu)} - Ödenen {formatNumber(selectedOzet.odenen)}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <ModernDatePicker
                      label="Ödeme tarihi"
                      value={odemeFormu.tarih}
                      onChange={(value) => updateOdemeFormu({ tarih: value })}
                      disabled={scope !== "monthly"}
                      buttonClassName="h-10 rounded-md"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={odemeFormu.odenen}
                      onChange={(event) => updateOdemeFormu({ odenen: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="ml-auto h-10 w-36 text-right font-semibold"
                      placeholder="0.00"
                    />
                  </td>
                  <td className={`p-3 text-right font-bold ${formKalanBorc > 0 ? "text-orange-600 dark:text-orange-200" : "text-emerald-600 dark:text-emerald-200"}`}>
                    {formatNumber(formKalanBorc)} TL
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      value={odemeFormu.notlar}
                      onChange={(event) => updateOdemeFormu({ notlar: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="h-10 min-w-60"
                      placeholder="Not yaz..."
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button onClick={saveYeniOdeme} disabled={saving || scope !== "monthly"} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Ödemeyi Kaydet
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {scope !== "monthly" ? (
            <div className="border-t bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-200">
              Ödeme girmek için aylık görünümü seçin.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-red-100 shadow-sm dark:border-red-500/20">
        <CardHeader className="border-b bg-red-50/70 dark:bg-red-500/10">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Trash2 className="h-5 w-5 text-red-500" />
            Ödeme Sil / Düzelt
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="sticky-table-scroll">
            <table className="sticky-table w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b bg-muted/60">
                  <th className="p-3 text-left font-semibold text-foreground">FİRMA</th>
                  <th className="p-3 text-right font-semibold text-emerald-700 dark:text-emerald-200">BU AY ÖDENEN</th>
                  <th className="p-3 text-left font-semibold text-foreground">DÜZELTME TARİHİ</th>
                  <th className="p-3 text-right font-semibold text-red-700 dark:text-red-200">SİLİNECEK TUTAR</th>
                  <th className="p-3 text-right font-semibold text-blue-700 dark:text-blue-200">DÜZELTME SONRASI ÖDENEN</th>
                  <th className="p-3 text-right font-semibold text-orange-700 dark:text-orange-200">KALAN BORÇ</th>
                  <th className="p-3 text-left font-semibold text-foreground">NOT</th>
                  <th className="p-3 text-right font-semibold text-foreground">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3">
                    <Select value={duzeltmeFormu.firmaId} onValueChange={(value) => updateDuzeltmeFormu({ firmaId: value })} disabled={scope !== "monthly"}>
                      <SelectTrigger className="h-10 min-w-60">
                        <SelectValue placeholder="Firma seç" />
                      </SelectTrigger>
                      <SelectContent>
                        {firmalar.map(firma => <SelectItem key={firma.id} value={firma.id}>{firma.ad}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-right font-bold text-emerald-700 dark:text-emerald-200">
                    {formatNumber(selectedDuzeltmeOzet?.odenen || 0)} TL
                  </td>
                  <td className="p-3">
                    <ModernDatePicker
                      label="Düzeltme tarihi"
                      value={duzeltmeFormu.tarih}
                      onChange={(value) => updateDuzeltmeFormu({ tarih: value })}
                      disabled={scope !== "monthly"}
                      buttonClassName="h-10 rounded-md"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={duzeltmeFormu.tutar}
                      onChange={(event) => updateDuzeltmeFormu({ tutar: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="ml-auto h-10 w-36 text-right font-semibold"
                      placeholder="0.00"
                    />
                  </td>
                  <td className={`p-3 text-right font-bold ${duzeltmeSonrasiOdenen < 0 ? "text-red-600 dark:text-red-200" : "text-blue-700 dark:text-blue-200"}`}>
                    {formatNumber(duzeltmeSonrasiOdenen)} TL
                  </td>
                  <td className={`p-3 text-right font-bold ${duzeltmeSonrasiKalan > 0 ? "text-orange-600 dark:text-orange-200" : "text-emerald-600 dark:text-emerald-200"}`}>
                    {formatNumber(duzeltmeSonrasiKalan)} TL
                  </td>
                  <td className="p-3">
                    <Input
                      type="text"
                      value={duzeltmeFormu.notlar}
                      onChange={(event) => updateDuzeltmeFormu({ notlar: event.target.value })}
                      disabled={scope !== "monthly"}
                      className="h-10 min-w-60"
                      placeholder="Örn: 100 TL fazla girildi"
                    />
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      onClick={saveOdemeDuzeltme}
                      disabled={correcting || scope !== "monthly" || (selectedDuzeltmeOzet?.odenen || 0) <= 0}
                      variant="destructive"
                      className="gap-2"
                    >
                      {correcting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Ödemeden Düş
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {scope !== "monthly" ? (
            <div className="border-t bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700 dark:text-amber-200">
              Ödeme silmek için aylık görünümü seçin.
            </div>
          ) : (
            <div className="border-t bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-200">
              Yanlış fazla girilen tutarı buradan düş. Örn: 5.500 TL girildi ama 5.400 TL olmalıysa 100 TL sil.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200 shadow-sm dark:border-slate-700">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="h-5 w-5 text-slate-500" />
            Ödeme Hareketleri
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {odemeHareketleri.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">Bu dönem için kayıtlı ödeme hareketi yok.</div>
          ) : (
            <div className="sticky-table-scroll">
              <table className="sticky-table w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/60">
                    <th className="p-3 text-left font-semibold text-foreground">TARİH</th>
                    <th className="p-3 text-left font-semibold text-foreground">FİRMA</th>
                    <th className="p-3 text-right font-semibold text-blue-700 dark:text-blue-200">GÜNCEL BORÇ</th>
                    <th className="p-3 text-right font-semibold text-emerald-700 dark:text-emerald-200">ÖDENEN</th>
                    <th className="p-3 text-right font-semibold text-orange-700 dark:text-orange-200">KALAN BORÇ</th>
                    <th className="p-3 text-left font-semibold text-foreground">NOT</th>
                  </tr>
                </thead>
                <tbody>
                  {odemeHareketleri.map(hareket => {
                    const isCorrection = hareket.odenen < 0
                    return (
                      <tr key={hareket.id} className="border-b transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-500/10">
                        <td className="p-4 font-medium text-muted-foreground">{formatDate(hareket.tarih)}</td>
                        <td className="p-4 font-semibold text-foreground">{hareket.firma_ad}</td>
                        <td className="p-4 text-right font-semibold text-blue-700 dark:text-blue-200">{formatNumber(hareket.toplam_borc)} TL</td>
                        <td className={`p-4 text-right font-bold ${isCorrection ? "text-red-600 dark:text-red-200" : "text-emerald-600 dark:text-emerald-200"}`}>
                          {formatNumber(hareket.odenen)} TL
                          {isCorrection ? <div className="text-xs font-semibold text-red-500 dark:text-red-200">Düzeltme</div> : null}
                        </td>
                        <td className={`p-4 text-right font-bold ${hareket.kalan_borc > 0 ? "text-orange-600 dark:text-orange-200" : "text-emerald-600 dark:text-emerald-200"}`}>{formatNumber(hareket.kalan_borc)} TL</td>
                        <td className="p-3">
                          <Input
                            type="text"
                            value={hareket.notlar || ""}
                            onChange={(event) => handleOdemeNotuChange(hareket.id, event.target.value)}
                            onBlur={(event) => saveOdemeNotu(hareket.id, event.target.value)}
                            className="h-10 min-w-56"
                            placeholder="Not yaz..."
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
