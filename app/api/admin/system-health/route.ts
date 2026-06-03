import { NextResponse } from "next/server"
import { requireDashboardDeveloper } from "@/lib/admin/require-admin"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getPushProviderStatus } from "@/lib/notifications/push"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { PrismaClient } from "@prisma/client"

type ComponentStatus = "operational" | "degraded" | "down"

async function checkFailoverDatabase(): Promise<{ status: ComponentStatus; message: string }> {
  const failoverUrl = process.env.FAILOVER_DATABASE_URL?.trim()
  if (!failoverUrl) {
    return {
      status: "degraded",
      message: "FAILOVER_DATABASE_URL tanimli degil",
    }
  }

  const failover = new PrismaClient({
    datasources: {
      db: {
        url: failoverUrl,
      },
    },
  })

  try {
    await failover.$queryRaw`select 1`
    return {
      status: "operational",
      message: "Yedek PostgreSQL erisilebilir",
    }
  } catch (error) {
    return {
      status: "down",
      message: error instanceof Error ? error.message : "Yedek PostgreSQL kontrolu basarisiz",
    }
  } finally {
    await failover.$disconnect().catch(() => undefined)
  }
}

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

  components.push({
    name: "Cloudflare R2 yedek deposu",
    status: process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
      ? "operational"
      : "degraded",
    message: process.env.R2_BUCKET_NAME
      ? `Bucket hazir: ${process.env.R2_BUCKET_NAME}`
      : "R2 ortam degiskenleri eksik",
  })

  const failoverStatus = await checkFailoverDatabase()
  components.push({
    name: "Yedek PostgreSQL failover",
    status: failoverStatus.status,
    message: failoverStatus.message,
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
      .select("id", { count: "exact", head: true })
      .eq("enabled", true)
      .not("push_token", "is", null),
    admin
      .from("push_delivery_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("user_devices")
      .select("id, user_id, device_id, platform, enabled, last_seen_at, updated_at, created_at, push_token")
      .order("last_seen_at", { ascending: false })
      .limit(10),
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
      latestDevices: (latestUserDevices.data || []).map((device: any) => ({
        id: device.id,
        user_id: device.user_id,
        device_id: device.device_id,
        platform: device.platform,
        enabled: device.enabled,
        has_push_token: Boolean(device.push_token),
        last_seen_at: device.last_seen_at,
        updated_at: device.updated_at,
        created_at: device.created_at,
      })),
    },
    digestSummary: {
      configured: canSendAdminDigestEmail(),
      latestEvents: digestEvents.data || [],
    },
  })
}
