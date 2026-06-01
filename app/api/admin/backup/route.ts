import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const backupTables = [
  "subeler",
  "user_profiles",
  "personeller",
  "ortaklar",
  "gelir_firmalar",
  "gelir_kayitlari",
  "gider_kayitlari",
  "corbalar",
  "kargo_cari_firmalar",
  "kargo_cari_kayitlar",
  "kargo_cari_odemeler",
  "kolon_ayarlari",
  "on_dort_no_hesap_kayitlari",
  "companies",
  "partners",
  "records",
  "company_amounts",
  "partner_shares",
  "record_summary",
  "users",
  "shifts",
  "attendance_logs",
  "sube_menu_izinleri",
  "vardiya_tanimlari",
  "vardiya_sabit_ayarlari",
  "vardiya_planlari",
  "attendance_alert_rules",
  "admin_digest_subscribers",
  "terminal_devices",
  "user_devices",
  "app_notifications",
  "push_delivery_logs",
  "security_events",
]

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = String(error.message || "").toLowerCase()
  return error.code === "PGRST205" || message.includes("could not find the table") || message.includes("does not exist")
}

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}
  const skippedTables: string[] = []

  for (const table of backupTables) {
    const { data, error } = await admin.from(table).select("*").limit(10000)
    if (error) {
      if (isMissingTableError(error)) {
        skippedTables.push(table)
        continue
      }
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
    version: 2,
    exportedAt: new Date().toISOString(),
    exportedBy: adminGuard.user.email,
    skippedTables,
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
  const skippedTables: string[] = []

  for (const table of backupTables) {
    const rows = body.tables[table]
    if (!Array.isArray(rows) || rows.length === 0) continue
    const { error } = await admin.from(table).upsert(rows as Record<string, unknown>[])
    if (error) {
      if (isMissingTableError(error)) {
        skippedTables.push(table)
        continue
      }
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    }
    restored.push(table)
  }

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "backup_restore",
    details: { tables: restored, restored_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true, restored, skippedTables })
}
