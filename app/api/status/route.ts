import { PrismaClient } from "@prisma/client"
import { NextResponse } from "next/server"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getApnsProviderStatus, getPushProviderStatus } from "@/lib/notifications/push"
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

function formatBytes(bytes: number) {
  if (!bytes) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
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
        .limit(20),
      admin
        .from("backup_snapshots")
        .select("title, created_at, table_counts")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const backupComponents: Array<{ name: string; status: ComponentState; latencyMs: number; message: string }> = []

    // 1. App-level (internal) backup status
    if (snapshotResult.data) {
      const createdAt = new Date(snapshotResult.data.created_at)
      const tableCount = Object.keys((snapshotResult.data.table_counts || {}) as Record<string, unknown>).length
      backupComponents.push({
        name: "Uygulama İçi Günlük Yedek",
        status: statusFromAge(createdAt),
        latencyMs: Date.now() - startedAt,
        message: `${snapshotResult.data.title || "Otomatik günlük yedek"} ${createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alındı. ${tableCount} tablo yedeklendi.`,
      })
    } else {
      backupComponents.push({
        name: "Uygulama İçi Günlük Yedek",
        status: "degraded",
        latencyMs: Date.now() - startedAt,
        message: "Uygulama içi günlük yedek kaydı henüz oluşmadı.",
      })
    }

    // 2. Physical backup nodes (VPS, Raspberry Pi, etc.)
    const backupsByHost: Record<string, { createdAt: Date; file: string; size: number }> = {}
    if (vpsResult.data && Array.isArray(vpsResult.data)) {
      for (const row of vpsResult.data) {
        const details = (row.details || {}) as Record<string, unknown>
        const host = typeof details.host === "string" ? details.host : "vps"
        const createdAt = new Date(row.created_at)
        const file = typeof details.file === "string" ? details.file : "dump dosyası"
        const size = typeof details.size === "number" ? details.size : 0
        if (!backupsByHost[host] || backupsByHost[host].createdAt < createdAt) {
          backupsByHost[host] = { createdAt, file, size }
        }
      }
    }

    const hosts = Object.keys(backupsByHost)
    if (hosts.length === 0) {
      backupComponents.push({
        name: "Sunucu Yedeği (vps)",
        status: "degraded",
        latencyMs: Date.now() - startedAt,
        message: "Sunucu yedeği kaydı bulunamadı.",
      })
    } else {
      for (const host of hosts) {
        const backup = backupsByHost[host]
        backupComponents.push({
          name: `Sunucu Yedeği (${host})`,
          status: statusFromAge(backup.createdAt),
          latencyMs: Date.now() - startedAt,
          message: `${backup.file} (${formatBytes(backup.size)}) ${backup.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alındı. Kapsam: PostgreSQL dump.`,
        })
      }
    }

    return backupComponents
  } catch (error) {
    return [{
      name: "Günlük yedekleme",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Yedek kontrolü başarısız.",
    }]
  }
}

export async function GET() {
  const push = getPushProviderStatus()
  const apns = getApnsProviderStatus()
  
  const [db, sb, fdb, backups] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkFailoverDatabase(),
    checkBackupStatus(),
  ])

  const components = [
    { name: "Web uygulaması", status: "operational" as ComponentState, latencyMs: 0, message: "Sorunsuz çalışıyor" },
    db,
    sb,
    fdb,
    ...backups,
    {
      name: "FCM push bildirim",
      status: push.configured ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: push.configured ? "Push anahtarları hazır" : `Eksik: ${push.missing.join(", ")}`,
    },
    {
      name: "iOS APNs push bildirim",
      status: apns.configured ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: apns.configured ? "iOS bildirim anahtarları hazır" : `Eksik: ${apns.missing.join(", ")}`,
    },
    {
      name: "SMTP e-posta",
      status: canSendAdminDigestEmail() ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: canSendAdminDigestEmail() ? "Rapor ve şifre maili hazır" : "SMTP ayarları eksik",
    },
    {
      name: "Cloudflare R2 yedek deposu",
      status:
        process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
          ? ("operational" as ComponentState)
          : ("degraded" as ComponentState),
      latencyMs: 0,
      message: process.env.R2_BUCKET_NAME ? `Bucket hazır: ${process.env.R2_BUCKET_NAME}` : "R2 ortam değişkenleri eksik",
    },
    {
      name: "Vercel deploy",
      status: process.env.VERCEL ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: process.env.VERCEL ? `Bölge: ${process.env.VERCEL_REGION || "-"}` : "Vercel ortam bilgisi yok",
    },
  ]

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
