import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getPushProviderStatus } from "@/lib/notifications/push"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

type ComponentState = "operational" | "degraded" | "down"

function statusFromAge(createdAt: Date): ComponentState {
  const ageHours = (Date.now() - createdAt.getTime()) / 1000 / 60 / 60
  if (ageHours <= 36) return "operational"
  if (ageHours <= 48) return "degraded"
  return "down"
}

async function checkDatabase() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`select 1`
    return { name: "PostgreSQL", status: "operational" as ComponentState, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      name: "PostgreSQL",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Veritabanı kontrolü başarısız.",
    }
  }
}

async function checkSupabase() {
  const startedAt = Date.now()
  try {
    const admin = createAdminClient()
    const { error } = await admin.from("subeler").select("id", { count: "exact", head: true })
    if (error) throw error
    return { name: "Supabase API", status: "operational" as ComponentState, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      name: "Supabase API",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Supabase kontrolü başarısız.",
    }
  }
}

async function checkFailoverDatabase() {
  const startedAt = Date.now()
  const failoverUrl = process.env.FAILOVER_DATABASE_URL?.trim()
  if (!failoverUrl) {
    return {
      name: "Yedek PostgreSQL failover",
      status: "degraded" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: "FAILOVER_DATABASE_URL tanımlı değil",
    }
  }

  const failover = new PrismaClient({
    datasources: {
      db: { url: failoverUrl },
    },
  })

  try {
    await failover.$queryRaw`select 1`
    return {
      name: "Yedek PostgreSQL failover",
      status: "operational" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: "Yedek veritabanı erişilebilir",
    }
  } catch (error) {
    return {
      name: "Yedek PostgreSQL failover",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Yedek PostgreSQL kontrolü başarısız.",
    }
  } finally {
    await failover.$disconnect().catch(() => undefined)
  }
}

async function checkBackupStatus() {
  const startedAt = Date.now()
  try {
    const admin = createAdminClient()
    const [vpsResult, snapshotResult] = await Promise.all([
      admin
        .from("security_events")
        .select("created_at, details")
        .eq("event_type", "vps_backup_completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("backup_snapshots")
        .select("title, created_at, table_counts")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (vpsResult.error && snapshotResult.error) {
      throw new Error(`${vpsResult.error.message}; ${snapshotResult.error.message}`)
    }

    const candidates: Array<{
      type: "vps" | "snapshot"
      createdAt: Date
      message: string
    }> = []

    if (vpsResult.data) {
      const createdAt = new Date(vpsResult.data.created_at)
      const details = (vpsResult.data.details || {}) as Record<string, unknown>
      const file = typeof details.file === "string" ? details.file : "dump dosyası"
      candidates.push({
        type: "vps",
        createdAt,
        message: `${file} ${createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alındı. Kapsam: full PostgreSQL dump, gelir/gider dahil.`,
      })
    }

    if (snapshotResult.data) {
      const createdAt = new Date(snapshotResult.data.created_at)
      const tableCount = Object.keys((snapshotResult.data.table_counts || {}) as Record<string, unknown>).length
      candidates.push({
        type: "snapshot",
        createdAt,
        message: `${snapshotResult.data.title || "Otomatik günlük yedek"} ${createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alındı. ${tableCount} tablo yedeklendi; gelir/gider dahil.`,
      })
    }

    if (candidates.length === 0) {
      return {
        name: "Günlük yedekleme",
        status: "degraded" as ComponentState,
        latencyMs: Date.now() - startedAt,
        message: "Günlük yedek kaydı henüz oluşmadı.",
      }
    }

    const latest = candidates.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
    const missingVpsNote =
      latest.type === "snapshot" && !vpsResult.data
        ? " VPS full dump kaydı bekleniyor; uygulama yedeği güncel."
        : ""

    return {
      name: "Günlük yedekleme",
      status: statusFromAge(latest.createdAt),
      latencyMs: Date.now() - startedAt,
      message: `${latest.message}${missingVpsNote}`,
    }
  } catch (error) {
    return {
      name: "Günlük yedekleme",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Yedek kontrolü başarısız.",
    }
  }
}

export async function GET() {
  const push = getPushProviderStatus()
  const components = await Promise.all([
    Promise.resolve({ name: "Web uygulaması", status: "operational" as ComponentState, latencyMs: 0 }),
    checkDatabase(),
    checkSupabase(),
    checkFailoverDatabase(),
    checkBackupStatus(),
    Promise.resolve({
      name: "FCM push bildirim",
      status: push.configured ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: push.configured ? "Push anahtarları hazır" : `Eksik: ${push.missing.join(", ")}`,
    }),
    Promise.resolve({
      name: "SMTP e-posta",
      status: canSendAdminDigestEmail() ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: canSendAdminDigestEmail() ? "Rapor ve şifre maili hazır" : "SMTP ayarları eksik",
    }),
    Promise.resolve({
      name: "Cloudflare R2 yedek deposu",
      status:
        process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
          ? ("operational" as ComponentState)
          : ("degraded" as ComponentState),
      latencyMs: 0,
      message: process.env.R2_BUCKET_NAME ? `Bucket hazır: ${process.env.R2_BUCKET_NAME}` : "R2 ortam değişkenleri eksik",
    }),
    Promise.resolve({
      name: "Vercel deploy",
      status: process.env.VERCEL ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: process.env.VERCEL ? `Bölge: ${process.env.VERCEL_REGION || "-"}` : "Vercel ortam bilgisi yok",
    }),
  ])

  const overall = components.some((item) => item.status === "down")
    ? "down"
    : components.some((item) => item.status === "degraded")
      ? "degraded"
      : "operational"

  return NextResponse.json({
    overall,
    checkedAt: new Date().toISOString(),
    components,
  })
}
