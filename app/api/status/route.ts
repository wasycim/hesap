import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getPushProviderStatus } from "@/lib/notifications/push"
import { PrismaClient } from "@prisma/client"

type ComponentState = "operational" | "degraded" | "down"

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
      message: error instanceof Error ? error.message : "Veritabani kontrolu basarisiz.",
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
      message: error instanceof Error ? error.message : "Supabase kontrolu basarisiz.",
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
      message: "FAILOVER_DATABASE_URL tanimli degil",
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
      message: "Yedek veritabani erisilebilir",
    }
  } catch (error) {
    return {
      name: "Yedek PostgreSQL failover",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Yedek PostgreSQL kontrolu basarisiz.",
    }
  } finally {
    await failover.$disconnect().catch(() => undefined)
  }
}

async function checkBackupStatus() {
  const startedAt = Date.now()
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from("security_events")
      .select("created_at, details")
      .eq("event_type", "vps_backup_completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      return {
        name: "Günlük full backup",
        status: "degraded" as ComponentState,
        latencyMs: Date.now() - startedAt,
        message: "VPS backup henuz durum kaydi birakmadi.",
      }
    }

    const createdAt = new Date(data.created_at)
    const ageHours = (Date.now() - createdAt.getTime()) / 1000 / 60 / 60
    const status: ComponentState = ageHours <= 36 ? "operational" : ageHours <= 48 ? "degraded" : "down"
    const details = (data.details || {}) as Record<string, unknown>
    const file = typeof details.file === "string" ? details.file : "dump dosyasi"

    return {
      name: "Günlük full backup",
      status,
      latencyMs: Date.now() - startedAt,
      message: `${file} ${createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })} tarihinde alindi. Kapsam: full PostgreSQL dump, gelir/gider dahil.`,
    }
  } catch (error) {
    return {
      name: "Günlük full backup",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Backup kontrolu basarisiz.",
    }
  }
}

export async function GET() {
  const push = getPushProviderStatus()
  const components = await Promise.all([
    Promise.resolve({ name: "Web uygulamasi", status: "operational" as ComponentState, latencyMs: 0 }),
    checkDatabase(),
    checkSupabase(),
    checkFailoverDatabase(),
    checkBackupStatus(),
    Promise.resolve({
      name: "FCM push bildirim",
      status: push.configured ? "operational" as ComponentState : "degraded" as ComponentState,
      latencyMs: 0,
      message: push.configured ? "Push anahtarlari hazir" : `Eksik: ${push.missing.join(", ")}`,
    }),
    Promise.resolve({
      name: "SMTP e-posta",
      status: canSendAdminDigestEmail() ? "operational" as ComponentState : "degraded" as ComponentState,
      latencyMs: 0,
      message: canSendAdminDigestEmail() ? "Rapor ve sifre maili hazir" : "SMTP ayarlari eksik",
    }),
    Promise.resolve({
      name: "Cloudflare R2 yedek deposu",
      status: process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME
        ? "operational" as ComponentState
        : "degraded" as ComponentState,
      latencyMs: 0,
      message: process.env.R2_BUCKET_NAME ? `Bucket hazir: ${process.env.R2_BUCKET_NAME}` : "R2 ortam degiskenleri eksik",
    }),
    Promise.resolve({
      name: "Vercel deploy",
      status: process.env.VERCEL ? "operational" as ComponentState : "degraded" as ComponentState,
      latencyMs: 0,
      message: process.env.VERCEL ? `Bolge: ${process.env.VERCEL_REGION || "-"}` : "Vercel ortam bilgisi yok",
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
