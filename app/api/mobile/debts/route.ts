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
  const scope = searchParams.get("scope") === "all" ? "all" : "monthly"
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
    const [{ data: kayitlar }, { data: odemeler }] = await Promise.all([
      admin.from("kargo_cari_kayitlar").select("alinan_tutar, ay_yil").eq("sube_id", profile.sube_id).eq("firma_id", firma.id),
      admin.from("kargo_cari_odemeler").select("odenen, ay_yil").eq("sube_id", profile.sube_id).eq("firma_id", firma.id),
    ])

    const kdvDahil = Boolean(firma.kdv_dahil)

    if (scope === "all") {
      let hamAlinan = 0
      let hamOdenen = 0

      for (const row of kayitlar || []) {
        hamAlinan += Number(row.alinan_tutar) || 0
      }
      for (const row of odemeler || []) {
        hamOdenen += Number(row.odenen) || 0
      }

      const kdvTutari = kdvDahil ? hamAlinan * KDV_RATE : 0
      const toplamBorc = hamAlinan + kdvTutari
      const kalanBorc = Math.max(0, toplamBorc - hamOdenen)

      totalOncekiBorc += 0
      totalAyBorcu += hamAlinan
      totalKdv += kdvTutari
      totalBorc += toplamBorc
      totalOdenen += hamOdenen
      totalKalan += kalanBorc

      firmaSummaries.push({
        firmaId: firma.id,
        firmaAd: firma.ad,
        kdvDahil,
        oncekiBorc: 0,
        ayBorcu: hamAlinan,
        kdvTutari,
        toplamBorc,
        odenen: hamOdenen,
        kalanBorc,
      })
    } else {
      let oncekiAlinan = 0
      let oncekiOdenen = 0
      let ayAlinan = 0
      let ayOdenen = 0

      for (const row of kayitlar || []) {
        const tutar = Number(row.alinan_tutar) || 0
        if (isAyYilBefore(row.ay_yil, targetMonthIndex, targetYear)) {
          oncekiAlinan += tutar
        } else if (isCurrentAyYil(row.ay_yil, targetMonthIndex, targetYear)) {
          ayAlinan += tutar
        }
      }

      for (const row of odemeler || []) {
        const odenenTutar = Number(row.odenen) || 0
        if (isAyYilBefore(row.ay_yil, targetMonthIndex, targetYear)) {
          oncekiOdenen += odenenTutar
        } else if (isCurrentAyYil(row.ay_yil, targetMonthIndex, targetYear)) {
          ayOdenen += odenenTutar
        }
      }

      const priorDebtKdv = kdvDahil ? oncekiAlinan * (1 + KDV_RATE) : oncekiAlinan
      const oncekiBorc = Math.max(0, priorDebtKdv - oncekiOdenen)
      const ayBorcuKdv = kdvDahil ? ayAlinan * (1 + KDV_RATE) : ayAlinan
      const kdvTutari = kdvDahil ? (oncekiAlinan + ayAlinan) * KDV_RATE : 0
      const toplamBorc = oncekiBorc + ayBorcuKdv
      const kalanBorc = Math.max(0, toplamBorc - ayOdenen)

      totalOncekiBorc += oncekiBorc
      totalAyBorcu += ayAlinan
      totalKdv += kdvTutari
      totalBorc += toplamBorc
      totalOdenen += ayOdenen
      totalKalan += kalanBorc

      firmaSummaries.push({
        firmaId: firma.id,
        firmaAd: firma.ad,
        kdvDahil,
        oncekiBorc,
        ayBorcu: ayAlinan,
        kdvTutari,
        toplamBorc,
        odenen: ayOdenen,
        kalanBorc,
      })
    }
  }

  return NextResponse.json({
    branch,
    scope,
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
