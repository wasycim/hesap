import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"

export async function POST(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body.userId || adminGuard.user.id).trim()
  const title = String(body.title || "Hesap bildirimi").trim().slice(0, 120)
  const message = String(body.body || "Push bildirim altyapısı aktif olarak test edildi.").trim().slice(0, 240)
  const href = String(body.href || "/dashboard/mesai-takip").trim().slice(0, 240)
  const level = ["info", "success", "warning", "error"].includes(String(body.level)) ? String(body.level) : "info"

  if (!targetUserId) {
    return NextResponse.json({ error: "Kullanıcı seçimi gerekli." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: notification, error: notificationError } = await admin
    .from("app_notifications")
    .insert({
      user_id: targetUserId,
      title,
      body: message,
      href,
      level,
      push_status: "pending",
    })
    .select("id")
    .single()

  if (notificationError) {
    return NextResponse.json({ error: notificationError.message }, { status: 500 })
  }

  const delivery = await deliverPushToUserDevices(admin, {
    userId: targetUserId,
    notificationId: notification.id,
    title,
    body: message,
    href,
    level: level as "info" | "success" | "warning" | "error",
  })

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.profile?.email || adminGuard.user.email || null,
    event_type: "push_test_sent",
    details: { target_user_id: targetUserId, sent: delivery.sent, failed: delivery.failed, skipped: delivery.skipped, provider: "fcm" },
  })

  return NextResponse.json({
    ok: delivery.sent > 0,
    sent: delivery.sent,
    failed: delivery.failed,
    skipped: delivery.skipped,
    configured: delivery.configured,
    missing: delivery.missing,
    error: delivery.deviceCount === 0 ? "Kullanıcının kayıtlı push cihazı yok." : undefined,
  }, { status: delivery.sent > 0 ? 200 : 202 })
}
