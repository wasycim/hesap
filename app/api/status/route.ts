import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { canSendAdminDigestEmail } from "@/lib/email/admin-digest"
import { getPushProviderStatus } from "@/lib/notifications/push"

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

export async function GET() {
  const push = getPushProviderStatus()
  const components = await Promise.all([
    Promise.resolve({ name: "Web uygulamasi", status: "operational" as ComponentState, latencyMs: 0 }),
    checkDatabase(),
    checkSupabase(),
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
