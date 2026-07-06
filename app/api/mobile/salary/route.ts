import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

type Detail = { date: string; amount: number; description: string }
type OvertimeDetail = Detail & { minutes: number; rate: number; source: "attendance" | "manual" }

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const now = new Date()
  const month = clampInt(request.nextUrl.searchParams.get("month"), 1, 12, now.getMonth() + 1)
  const year = clampInt(request.nextUrl.searchParams.get("year"), 2020, 2100, now.getFullYear())
  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, display_name, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.dashboard_access === false || !profile.sube_id) {
    return NextResponse.json({ error: "Personel profili veya şube eşleştirmesi bulunamadı." }, { status: 404 })
  }

  const { data: branch } = await admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle()
  const { data: candidates, error: personelError } = await admin
    .from("personeller")
    .select("id, ad, aylik_maas, saatlik_mesai_ucreti")
    .eq("sube_id", profile.sube_id)
    .eq("aktif", true)
  if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })

  const personel = (candidates || []).find((item) => normalizeName(item.ad) === normalizeName(profile.display_name))
  if (!personel) {
    return NextResponse.json({
      error: "Kullanıcı hesabı bir personel kaydıyla eşleşmiyor. Yönetici, hesap adı ile personel adını eşleştirmelidir.",
    }, { status: 404 })
  }

  const [{ data: rows, error: rowsError }, { data: approvals, error: approvalsError }] = await Promise.all([
    admin
      .from("gider_kayitlari")
      .select("tarih, personel_paylari, personel_mesai_detaylari")
      .eq("sube_id", profile.sube_id)
      .gte("tarih", start)
      .lte("tarih", end)
      .order("tarih"),
    admin
      .from("overtime_approvals")
      .select("attendance_log_id, personel_id, personel_name, work_date, raw_minutes, payable_minutes, manual_minutes, note, status")
      .eq("status", "approved")
      .gte("work_date", start)
      .lte("work_date", end)
      .or(`personel_id.eq.${personel.id},user_profile_id.eq.${user.id}`)
      .order("work_date"),
  ])
  if (rowsError || approvalsError) return NextResponse.json({ error: rowsError?.message || approvalsError?.message }, { status: 500 })

  const baseSalary = Number(personel.aylik_maas || 0)
  const hourlyRate = Number(personel.saatlik_mesai_ucreti || 0) || (baseSalary > 0 ? baseSalary / 30 / 8 : 0)
  const advances: Detail[] = []
  const overtime: OvertimeDetail[] = []

  for (const row of rows || []) {
    const payments = (row.personel_paylari || {}) as Record<string, unknown>
    const manualOvertime = (row.personel_mesai_detaylari || {}) as Record<string, unknown>
    const advanceAmount = Number(payments[personel.id] || 0)
    if (advanceAmount > 0) advances.push({ date: row.tarih, amount: advanceAmount, description: "Alınan avans" })
    const manualAmount = Number(manualOvertime[personel.id] || 0)
    if (manualAmount > 0) overtime.push({
      date: row.tarih,
      amount: manualAmount,
      description: "Gider kaydındaki manuel mesai tutarı",
      minutes: 0,
      rate: 0,
      source: "manual",
    })
  }

  for (const approval of approvals || []) {
    if (approval.personel_id && approval.personel_id !== personel.id && normalizeName(approval.personel_name) !== normalizeName(personel.ad)) continue
    const minutes = Number(approval.payable_minutes || approval.manual_minutes || 0)
    if (minutes <= 0) continue
    overtime.push({
      date: approval.work_date || start,
      amount: (minutes / 60) * hourlyRate,
      description: approval.attendance_log_id ? "Onaylı mesai takip kaydı" : `Yönetici onaylı manuel mesai${approval.note ? ` — ${approval.note}` : ""}`,
      minutes,
      rate: hourlyRate,
      source: approval.attendance_log_id ? "attendance" : "manual",
    })
  }

  const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0)
  const overtimeTotal = overtime.reduce((sum, item) => sum + item.amount, 0)
  return NextResponse.json({
    period: { month, year, start, end },
    branch,
    personel: { id: personel.id, name: personel.ad },
    baseSalary,
    hourlyRate,
    advanceTotal,
    overtimeTotal,
    remaining: baseSalary + overtimeTotal - advanceTotal,
    advances,
    overtime: overtime.sort((a, b) => a.date.localeCompare(b.date)),
  }, { headers: { "Cache-Control": "no-store" } })
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
}

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
