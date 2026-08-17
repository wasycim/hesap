import { NextResponse } from "next/server"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getApnsProviderStatus, getPushProviderStatus } from "@/lib/notifications/push"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

type ComponentState = "operational" | "degraded" | "down"

async function checkDatabase() {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`select 1`
    return { name: "PostgreSQL Veritabanı", status: "operational" as ComponentState, latencyMs: Date.now() - startedAt, message: "Sorunsuz çalışıyor" }
  } catch (error) {
    return {
      name: "PostgreSQL Veritabanı",
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
    return { name: "Supabase API Servisi", status: "operational" as ComponentState, latencyMs: Date.now() - startedAt, message: "Erişilebilir ve aktif" }
  } catch (error) {
    return {
      name: "Supabase API Servisi",
      status: "down" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : "Supabase kontrolü başarısız.",
    }
  }
}

async function checkEmailBackupStatus() {
  const startedAt = Date.now()
  const isEmailConfigured = canSendAdminDigestEmail()
  return [
    {
      name: "E-posta İle Otomatik Yedek & Güvenlik Bildirimi",
      status: (isEmailConfigured ? "operational" : "degraded") as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: isEmailConfigured
        ? "Yedek indirme ve restorasyon işlemlerinde SMTP e-posta bildirimi anında iletiliyor."
        : "SMTP ayarları yapılandırılmamış.",
    },
    {
      name: "Uygulama İçi Veritabanı Yedeği",
      status: "operational" as ComponentState,
      latencyMs: Date.now() - startedAt,
      message: "Gelişmiş JSON dışa aktarma, canlı önizleme ve geri yükleme sistemi aktif.",
    },
  ]
}

export async function GET() {
  const push = getPushProviderStatus()
  const apns = getApnsProviderStatus()

  const [db, sb, emailBackups] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkEmailBackupStatus(),
  ])

  const components = [
    { name: "Web Uygulaması (Vercel)", status: "operational" as ComponentState, latencyMs: 0, message: "Canlı ve aktif" },
    db,
    sb,
    ...emailBackups,
    {
      name: "FCM Push Bildirim Servisi",
      status: push.configured ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: push.configured ? "Push anahtarları hazır" : `Eksik: ${push.missing.join(", ")}`,
    },
    {
      name: "iOS APNs Push Bildirim Servisi",
      status: apns.configured ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: apns.configured ? "iOS bildirim anahtarları hazır" : `Eksik: ${apns.missing.join(", ")}`,
    },
    {
      name: "SMTP E-posta Servisi",
      status: canSendAdminDigestEmail() ? ("operational" as ComponentState) : ("degraded" as ComponentState),
      latencyMs: 0,
      message: canSendAdminDigestEmail() ? "Rapor ve yetkili bildirim e-postaları aktif" : "SMTP ayarları eksik",
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
