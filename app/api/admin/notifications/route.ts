import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"
import { createAdminClient } from "@/lib/supabase/admin"

type TargetType = "user" | "branch" | "admins" | "all"
type NotificationLevel = "info" | "success" | "warning" | "error"

function normalizeTargetType(value: unknown): TargetType {
  return ["user", "branch", "admins", "all"].includes(String(value))
    ? String(value) as TargetType
    : "admins"
}

function normalizeLevel(value: unknown): NotificationLevel {
  return ["info", "success", "warning", "error"].includes(String(value))
    ? String(value) as NotificationLevel
    : "info"
}

function getBranchName(profile: any) {
  const subeler = profile?.subeler
  if (Array.isArray(subeler)) return subeler[0]?.ad || null
  return subeler?.ad || null
}

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const [profilesRes, notificationsRes, branchesRes] = await Promise.all([
    admin
      .from("user_profiles")
      .select("user_id, email, display_name, sube_id, is_admin, dashboard_access, subeler:sube_id(ad)")
      .not("user_id", "is", null)
      .order("display_name", { ascending: true }),
    admin
      .from("app_notifications")
      .select("id, user_id, title, body, href, level, read_at, push_status, push_error, push_sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("subeler")
      .select("id, ad, kod")
      .eq("aktif", true)
      .order("ad", { ascending: true }),
  ])

  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 })
  if (notificationsRes.error) return NextResponse.json({ error: notificationsRes.error.message }, { status: 500 })
  if (branchesRes.error) return NextResponse.json({ error: branchesRes.error.message }, { status: 500 })

  const profileById = new Map((profilesRes.data || []).map((profile: any) => [String(profile.user_id), profile]))

  return NextResponse.json({
    branches: branchesRes.data || [],
    users: (profilesRes.data || []).map((profile: any) => ({
      user_id: profile.user_id,
      email: profile.email,
      display_name: profile.display_name,
      sube_id: profile.sube_id,
      branch_name: getBranchName(profile),
      is_admin: Boolean(profile.is_admin),
      dashboard_access: profile.dashboard_access !== false,
    })),
    history: (notificationsRes.data || []).map((notification: any) => {
      const profile = notification.user_id ? profileById.get(String(notification.user_id)) : null
      return {
        ...notification,
        target_name: profile?.display_name || profile?.email || (notification.user_id ? notification.user_id : "Herkes"),
        branch_name: getBranchName(profile),
      }
    }),
  })
}

export async function POST(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const targetType = normalizeTargetType(body.targetType)
  const userId = String(body.userId || "").trim()
  const subeId = String(body.subeId || "").trim()
  const title = String(body.title || "").trim().slice(0, 120)
  const message = String(body.body || "").trim().slice(0, 500)
  const href = String(body.href || "/dashboard/bildirimler").trim().slice(0, 240) || "/dashboard/bildirimler"
  const level = normalizeLevel(body.level)
  const sendPush = body.sendPush !== false

  if (!title || !message) {
    return NextResponse.json({ error: "Baslik ve mesaj zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  let profileQuery = admin
    .from("user_profiles")
    .select("user_id, email, display_name, sube_id, is_admin, dashboard_access")
    .not("user_id", "is", null)

  if (targetType === "user") {
    if (!userId) return NextResponse.json({ error: "Kullanici secimi gerekli." }, { status: 400 })
    profileQuery = profileQuery.eq("user_id", userId)
  }
  if (targetType === "branch") {
    if (!subeId) return NextResponse.json({ error: "Sube secimi gerekli." }, { status: 400 })
    profileQuery = profileQuery.eq("sube_id", subeId)
  }
  if (targetType === "admins") {
    profileQuery = profileQuery.eq("is_admin", true).neq("dashboard_access", false)
  }

  const { data: profiles, error: profileError } = await profileQuery
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const recipients = Array.from(new Set((profiles || []).map((profile: any) => String(profile.user_id)).filter(Boolean)))
  if (!recipients.length) {
    return NextResponse.json({ error: "Bildirim gonderilecek kullanici bulunamadi." }, { status: 404 })
  }

  const { data: notifications, error: notificationError } = await admin
    .from("app_notifications")
    .insert(recipients.map((recipientId) => ({
      user_id: recipientId,
      title,
      body: message,
      href,
      level,
      push_status: sendPush ? "pending" : "skipped",
      source_key: `manual:${crypto.randomUUID()}:${recipientId}`,
    })))
    .select("id, user_id")

  if (notificationError) return NextResponse.json({ error: notificationError.message }, { status: 500 })

  let sent = 0
  let failed = 0
  let skipped = 0

  if (sendPush) {
    for (const notification of notifications || []) {
      const delivery = await deliverPushToUserDevices(admin, {
        userId: String(notification.user_id),
        notificationId: String(notification.id),
        title,
        body: message,
        href,
        level,
      })
      sent += delivery.sent
      failed += delivery.failed
      skipped += delivery.skipped + (delivery.deviceCount === 0 ? 1 : 0)
    }
  }

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.profile?.email || adminGuard.user.email || null,
    event_type: "manual_notification_sent",
    details: {
      target_type: targetType,
      sube_id: subeId || null,
      target_user_id: userId || null,
      recipient_count: recipients.length,
      push_sent: sent,
      push_failed: failed,
      push_skipped: skipped,
      level,
      href,
    },
  })

  return NextResponse.json({
    ok: true,
    recipients: recipients.length,
    notifications: notifications?.length || 0,
    push: { sent, failed, skipped },
  })
}
