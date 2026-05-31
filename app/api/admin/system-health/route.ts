import { NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getPushProviderStatus } from "@/lib/notifications/push"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

type ComponentStatus = "operational" | "degraded" | "down"

async function assertSupabase<T extends { error: { message?: string } | null }>(promise: PromiseLike<T>) {
  const result = await promise
  if (result.error) throw new Error(result.error.message || "Supabase kontrolü başarısız.")
  return result
}

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const checks = await Promise.allSettled([
    prisma.$queryRaw`select 1`,
    prisma.attendanceLog.count(),
    prisma.user.count(),
    assertSupabase(admin.from("security_events").select("id", { count: "exact", head: true })),
    assertSupabase(admin.from("terminal_devices").select("id", { count: "exact", head: true })),
    assertSupabase(admin.from("user_devices").select("id", { count: "exact", head: true })),
    assertSupabase(admin.from("push_delivery_logs").select("id", { count: "exact", head: true })),
  ])

  const names = [
    "Veritabanı bağlantısı",
    "Mesai kayıtları",
    "QR personel tablosu",
    "Güvenlik kayıtları",
    "Terminal cihazları",
    "Mobil cihaz tokenları",
    "Push teslim logları",
  ]

  const components: Array<{ name: string; status: ComponentStatus; message: string }> = checks.map((check, index) => ({
    name: names[index],
    status: check.status === "fulfilled" ? "operational" : "down",
    message: check.status === "fulfilled" ? "Çalışıyor" : check.reason instanceof Error ? check.reason.message : "Kontrol başarısız",
  }))

  const pushProvider = getPushProviderStatus()
  components.push({
    name: "FCM push sağlayıcısı",
    status: pushProvider.configured ? "operational" : "degraded",
    message: pushProvider.configured ? "Gerçek push gönderimi hazır" : `Eksik ortam değişkenleri: ${pushProvider.missing.join(", ")}`,
  })
  components.push({
    name: "Otomatik rapor e-postası",
    status: canSendAdminDigestEmail() ? "operational" : "degraded",
    message: canSendAdminDigestEmail() ? "SMTP hazır" : "SMTP_HOST, SMTP_USER veya SMTP_PASS eksik",
  })

  const [
    { data: latestEvents },
    { data: resetEvents },
    { data: pendingDevices },
    pushDeviceCount,
    latestPushLogs,
    digestEvents,
  ] = await Promise.all([
    admin.from("security_events").select("*").order("created_at", { ascending: false }).limit(8),
    admin
      .from("security_events")
      .select("*")
      .eq("event_type", "password_reset_request")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("terminal_devices")
      .select("*")
      .eq("approved", false)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("user_devices")
      .select("id", { count: "exact", head: true })
      .eq("enabled", true)
      .not("push_token", "is", null),
    admin
      .from("push_delivery_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("security_events")
      .select("*")
      .in("event_type", ["admin_digest_sent", "admin_digest_test_sent"])
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const overall: ComponentStatus = components.some((item) => item.status === "down")
    ? "down"
    : components.some((item) => item.status === "degraded")
      ? "degraded"
      : "operational"

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    overall,
    components,
    latestEvents: latestEvents || [],
    resetEvents: resetEvents || [],
    pendingDevices: pendingDevices || [],
    pushSummary: {
      provider: pushProvider.provider,
      configured: pushProvider.configured,
      missing: pushProvider.missing,
      registeredDevices: pushDeviceCount.count || 0,
      latestDeliveries: latestPushLogs.data || [],
    },
    digestSummary: {
      configured: canSendAdminDigestEmail(),
      latestEvents: digestEvents.data || [],
    },
  })
}
