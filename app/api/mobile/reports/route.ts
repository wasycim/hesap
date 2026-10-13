import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

function monthStartKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

function monthEndKey(month: number, year: number) {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const now = new Date()
  const month = Number(searchParams.get("month")) || (now.getMonth() + 1)
  const year = Number(searchParams.get("year")) || now.getFullYear()
  const monthStart = monthStartKey(month, year)
  const monthEnd = monthEndKey(month, year)
  const monthName = MONTHS_TR[month - 1] || ""
  const ayYil = `${monthName}-${year}`

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || !profile.sube_id) {
    return NextResponse.json({ error: "Erişim yetkiniz bulunmuyor." }, { status: 403 })
  }

  const [
    { data: branch },
    { data: gelirRows },
    { data: giderRows },
    { data: attendanceLogs },
    { data: firmalar }
  ] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle(),
    admin.from("gelir_kayitlari").select("*").eq("sube_id", profile.sube_id).gte("tarih", monthStart).lte("tarih", monthEnd),
    admin.from("gider_kayitlari").select("*").eq("sube_id", profile.sube_id).gte("tarih", monthStart).lte("tarih", monthEnd),
    admin.from("attendance_logs").select("*").eq("sube_id", profile.sube_id).gte("work_date", monthStart).lte("work_date", monthEnd),
    admin.from("gelir_firmalar").select("id, ad, komisyon_orani").eq("sube_id", profile.sube_id).eq("aktif", true),
  ])

  // Revenue (Gelir / Ciro) Analysis
  let toplamCiro = 0
  let firmaCiroMap = new Map<string, number>()
  for (const row of gelirRows || []) {
    const total = Number(row.toplam_gelir) || 0
    toplamCiro += total
    if (row.firma_paylari) {
      Object.entries(row.firma_paylari as Record<string, unknown>).forEach(([fId, amt]) => {
        firmaCiroMap.set(fId, (firmaCiroMap.get(fId) || 0) + (Number(amt) || 0))
      })
    }
  }

  const firmaBreakdown = (firmalar || []).map((f) => ({
    firmaId: f.id,
    ad: f.ad,
    ciro: firmaCiroMap.get(f.id) || 0,
    komisyonOrani: f.komisyon_orani,
  }))

  // Expense (Gider) Analysis
  let toplamGider = 0
  let elFisiOdemeTotal = 0
  let personelPaylariTotal = 0
  for (const row of giderRows || []) {
    toplamGider += Number(row.genel_toplam) || 0
    elFisiOdemeTotal += Number(row.el_fisi_odeme) || 0
    if (row.personel_paylari) {
      Object.values(row.personel_paylari as Record<string, unknown>).forEach((amt) => {
        personelPaylariTotal += Number(amt) || 0
      })
    }
  }

  const kalan = toplamCiro - toplamGider

  // Performance Analysis
  const totalLogs = (attendanceLogs || []).length
  const lateLogs = (attendanceLogs || []).filter((l) => Number(l.late_minutes || 0) > 0).length
  const punctualityRate = totalLogs > 0 ? Math.round(((totalLogs - lateLogs) / totalLogs) * 100) : 100

  let totalWorkedMinutes = 0
  let totalOvertimeMinutes = 0
  let totalLateMinutes = 0

  for (const l of attendanceLogs || []) {
    totalWorkedMinutes += Number(l.worked_minutes || 0)
    totalOvertimeMinutes += Number(l.overtime_minutes || 0)
    totalLateMinutes += Number(l.late_minutes || 0)
  }

  return NextResponse.json({
    period: { month, year, monthName, start: monthStart, end: monthEnd },
    branch,
    revenue: {
      toplamCiro,
      toplamGider,
      kalan,
      elFisiOdemeTotal,
      personelPaylariTotal,
      firmaBreakdown,
    },
    performance: {
      totalLogs,
      lateLogs,
      punctualityRate,
      totalWorkedHours: Math.round(totalWorkedMinutes / 60),
      totalOvertimeHours: Math.round(totalOvertimeMinutes / 60),
      totalLateHours: Math.round(totalLateMinutes / 60),
    },
  })
}
