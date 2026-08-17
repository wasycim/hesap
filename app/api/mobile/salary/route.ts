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
  const requestedPersonelId = request.nextUrl.searchParams.get("personelId")?.trim()

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, display_name, dashboard_access, is_admin, is_developer, tc_kimlik")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.dashboard_access === false || !profile.sube_id) {
    return NextResponse.json({ error: "Personel profili veya şube eşleştirmesi bulunamadı." }, { status: 404 })
  }

  const isManager = Boolean(profile.is_admin || profile.is_developer)

  const { data: branch } = await admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle()
  const { data: candidates, error: personelError } = await admin
    .from("personeller")
    .select("id, ad, aylik_maas, banka_maas, nakit_maas, saatlik_mesai_ucreti, aktif")
    .eq("sube_id", profile.sube_id)

  if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })

  let personel: typeof candidates[0] | undefined

  // 1. If manager requested specific personelId
  if (isManager && requestedPersonelId) {
    personel = (candidates || []).find((item) => item.id === requestedPersonelId)
  }

  // 2. Multi-level matching for current user
  if (!personel) {
    personel = (candidates || []).find((item) => item.id === profile.tc_kimlik)
  }
  if (!personel) {
    personel = (candidates || []).find((item) => normalizeName(item.ad) === normalizeName(profile.display_name))
  }
  if (!personel) {
    personel = (candidates || []).find((item) => {
      const pName = normalizeName(item.ad)
      const uName = normalizeName(profile.display_name)
      return pName.includes(uName) || uName.includes(pName)
    })
  }
  if (!personel && isManager && candidates?.length) {
    personel = candidates[0]
  }

  if (!personel) {
    return NextResponse.json({
      error: "Kullanıcı hesabı bir personel kaydıyla eşleşmiyor. Yönetici, hesap adı ile personel adını eşleştirmelidir.",
    }, { status: 404 })
  }

  const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
  const monthName = MONTHS_TR[month - 1] || ""
  const ayYil = `${monthName}-${year}`

  const [
    { data: rows, error: rowsError },
    { data: approvals, error: approvalsError },
    { data: kargoPrimData },
    { data: corbaData },
    { data: approvedAvansData }
  ] = await Promise.all([
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
    admin
      .from("kargo_prim_kayitlari")
      .select("personel_hakedis, secili_personeller")
      .eq("sube_id", profile.sube_id)
      .eq("ay_yil", ayYil)
      .maybeSingle(),
    admin
      .from("corbalar")
      .select("tarih, miktar")
      .eq("sube_id", profile.sube_id)
      .eq("ay_yil", ayYil)
      .eq("personel_id", personel.id)
      .order("tarih"),
    admin
      .from("avans_talepleri")
      .select("id, tutar, user_id, user_name, tc_kimlik, odeme_tarihi, created_at, durum")
      .eq("sube_id", profile.sube_id)
      .eq("durum", "onaylandi"),
  ])

  if (rowsError || approvalsError) return NextResponse.json({ error: rowsError?.message || approvalsError?.message }, { status: 500 })

  const bankaMaas = Number(personel.banka_maas || 0)
  const nakitMaas = Number(personel.nakit_maas !== undefined && personel.nakit_maas !== null ? personel.nakit_maas : (personel.aylik_maas || 0))
  const baseSalary = bankaMaas + nakitMaas
  const hourlyRate = Number(personel.saatlik_mesai_ucreti || 0) || (baseSalary > 0 ? baseSalary / 30 / 8 : 0)
  const advances: Detail[] = []
  const overtime: OvertimeDetail[] = []

  // Check approved advance requests for "Özel Avans"
  for (const req of approvedAvansData || []) {
    const tutar = Number(req.tutar || 0)
    const targetDate = req.odeme_tarihi || (req.created_at ? req.created_at.slice(0, 10) : "")
    const reqName = normalizeName(req.user_name || "")
    const pName = normalizeName(personel.ad || "")

    const isMatch =
      req.user_id === user.id ||
      (req.tc_kimlik && req.tc_kimlik === personel.id) ||
      (reqName && pName && (reqName === pName || reqName.includes(pName) || pName.includes(reqName)))

    if (tutar > 0 && targetDate && targetDate >= start && targetDate <= end && isMatch) {
      advances.push({
        date: targetDate,
        amount: tutar,
        description: "Özel Avans (Onaylı Avans Talebi)",
      })
    }
  }

  // Check Kargo Prim for personnel
  if (kargoPrimData) {
    const secili = kargoPrimData.secili_personeller as string[] | null
    const isSelected = !secili || secili.includes(personel.id)
    const kargoAmount = isSelected ? Number(kargoPrimData.personel_hakedis || 0) : 0
    if (kargoAmount > 0) {
      overtime.push({
        date: start,
        amount: kargoAmount,
        description: `${monthName} Ayı Kargo Hakediş`,
        minutes: 0,
        rate: 0,
        source: "manual",
      })
    }
  }

  // Corba details
  const corbaDetails = (corbaData || [])
    .filter(c => Number(c.miktar) > 0)
    .map(c => ({
      date: c.tarih,
      amount: Number(c.miktar),
      description: `Çorba kazanılan kaydı (${Number(c.miktar).toLocaleString("tr-TR")} TL)`,
    }))
  const corbaTotal = corbaDetails.reduce((sum, item) => sum + item.amount, 0)

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

  return NextResponse.json(
    {
      period: { month, year, monthName, start, end },
      branch,
      personel: { id: personel.id, name: personel.ad },
      isManager,
      personelList: isManager ? (candidates || []).map((p) => ({ id: p.id, name: p.ad })) : [],
      baseSalary,
      bankaMaas,
      nakitMaas,
      hourlyRate,
      corbaTotal,
      corbaDetails,
      advanceTotal,
      overtimeTotal,
      remaining: baseSalary + overtimeTotal - advanceTotal,
      advances: advances.sort((a, b) => a.date.localeCompare(b.date)),
      overtime: overtime.sort((a, b) => a.date.localeCompare(b.date)),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    }
  )
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
}

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
