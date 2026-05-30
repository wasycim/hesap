import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"

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

export async function GET() {
  const components = await Promise.all([
    Promise.resolve({ name: "Web uygulaması", status: "operational" as ComponentState, latencyMs: 0 }),
    checkDatabase(),
    checkSupabase(),
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
