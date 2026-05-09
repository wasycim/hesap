import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single()

  return { user, isAdmin: Boolean(profile?.is_admin) }
}

export async function GET() {
  const { isAdmin } = await requireAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, email, is_admin, sube_id, vardiya, created_at, subeler:sube_id(ad)")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authEmailById = new Map((authData?.users || []).map(user => [user.id, user.email]))
  const users = (data || []).map(profile => ({
    ...profile,
    email: profile.email || authEmailById.get(profile.user_id) || null,
  }))

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const { user: actor, isAdmin } = await requireAdmin()

  if (!actor || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const email = String(body.email || "").trim().toLowerCase()
  const subeId = String(body.subeId || "").trim()
  const isNewUserAdmin = Boolean(body.isAdmin)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"

  if (!email || !subeId) {
    return NextResponse.json({ error: "E-posta ve şube zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: "123456",
    email_confirm: true,
  })

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Kullanıcı oluşturulamadı." }, { status: 500 })
  }

  const { error: profileError } = await admin.from("user_profiles").upsert({
    user_id: authData.user.id,
    email,
    is_admin: isNewUserAdmin,
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
    details: { created_email: email, sube_id: subeId, is_admin: isNewUserAdmin, vardiya },
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
  const subeId = String(body.subeId || "").trim()
  const nextIsAdmin = Boolean(body.isAdmin)
  const vardiya = body.vardiya === "S" || body.vardiya === "A" || body.vardiya === "T" ? body.vardiya : "T"

  if (!userId || !subeId) {
    return NextResponse.json({ error: "Kullanıcı ve şube zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error: profileError } = await admin
    .from("user_profiles")
    .update({
      is_admin: nextIsAdmin,
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
    details: { updated_user_id: userId, sube_id: subeId, is_admin: nextIsAdmin, vardiya },
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
    .select("email, is_admin, sube_id, vardiya")
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
      was_admin: Boolean(profile?.is_admin),
      sube_id: profile?.sube_id || null,
      vardiya: profile?.vardiya || null,
    },
  })

  return NextResponse.json({ ok: true })
}
