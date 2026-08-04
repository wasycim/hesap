import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"
import { MONTHS, getInitialMonth, getInitialYear } from "@/lib/date-navigation"

const KDV_RATE = 0.20

function parseAyYil(value: string | null | undefined) {
  const text = String(value || "").trim()
  const parts = text.split(/[-\s/]+/).filter(Boolean)
  const monthPart = parts[0] || ""
  const yearPart = parts.find((part) => /^\d{4}$/.test(part)) || ""
  const monthIndex = MONTHS.findIndex((item) => item.toLocaleLowerCase("tr-TR") === monthPart.toLocaleLowerCase("tr-TR"))
  const parsedYear = Number(yearPart)

  if (monthIndex < 0 || !Number.isFinite(parsedYear)) return null
  return { monthIndex, year: parsedYear }
}

function isAyYilBefore(value: string | null | undefined, selectedMonthIndex: number, selectedYear: number) {
  const parsed = parseAyYil(value)
  if (!parsed || selectedMonthIndex < 0) return false
  return parsed.year < selectedYear || (parsed.year === selectedYear && parsed.monthIndex < selectedMonthIndex)
}

function isCurrentAyYil(value: string | null | undefined, selectedMonthIndex: number, selectedYear: number) {
  const parsed = parseAyYil(value)
  if (!parsed || selectedMonthIndex < 0) return false
  return parsed.year === selectedYear && parsed.monthIndex === selectedMonthIndex
}

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Kargo cari borç özetini sadece yöneticiler görebilir." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get("month") || getInitialMonth()
  const year = Number(searchParams.get("year")) || getInitialYear()
  const selectedMonthIndex = MONTHS.findIndex((m) => m.toLocaleLowerCase("tr-TR") === month.toLocaleLowerCase("tr-TR"))
  const targetMonth = selectedMonthIndex >= 0 ? MONTHS[selectedMonthIndex] : getInitialMonth()
  const targetYear = Number.isFinite(year) ? year : getInitialYear()
  const targetMonthIndex = MONTHS.findIndex((m) => m === targetMonth)
  const ayYilKey = `${targetMonth}-${targetYear}`

  const [{ data: branch }, { data: firmalar }] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle(),
    admin.from("kargo_cari_firmalar").select("id, ad, kdv_dahil").eq("sube_id", profile.sube_id).order("sira"),
  ])

  const firmaSummaries = []
  let totalOncekiBorc = 0
  let totalAyBorcu = 0
  let totalKdv = 0
  let totalBorc = 0
  let totalOdenen = 0
  let totalKalan = 0

  for (const firma of firmalar || []) {
    const [{ data: kayitlar }, { data: odemeler }, { data: odemeHareketleri }] = await Promise.all([
      admin.from("kargo_cari_kayitlar").select("alinan_tutar, ay_yil").eq("sube_id", profile.sube_id).eq("firma_id", firma.id),
      admin.from("kargo_cari_odemeler").select("odenen, ay_yil").eq("sube_id", profile.sube_id).eq("firma_id", firma.id),
      admin.from("kargo_cari_odeme_hareketleri").select("odenen, ay_yil").eq("sube_id", profile.sube_id).eq("firma_id", firma.id),
    ])

    let oncekiAlinan = 0
    let oncekiOdenen = 0
    let ayBorcu = 0
    let ayOdenen = 0

    for (const row of kayitlar || []) {
      const tutar = Number(row.alinan_tutar) || 0
      if (isAyYilBefore(row.ay_yil, targetMonthIndex, targetYear)) {
        oncekiAlinan += tutar
      } else if (isCurrentAyYil(row.ay_yil, targetMonthIndex, targetYear)) {
        ayBorcu += tutar
      }
    }

    const allPayments = [...(odemeler || []), ...(odemeHareketleri || [])]
    for (const row of allPayments) {
      const odenenTutar = Number(row.odenen) || 0
      if (isAyYilBefore(row.ay_yil, targetMonthIndex, targetYear)) {
        oncekiOdenen += odenenTutar
      } else if (isCurrentAyYil(row.ay_yil, targetMonthIndex, targetYear)) {
        ayOdenen += odenenTutar
      }
    }

    const oncekiBorc = Math.max(0, oncekiAlinan - oncekiOdenen)
    const kdvDahil = Boolean(firma.kdv_dahil)
    const hamBorc = oncekiBorc + ayBorcu
    const kdvTutari = kdvDahil ? hamBorc * KDV_RATE : 0
    const toplamBorc = hamBorc + kdvTutari
    const kalanBorc = Math.max(0, toplamBorc - ayOdenen)

    totalOncekiBorc += oncekiBorc
    totalAyBorcu += ayBorcu
    totalKdv += kdvTutari
    totalBorc += toplamBorc
    totalOdenen += ayOdenen
    totalKalan += kalanBorc

    firmaSummaries.push({
      firmaId: firma.id,
      firmaAd: firma.ad,
      kdvDahil,
      oncekiBorc,
      ayBorcu,
      kdvTutari,
      toplamBorc,
      odenen: ayOdenen,
      kalanBorc,
    })
  }

  return NextResponse.json({
    branch,
    month: targetMonth,
    year: targetYear,
    ayYil: ayYilKey,
    totals: {
      totalOncekiBorc,
      totalAyBorcu,
      totalKdv,
      totalBorc,
      totalOdenen,
      totalKalan,
    },
    firmalar: firmaSummaries,
  })
}
