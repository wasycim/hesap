import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(date)
}

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get("date") || dateKey()
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
    admin.from("vardiya_planlari").select("id, personel_id, tarih, vardiya, notlar").eq("sube_id", profile.sube_id).eq("tarih", date),
    admin.from("vardiya_tanimlari").select("id, ad, simge, baslangic, bitis, aktif, sira").eq("sube_id", profile.sube_id).eq("aktif", true).order("sira"),
    admin.from("vardiya_sabit_ayarlari").select("kod, ad, simge, baslangic, bitis, aktif").eq("aktif", true),
  ])

  const currentPersonel = (personeller || []).find((p) => normalizeName(p.ad) === normalizeName(profile.display_name))
  const planMap = new Map((plans || []).map((p) => [p.personel_id, p]))

  // Build Shift List for each personnel
  const shiftList = (personeller || []).map((p) => {
    const plan = planMap.get(p.id)
    const shiftCode = plan?.vardiya || p.sabit_vardiya || "S"
    
    // Find shift details
    const custom = (customShifts || []).find((s) => s.id === shiftCode || s.simge === shiftCode)
    const fixed = (fixedShifts || []).find((s) => s.kod === shiftCode || s.simge === shiftCode)
    
    const label = custom ? custom.ad : fixed ? fixed.ad : shiftCode
    const hours = custom
      ? `${custom.baslangic || ""}-${custom.bitis || ""}`
      : fixed && fixed.baslangic
      ? `${fixed.baslangic}-${fixed.bitis}`
      : ""

    return {
      personelId: p.id,
      name: p.ad,
      shiftCode,
      label,
      hours,
      notes: plan?.notlar || null,
      isCurrentUser: p.id === currentPersonel?.id,
    }
  })

  const currentUserShift = shiftList.find((s) => s.isCurrentUser) || null
  const sameShiftPeers = currentUserShift
    ? shiftList.filter((s) => s.shiftCode === currentUserShift.shiftCode && !s.isCurrentUser)
    : []

  const availableShifts = [
    ...(fixedShifts || []).map((s) => ({ code: s.kod, label: `${s.ad} (${s.baslangic || ""}-${s.bitis || ""})` })),
    ...(customShifts || []).map((s) => ({ code: s.id, label: `${s.ad} (${s.baslangic || ""}-${s.bitis || ""})` })),
  ]

  return NextResponse.json({
    date,
    branch,
    isAdmin,
    currentUser: currentPersonel ? { id: currentPersonel.id, name: currentPersonel.ad } : null,
    currentUserShift,
    sameShiftPeers,
    allShifts: isAdmin ? shiftList : [],
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
