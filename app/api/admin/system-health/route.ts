import { NextResponse } from "next/server"
import { requireDashboardDeveloper } from "@/lib/admin/require-admin"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getApnsProviderStatus, getPushProviderStatus } from "@/lib/notifications/push"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

type ComponentStatus = "operational" | "degraded" | "down"

async function assertSupabase<T extends { error: { message?: string } | null }>(promise: PromiseLike<T>) {
  const result = await promise
  if (result.error) throw new Error(result.error.message || "Supabase kontrolü başarısız.")
  return result
}

export async function GET() {
  const adminGuard = await requireDashboardDeveloper()
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
  const apnsProvider = getApnsProviderStatus()
  components.push({
    name: "FCM push sağlayıcısı",
    status: pushProvider.configured ? "operational" : "degraded",
    message: pushProvider.configured ? "Gerçek push gönderimi hazır" : `Eksik ortam değişkenleri: ${pushProvider.missing.join(", ")}`,
  })
  components.push({
    name: "iOS APNs push sağlayıcısı",
    status: apnsProvider.configured ? "operational" : "degraded",
    message: apnsProvider.configured ? "iOS sistem bildirimi hazır" : `Eksik ortam değişkenleri: ${apnsProvider.missing.join(", ")}`,
  })
  components.push({
    name: "E-posta Yedek & Güvenlik Bildirimi",
    status: canSendAdminDigestEmail() ? "operational" : "degraded",
    message: canSendAdminDigestEmail() ? "SMTP e-posta bildirimi hazır" : "SMTP ayarları eksik",
  })
  components.push({
    name: "Uygulama İçi Veritabanı Yedeği",
    status: "operational",
    message: "Veritabanı JSON yedekleme ve canlı önizleme aktif",
  })

  const [
    { data: latestEvents },
    { data: resetEvents },
    { data: pendingDevices },
    pushDeviceCount,
    latestPushLogs,
    latestUserDevices,
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
      .select("id", { count: "exact", head: true }),
    admin
      .from("push_delivery_logs")
      .select("id, status, title, error, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("user_devices")
      .select("id, user_id, device_id, platform, enabled, has_push_token, last_seen_at, updated_at, created_at")
      .order("updated_at", { ascending: false })
      .limit(8),
    admin
      .from("security_events")
      .select("*")
      .eq("event_type", "admin_digest_sent")
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
      provider: pushProvider.configured ? "Firebase Cloud Messaging" : "Eksik Ayar",
      configured: pushProvider.configured,
      missing: pushProvider.missing,
      registeredDevices: pushDeviceCount.count || 0,
      latestDeliveries: (latestPushLogs.data || []).map((row: any) => ({
        id: String(row.id),
        status: (row.status || "skipped") as "sent" | "failed" | "skipped",
        title: (row.title || null) as string | null,
        error: (row.error || null) as string | null,
        created_at: String(row.created_at || new Date().toISOString()),
      })),
      latestDevices: (latestUserDevices.data || []).map((row: any) => ({
        id: String(row.id),
        user_id: String(row.user_id),
        device_id: (row.device_id || null) as string | null,
        platform: (row.platform || null) as string | null,
        enabled: Boolean(row.enabled),
        has_push_token: Boolean(row.has_push_token),
        last_seen_at: (row.last_seen_at || null) as string | null,
        updated_at: (row.updated_at || null) as string | null,
        created_at: String(row.created_at || new Date().toISOString()),
      })),
    },
    digestSummary: {
      configured: canSendAdminDigestEmail(),
      latestEvents: digestEvents.data || [],
    },
  })
}
