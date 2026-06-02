import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"

async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

function todayStartIso() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  return new Date(`${today}T00:00:00+03:00`).toISOString()
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: myItems, error: myError }, adminGuard] = await Promise.all([
    admin
      .from("tea_request_recipients")
      .select("id, response, responded_at, created_at, tea_requests:request_id(id, title, message, status, created_at, created_by)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    requireDashboardAdmin(),
  ])

  if (myError) return NextResponse.json({ error: myError.message }, { status: 500 })

  let requests: any[] = []
  let users: any[] = []
  if (adminGuard.ok) {
    const [requestsRes, usersRes] = await Promise.all([
      admin
        .from("tea_requests")
        .select("id, title, message, status, created_at, created_by, tea_request_recipients(id, response, responded_at, user_id)")
        .gte("created_at", todayStartIso())
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("user_profiles")
        .select("user_id, display_name, email, sube_id, subeler:sube_id(ad)")
        .neq("dashboard_access", false)
        .neq("user_id", adminGuard.user.id)
        .order("display_name"),
    ])
    users = usersRes.data || []
    const profileByUserId = new Map(users.map((profile: any) => [String(profile.user_id), profile]))
    requests = (requestsRes.data || []).map((request: any) => ({
      ...request,
      recipient_profile: profileByUserId.get(String(request.tea_request_recipients?.[0]?.user_id)) || null,
    }))
  }

  return NextResponse.json({ myItems: myItems || [], requests, users, isAdmin: adminGuard.ok })
}

export async function POST(request: NextRequest) {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const message = String(body.message || "Cay hazir mi?").trim().slice(0, 500) || "Cay hazir mi?"
  if (!userId) return NextResponse.json({ error: "Tek bir kullanici secin." }, { status: 400 })
  if (userId === guard.user.id) return NextResponse.json({ error: "Yonetici kendi gonderdigi cay sorusuna cevap veremez." }, { status: 400 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, display_name, email")
    .eq("user_id", userId)
    .neq("dashboard_access", false)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) return NextResponse.json({ error: "Kullanici bulunamadi." }, { status: 404 })

  const { data: existing } = await admin
    .from("tea_request_recipients")
    .select("id, response, tea_requests:request_id(created_at, status)")
    .eq("user_id", userId)
    .gte("created_at", todayStartIso())
    .limit(1)
    .maybeSingle()
  if (existing) return NextResponse.json({ error: "Bu kullaniciya bugun zaten cay sorusu gonderildi." }, { status: 409 })

  const { data: teaRequest, error: requestError } = await admin
    .from("tea_requests")
    .insert({ title: "Cay hazir mi?", message, created_by: guard.user.id })
    .select("id")
    .single()
  if (requestError || !teaRequest) return NextResponse.json({ error: requestError?.message || "Cay istegi olusturulamadi." }, { status: 500 })

  const { error: recipientError } = await admin
    .from("tea_request_recipients")
    .insert({ request_id: teaRequest.id, user_id: userId })
  if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 })

  const { data: notification } = await admin
    .from("app_notifications")
    .insert({
      user_id: userId,
      title: "Cay hazir mi?",
      body: message,
      href: "/dashboard/cay",
      level: "info",
      source_key: `tea:${teaRequest.id}:${userId}`,
    })
    .select("id")
    .single()

  if (notification?.id) {
    await deliverPushToUserDevices(admin, {
      userId,
      notificationId: String(notification.id),
      title: "Cay hazir mi?",
      body: message,
      href: "/dashboard/cay",
      level: "info",
    })
  }

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: "tea_request_create",
    details: { request_id: teaRequest.id, target_user_id: userId },
  })

  return NextResponse.json({ ok: true, requestId: teaRequest.id, recipient: profile })
}

export async function PATCH(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "").trim()
  const response = body.response === "ready" ? "ready" : body.response === "not_ready" ? "not_ready" : ""
  if (!id || !response) return NextResponse.json({ error: "Cevap gecersiz." }, { status: 400 })

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from("tea_request_recipients")
    .update({ response, responded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("response", "pending")
    .select("request_id, response, tea_requests:request_id(created_by, title)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const creatorId = (updated as any)?.tea_requests?.created_by
  if (creatorId && creatorId !== user.id) {
    const label = response === "ready" ? "Hazir" : "Hazir degil"
    const { data: userProfile } = await admin
      .from("user_profiles")
      .select("display_name, email")
      .eq("user_id", user.id)
      .maybeSingle()
    const name = userProfile?.display_name || userProfile?.email || user.email || "Kullanici"
    const { data: notification } = await admin
      .from("app_notifications")
      .insert({
        user_id: creatorId,
        title: `Cay cevabi: ${label}`,
        body: `${name} cay durumunu ${label.toLowerCase()} olarak isaretledi.`,
        href: "/dashboard/cay",
        level: response === "ready" ? "success" : "warning",
      })
      .select("id")
      .single()
    if (notification?.id) {
      await deliverPushToUserDevices(admin, {
        userId: String(creatorId),
        notificationId: String(notification.id),
        title: `Cay cevabi: ${label}`,
        body: `${name} cevap verdi.`,
        href: "/dashboard/cay",
        level: response === "ready" ? "success" : "warning",
      })
    }
  }

  return NextResponse.json({ ok: true })
}
