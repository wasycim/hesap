import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidTcKimlik, normalizeTcKimlik } from "@/lib/tc-kimlik"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, dashboard_access")
    .eq("user_id", user.id)
    .single()

  return { user, isAdmin: Boolean(profile?.is_admin && profile.dashboard_access !== false) }
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

export async function GET() {
  const { isAdmin } = await requireAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, email, display_name, tc_kimlik, is_admin, dashboard_access, sube_id, vardiya, created_at, subeler:sube_id(ad)")
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
    trusted_ips: authTrustedIpsById.get(profile.user_id) || [],
  }))

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const { user: actor, isAdmin } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)
  const email = String(body.email || "").trim().toLowerCase() || syntheticEmailForTc(tcKimlik)
  const password = String(body.password || "123456")
  const displayName = String(body.displayName || "").trim()
  const subeId = String(body.subeId || "").trim()
  const dashboardAccess = normalizeDashboardAccess(body.dashboardAccess)
  const isNewUserAdmin = dashboardAccess && Boolean(body.isAdmin)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"
  const trustedIps = normalizeTrustedIps(body.trustedIps)

  if (!tcKimlik || !subeId || !displayName) {
    return NextResponse.json({ error: "TC, isim soyisim ve şube zorunlu." }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 })
  }

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarası matematiksel kurallara uygun değil." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existingTc } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (existingTc) {
    return NextResponse.json({ error: "Bu TC ile kayıtlı bir kullanıcı var." }, { status: 400 })
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
    },
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Kullanıcı oluşturulamadı." }, { status: 500 })
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    user_id: authData.user.id,
    email,
    display_name: displayName,
    tc_kimlik: tcKimlik,
    is_admin: isNewUserAdmin,
    dashboard_access: dashboardAccess,
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
      is_admin: isNewUserAdmin,
      dashboard_access: dashboardAccess,
      vardiya,
      trusted_ips: trustedIps,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const { user: actor, isAdmin } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)
  const displayName = String(body.displayName || "").trim()
  const subeId = String(body.subeId || "").trim()
  const nextDashboardAccess = normalizeDashboardAccess(body.dashboardAccess)
  const nextIsAdmin = nextDashboardAccess && Boolean(body.isAdmin)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"
  const trustedIps = normalizeTrustedIps(body.trustedIps)

  if (!userId || !tcKimlik || !subeId || !displayName) {
    return NextResponse.json({ error: "Kullanıcı, TC, isim soyisim ve şube zorunlu." }, { status: 400 })
  }

  if (userId === actor.id && (!nextDashboardAccess || !nextIsAdmin)) {
    return NextResponse.json({ error: "Kendi yönetici/dashboard yetkinizi kapatamazsınız." }, { status: 400 })
  }

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarası matematiksel kurallara uygun değil." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existingTc } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("tc_kimlik", tcKimlik)
    .neq("user_id", userId)
    .maybeSingle()

  if (existingTc) {
    return NextResponse.json({ error: "Bu TC ile kayıtlı başka bir kullanıcı var." }, { status: 400 })
  }

  const authUpdatePayload = {
    ...(email ? { email, email_confirm: true } : {}),
    user_metadata: {
      display_name: displayName,
      tc_kimlik: tcKimlik,
      trusted_ips: trustedIps,
      dashboard_access: nextDashboardAccess,
    },
  }

  const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, authUpdatePayload)

  if (authUpdateError) {
    return NextResponse.json({ error: authUpdateError.message }, { status: 500 })
  }

  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      ...(email ? { email } : {}),
      display_name: displayName,
      tc_kimlik: tcKimlik,
      is_admin: nextIsAdmin,
      dashboard_access: nextDashboardAccess,
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
      is_admin: nextIsAdmin,
      dashboard_access: nextDashboardAccess,
      vardiya,
      trusted_ips: trustedIps,
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { user: actor, isAdmin } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()

  if (!userId) {
    return NextResponse.json({ error: "Silinecek kullanıcı zorunlu." }, { status: 400 })
  }

  if (userId === actor.id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, display_name, tc_kimlik, is_admin, dashboard_access, sube_id, vardiya")
    .eq("user_id", userId)
    .maybeSingle()

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
      dashboard_access: profile?.dashboard_access !== false,
      sube_id: profile?.sube_id || null,
      vardiya: profile?.vardiya || null,
    },
  })

  return NextResponse.json({ ok: true })
}
