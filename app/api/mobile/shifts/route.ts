import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date)
}

function getShiftDetails(shiftCode: string, customShifts: any[], fixedShifts: any[]) {
  const code = String(shiftCode || "S").trim().toLocaleUpperCase("tr-TR")
  const custom = (customShifts || []).find((s) => s.id === shiftCode || String(s.simge).toLocaleUpperCase("tr-TR") === code)
  const fixed = (fixedShifts || []).find((s) => s.kod === code || String(s.simge).toLocaleUpperCase("tr-TR") === code)

  let shortCode = "SAB"
  let label = "Sabah"
  let color = "#f59e0b" // Amber Gold

  if (code === "S" || code === "SAB" || (fixed && fixed.ad === "Sabah")) {
    shortCode = "SAB"
    label = "Sabah (06:00-16:00)"
    color = "#f59e0b"
  } else if (code === "A" || code === "AKS" || code === "AKŞ" || (fixed && fixed.ad === "Akşam")) {
    shortCode = "AKŞ"
    label = "Akşam (16:00-02:00)"
    color = "#6366f1" // Indigo
  } else if (code === "R" || code === "ARA" || (fixed && fixed.ad === "Ara")) {
    shortCode = "ARA"
    label = "Ara Vardiya (11:00-21:00)"
    color = "#06b6d4" // Cyan
  } else if (code === "I" || code === "İ" || code === "IZN" || code === "İZİN" || (fixed && fixed.ad === "İzin")) {
    shortCode = "İZN"
    label = "İzinli"
    color = "#64748b" // Slate Gray
  } else if (code === "OFF" || code === "TATİL") {
    shortCode = "OFF"
    label = "Haftalık Off"
    color = "#10b981" // Emerald Green
  } else if (code === "G" || code === "GEC" || code === "GECE") {
    shortCode = "GEC"
    label = "Gece Vardiyası"
    color = "#8b5cf6" // Purple
  } else if (custom) {
    shortCode = String(custom.simge || custom.ad || code).slice(0, 3).toLocaleUpperCase("tr-TR")
    label = `${custom.ad} (${custom.baslangic || ""}-${custom.bitis || ""})`
    color = "#3b82f6" // Blue
  } else {
    shortCode = code.slice(0, 3)
    label = fixed ? fixed.ad : code
    color = "#0284c7"
  }

  const hours = custom
    ? `${custom.baslangic || ""}-${custom.bitis || ""}`
    : fixed && fixed.baslangic
    ? `${fixed.baslangic}-${fixed.bitis}`
    : ""

  return { shortCode, label, hours, color }
}

function getWeekDates(centerDateStr: string) {
  const date = new Date(centerDateStr)
  if (Number.isNaN(date.getTime())) return getWeekDates(dateKey())

  const day = date.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(date)
  monday.setDate(date.getDate() + diffToMonday)

  const days = []
  const shortNames = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]
  const longNames = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const key = dateKey(d)
    days.push({
      date: key,
      shortDay: shortNames[i],
      longDay: longNames[i],
      dayIndex: i,
    })
  }
  return days
}

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const selectedDate = searchParams.get("date") || dateKey()
  const weekDays = getWeekDates(selectedDate)
  const weekDateKeys = weekDays.map((d) => d.date)

  const admin = createAdminClient()

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, display_name, is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.dashboard_access === false || !profile.sube_id) {
    return NextResponse.json({ error: "Personel profili veya şube eşleştirmesi bulunamadı." }, { status: 404 })
  }

  const isAdmin = Boolean(profile.is_admin || profile.is_developer)

  const [
    { data: branch },
    { data: personeller },
    { data: plans },
    { data: customShifts },
    { data: fixedShifts }
  ] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle(),
    admin.from("personeller").select("id, ad, sabit_vardiya, sira, aktif").eq("sube_id", profile.sube_id).eq("aktif", true).order("sira"),
    admin.from("vardiya_planlari").select("id, personel_id, tarih, vardiya, notlar").eq("sube_id", profile.sube_id).in("tarih", weekDateKeys),
    admin.from("vardiya_tanimlari").select("id, ad, simge, baslangic, bitis, aktif, sira").eq("sube_id", profile.sube_id).eq("aktif", true).order("sira"),
    admin.from("vardiya_sabit_ayarlari").select("kod, ad, simge, baslangic, bitis, aktif").eq("aktif", true),
  ])

  const currentPersonel = (personeller || []).find((p) => normalizeName(p.ad) === normalizeName(profile.display_name))
  const planMap = new Map((plans || []).map((p) => [`${p.personel_id}:${p.tarih}`, p]))

  // Build Weekly Shift Grid per personnel
  const weeklyShiftGrid = (personeller || []).map((p) => {
    const isCurrentUser = p.id === currentPersonel?.id
    const days = weekDays.map((wd) => {
      const plan = planMap.get(`${p.id}:${wd.date}`)
      const shiftCode = plan?.vardiya || p.sabit_vardiya || "S"
      const { shortCode, label, hours, color } = getShiftDetails(shiftCode, customShifts || [], fixedShifts || [])
      return {
        date: wd.date,
        shortDay: wd.shortDay,
        longDay: wd.longDay,
        shiftCode,
        shortCode,
        label,
        hours,
        color,
        notes: plan?.notlar || null,
      }
    })

    const selectedDayShift = days.find((d) => d.date === selectedDate) || days[0]

    return {
      personelId: p.id,
      name: p.ad,
      isCurrentUser,
      currentDayShift: selectedDayShift,
      weeklyDays: days,
    }
  })

  const shiftListForSelectedDate = weeklyShiftGrid.map((p) => ({
    personelId: p.personelId,
    name: p.name,
    shiftCode: p.currentDayShift.shiftCode,
    shortCode: p.currentDayShift.shortCode,
    label: p.currentDayShift.label,
    hours: p.currentDayShift.hours,
    color: p.currentDayShift.color,
    notes: p.currentDayShift.notes,
    isCurrentUser: p.isCurrentUser,
  }))

  const currentUserShift = shiftListForSelectedDate.find((s) => s.isCurrentUser) || null
  const sameShiftPeers = currentUserShift
    ? shiftListForSelectedDate.filter((s) => s.shiftCode === currentUserShift.shiftCode && !s.isCurrentUser)
    : []

  const availableShifts = [
    { code: "S", shortCode: "SAB", label: "Sabah (06:00-16:00)", color: "#f59e0b" },
    { code: "A", shortCode: "AKŞ", label: "Akşam (16:00-02:00)", color: "#6366f1" },
    { code: "R", shortCode: "ARA", label: "Ara (11:00-21:00)", color: "#06b6d4" },
    { code: "I", shortCode: "İZN", label: "İzinli", color: "#64748b" },
    { code: "OFF", shortCode: "OFF", label: "Haftalık Off", color: "#10b981" },
    { code: "G", shortCode: "GEC", label: "Gece Vardiyası", color: "#8b5cf6" },
    ...(customShifts || []).map((s) => ({
      code: s.id,
      shortCode: String(s.simge || s.ad || "ÖZL").slice(0, 3).toLocaleUpperCase("tr-TR"),
      label: `${s.ad} (${s.baslangic || ""}-${s.bitis || ""})`,
      color: "#3b82f6",
    })),
  ]

  return NextResponse.json({
    date: selectedDate,
    weekDays,
    branch,
    isAdmin,
    currentUser: currentPersonel ? { id: currentPersonel.id, name: currentPersonel.ad } : null,
    currentUserShift,
    sameShiftPeers,
    allShifts: isAdmin ? shiftListForSelectedDate : [],
    weeklyGrid: weeklyShiftGrid,
    availableShifts: isAdmin ? availableShifts : [],
  })
}

export async function POST(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Vardiya atamak için yönetici yetkisi gereklidir." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { personelId, date, shiftCode, notes } = body

  if (!personelId || !date || !shiftCode) {
    return NextResponse.json({ error: "Personel, tarih ve vardiya seçimi zorunludur." }, { status: 400 })
  }

  const payload = {
    sube_id: profile.sube_id,
    personel_id: personelId,
    tarih: date,
    vardiya: shiftCode,
    notlar: notes || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from("vardiya_planlari")
    .upsert(payload, { onConflict: "sube_id,personel_id,tarih" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: "Vardiya başarıyla atandı." })
}
