import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidTcKimlik, normalizeTcKimlik } from "@/lib/tc-kimlik"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false, isDeveloper: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .single()

  return {
    user,
    isAdmin: Boolean((profile?.is_admin || profile?.is_developer) && profile.dashboard_access !== false),
    isDeveloper: Boolean(profile?.is_developer && profile.dashboard_access !== false),
  }
}

function normalizeTrustedIps(value: unknown) {
  const rawItems = Array.isArray(value) ? value : String(value || "").split(/[\n,; ]+/)
  return Array.from(new Set(rawItems.map(item => String(item).trim()).filter(Boolean)))
}

function syntheticEmailForTc(tcKimlik: string) {
  return `personel-${tcKimlik}@pamukkaleturizm.info`
}

function normalizeDashboardAccess(value: unknown) {
  return value !== false
}

function normalizeRole(body: any, isDeveloper: boolean, dashboardAccess: boolean) {
  const requestedDeveloper = dashboardAccess && Boolean(body.isDeveloper)
  const requestedAdmin = dashboardAccess && Boolean(body.isAdmin)
  const is_developer = Boolean(isDeveloper && requestedDeveloper)
  const is_admin = Boolean(isDeveloper && (requestedAdmin || is_developer))
  return { is_admin, is_developer }
}

export async function GET() {
  const { isAdmin } = await requireAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, email, display_name, tc_kimlik, is_admin, is_developer, dashboard_access, sube_id, vardiya, biometric_enabled, license_exempt, created_at, subeler:sube_id(ad)")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authEmailById = new Map((authData?.users || []).map(user => [user.id, user.email]))
  const authDisplayNameById = new Map((authData?.users || []).map(user => [user.id, user.user_metadata?.display_name || ""]))
  const authTcById = new Map((authData?.users || []).map(user => [user.id, normalizeTcKimlik(user.user_metadata?.tc_kimlik)]))
  const authTrustedIpsById = new Map((authData?.users || []).map(user => [user.id, normalizeTrustedIps(user.user_metadata?.trusted_ips)]))

  const users = (data || []).map(profile => ({
    ...profile,
    email: profile.email || authEmailById.get(profile.user_id) || null,
    display_name: profile.display_name || authDisplayNameById.get(profile.user_id) || "",
    tc_kimlik: normalizeTcKimlik(profile.tc_kimlik) || authTcById.get(profile.user_id) || "",
    dashboard_access: profile.dashboard_access !== false,
    is_admin: Boolean(profile.is_admin || profile.is_developer),
    is_developer: Boolean(profile.is_developer),
    trusted_ips: authTrustedIpsById.get(profile.user_id) || [],
  }))

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const { user: actor, isAdmin, isDeveloper } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)
  const email = String(body.email || "").trim().toLowerCase() || syntheticEmailForTc(tcKimlik)
  const password = String(body.password || "123456")
  const displayName = String(body.displayName || "").trim()
  const subeId = String(body.subeId || "").trim()
  const dashboardAccess = normalizeDashboardAccess(body.dashboardAccess)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"
  const trustedIps = normalizeTrustedIps(body.trustedIps)

  if ((body.isAdmin || body.isDeveloper) && !isDeveloper) {
    return NextResponse.json({ error: "Yonetici veya developer hesabi sadece developer tarafindan acilabilir." }, { status: 403 })
  }

  const { is_admin, is_developer } = normalizeRole(body, isDeveloper, dashboardAccess)

  if (!tcKimlik || !subeId || !displayName) {
    return NextResponse.json({ error: "TC, isim soyisim ve sube zorunlu." }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Sifre en az 6 karakter olmali." }, { status: 400 })
  }

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarasi matematiksel kurallara uygun degil." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existingTc } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (existingTc) {
    return NextResponse.json({ error: "Bu TC ile kayitli bir kullanici var." }, { status: 400 })
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      tc_kimlik: tcKimlik,
      trusted_ips: trustedIps,
      dashboard_access: dashboardAccess,
      is_developer,
    },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Kullanici olusturulamadi." }, { status: 500 })
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    user_id: authData.user.id,
    email,
    display_name: displayName,
    tc_kimlik: tcKimlik,
    is_admin,
    is_developer,
    dashboard_access: dashboardAccess,
    license_exempt: is_developer,
    sube_id: subeId,
    vardiya,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await admin.from("security_events").insert({
    user_id: actor.id,
    user_email: actor.email,
    event_type: "user_create",
    details: {
      created_email: email,
      display_name: displayName,
      tc_kimlik: tcKimlik,
      sube_id: subeId,
      is_admin,
      is_developer,
      dashboard_access: dashboardAccess,
      vardiya,
      trusted_ips: trustedIps,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const { user: actor, isAdmin, isDeveloper } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)
  const displayName = String(body.displayName || "").trim()
  const subeId = String(body.subeId || "").trim()
  const nextDashboardAccess = normalizeDashboardAccess(body.dashboardAccess)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"
  const trustedIps = normalizeTrustedIps(body.trustedIps)

  if (!userId || !tcKimlik || !subeId || !displayName) {
    return NextResponse.json({ error: "Kullanici, TC, isim soyisim ve sube zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: currentTarget } = await admin
    .from("user_profiles")
    .select("is_admin, is_developer")
    .eq("user_id", userId)
    .maybeSingle()

  if ((body.isAdmin || body.isDeveloper || currentTarget?.is_admin || currentTarget?.is_developer) && !isDeveloper) {
    return NextResponse.json({ error: "Yonetici/developer yetkilerini sadece developer duzenleyebilir." }, { status: 403 })
  }

  const { is_admin, is_developer } = normalizeRole(body, isDeveloper, nextDashboardAccess)

  if (userId === actor.id && (!nextDashboardAccess || (!is_admin && !is_developer))) {
    return NextResponse.json({ error: "Kendi yonetici/developer yetkinizi kapatamazsiniz." }, { status: 400 })
  }

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarasi matematiksel kurallara uygun degil." }, { status: 400 })
  }

  const { data: existingTc } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("tc_kimlik", tcKimlik)
    .neq("user_id", userId)
    .maybeSingle()

  if (existingTc) {
    return NextResponse.json({ error: "Bu TC ile kayitli baska bir kullanici var." }, { status: 400 })
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
    ...(email ? { email, email_confirm: true } : {}),
    user_metadata: {
      display_name: displayName,
      tc_kimlik: tcKimlik,
      trusted_ips: trustedIps,
      dashboard_access: nextDashboardAccess,
      is_developer,
    },
  })

  if (authUpdateError) {
    return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      ...(email ? { email } : {}),
      display_name: displayName,
      tc_kimlik: tcKimlik,
      is_admin,
      is_developer,
      dashboard_access: nextDashboardAccess,
      license_exempt: is_developer,
      sube_id: subeId,
      vardiya,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  await admin.from("security_events").insert({
    user_id: actor.id,
    user_email: actor.email,
    event_type: "user_update",
    details: {
      updated_user_id: userId,
      email: email || undefined,
      display_name: displayName,
      tc_kimlik: tcKimlik,
      sube_id: subeId,
      is_admin,
      is_developer,
      dashboard_access: nextDashboardAccess,
      vardiya,
      trusted_ips: trustedIps,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { user: actor, isAdmin, isDeveloper } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()

  if (!userId) {
    return NextResponse.json({ error: "Silinecek kullanici zorunlu." }, { status: 400 })
  }

  if (userId === actor.id) {
    return NextResponse.json({ error: "Kendi hesabinizi silemezsiniz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, display_name, tc_kimlik, is_admin, is_developer, dashboard_access, sube_id, vardiya")
    .eq("user_id", userId)
    .maybeSingle()

  if ((profile?.is_admin || profile?.is_developer) && !isDeveloper) {
    return NextResponse.json({ error: "Yonetici/developer hesaplarini sadece developer silebilir." }, { status: 403 })
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  await admin.from("user_profiles").delete().eq("user_id", userId)

  await admin.from("security_events").insert({
    user_id: actor.id,
    user_email: actor.email,
    event_type: "user_delete",
    details: {
      deleted_user_id: userId,
      deleted_email: profile?.email || null,
      display_name: profile?.display_name || null,
      tc_kimlik: profile?.tc_kimlik || null,
      was_admin: Boolean(profile?.is_admin),
      was_developer: Boolean(profile?.is_developer),
      dashboard_access: profile?.dashboard_access !== false,
      sube_id: profile?.sube_id || null,
      vardiya: profile?.vardiya || null,
    },
  })

  return NextResponse.json({ ok: true })
}
