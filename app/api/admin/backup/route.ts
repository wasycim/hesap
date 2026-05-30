import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const backupTables = [
  "subeler",
  "personeller",
  "ortaklar",
  "sube_menu_izinleri",
  "vardiya_tanimlari",
  "vardiya_sabit_ayarlari",
  "vardiya_planlari",
  "admin_digest_subscribers",
  "terminal_devices",
]

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}

  for (const table of backupTables) {
    const { data, error } = await admin.from(table).select("*").limit(10000)
    if (error) {
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    }
    tables[table] = data || []
  }

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "backup_export",
    details: { tables: backupTables, exported_at: new Date().toISOString() },
  })

  return NextResponse.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: adminGuard.user.email,
    tables,
  })
}

export async function POST(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => null) as { tables?: Record<string, unknown[]> } | null
  if (!body?.tables || typeof body.tables !== "object") {
    return NextResponse.json({ error: "Yedek dosyası geçersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const restored: string[] = []

  for (const table of backupTables) {
    const rows = body.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const { error } = await admin.from(table).upsert(rows as Record<string, unknown>[])
    if (error) return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    restored.push(table)
  }

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "backup_restore",
    details: { tables: restored, restored_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true, restored })
}
