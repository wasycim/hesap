import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"

type TargetType = "users" | "branch" | "all"

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: myItems, error: myError }, adminGuard] = await Promise.all([
    admin
      .from("tea_request_recipients")
      .select("id, response, responded_at, created_at, tea_requests:request_id(id, title, message, status, created_at)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    requireDashboardAdmin(),
  ])

  if (myError) return NextResponse.json({ error: myError.message }, { status: 500 })

  let requests: any[] = []
  let users: any[] = []
  let branches: any[] = []
  if (adminGuard.ok) {
    const [requestsRes, usersRes, branchesRes] = await Promise.all([
      admin
        .from("tea_requests")
        .select("id, title, message, status, created_at, tea_request_recipients(id, response, responded_at, user_id)")
        .order("created_at", { ascending: false })
        .limit(50),
      admin.from("user_profiles").select("user_id, display_name, email, sube_id, subeler:sube_id(ad)").neq("dashboard_access", false).order("display_name"),
      admin.from("subeler").select("id, ad, kod").eq("aktif", true).order("ad"),
    ])
    requests = requestsRes.data || []
    users = usersRes.data || []
    branches = branchesRes.data || []
  }

  return NextResponse.json({ myItems: myItems || [], requests, users, branches, isAdmin: adminGuard.ok })
}

export async function POST(request: NextRequest) {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const targetType = (["users", "branch", "all"].includes(body.targetType) ? body.targetType : "users") as TargetType
  const userIds = Array.isArray(body.userIds) ? body.userIds.map(String).filter(Boolean) : []
  const subeId = String(body.subeId || "").trim()
  const message = String(body.message || "Cay hazir mi?").trim().slice(0, 500) || "Cay hazir mi?"
  const admin = createAdminClient()

  let profileQuery = admin
    .from("user_profiles")
    .select("user_id, display_name, email, sube_id")
    .neq("dashboard_access", false)

  if (targetType === "users") profileQuery = profileQuery.in("user_id", userIds)
  if (targetType === "branch") profileQuery = profileQuery.eq("sube_id", subeId)

  const { data: profiles, error: profileError } = await profileQuery
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profiles?.length) return NextResponse.json({ error: "Bildirim gidecek kullanici bulunamadi." }, { status: 400 })

  const { data: teaRequest, error: requestError } = await admin
    .from("tea_requests")
    .insert({
      title: "Cay hazir mi?",
      message,
      created_by: guard.user.id,
    })
    .select("id")
    .single()

  if (requestError || !teaRequest) return NextResponse.json({ error: requestError?.message || "Cay istegi olusturulamadi." }, { status: 500 })

  const rows = profiles.map((profile: any) => ({ request_id: teaRequest.id, user_id: profile.user_id }))
  const { error: recipientError } = await admin.from("tea_request_recipients").insert(rows)
  if (recipientError) return NextResponse.json({ error: recipientError.message }, { status: 500 })

  const notificationRows = profiles.map((profile: any) => ({
    user_id: profile.user_id,
    title: "Cay hazir mi?",
    body: message,
    href: "/dashboard/cay",
    level: "info",
    source_key: `tea:${teaRequest.id}:${profile.user_id}`,
  }))
  const { data: notifications } = await admin.from("app_notifications").insert(notificationRows).select("id, user_id")
  for (const notification of notifications || []) {
    await deliverPushToUserDevices(admin, {
      userId: String(notification.user_id),
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
    details: { request_id: teaRequest.id, target_type: targetType, recipients: profiles.length },
  })

  return NextResponse.json({ ok: true, requestId: teaRequest.id, recipients: profiles.length })
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
    .select("request_id, response, tea_requests:request_id(created_by, title)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const creatorId = (updated as any)?.tea_requests?.created_by
  if (creatorId) {
    const label = response === "ready" ? "Hazir" : "Hazir degil"
    const { data: notification } = await admin
      .from("app_notifications")
      .insert({
        user_id: creatorId,
        title: `Cay cevabi: ${label}`,
        body: `${user.email || "Kullanici"} cay durumunu ${label.toLowerCase()} olarak isaretledi.`,
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
        body: `${user.email || "Kullanici"} cevap verdi.`,
        href: "/dashboard/cay",
        level: response === "ready" ? "success" : "warning",
      })
    }
  }

  return NextResponse.json({ ok: true })
}
