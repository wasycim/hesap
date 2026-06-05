import { NextRequest, NextResponse } from "next/server"
import { requireDashboardDeveloper } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const logBackupTables = [
  "security_events",
  "app_settings",
  "terminal_devices",
  "device_licenses",
  "dashboard_permission_overrides",
] as const

const securitySettingKeys = ["security_policy", "health_alerts", "maintenance_mode", "tea_module"]

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = String(error.message || "").toLowerCase()
  return error.code === "PGRST205" || message.includes("could not find the table") || message.includes("does not exist")
}

async function fetchAllRows(admin: ReturnType<typeof createAdminClient>, table: string) {
  const rows: unknown[] = []
  const pageSize = 1000

  for (let from = 0; from < 50000; from += pageSize) {
    const to = from + pageSize - 1
    const { data, error } = await admin.from(table).select("*").range(from, to)
    if (error) {
      if (isMissingTableError(error)) return rows
      throw new Error(`${table}: ${error.message}`)
    }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return rows
}

function rowsForTable(body: { tables?: Record<string, unknown[]> }, table: string) {
  const rows = body.tables?.[table]
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : []
}

async function deleteAllById(admin: ReturnType<typeof createAdminClient>, table: string) {
  const { error } = await admin
    .from(table)
    .delete()
    .not("id", "is", null)

  if (error && !isMissingTableError(error)) throw new Error(`${table}: ${error.message}`)
}

export async function GET() {
  const guard = await requireDashboardDeveloper()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}

  try {
    for (const table of logBackupTables) {
      tables[table] = await fetchAllRows(admin, table)
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Log yedegi alinamadi." }, { status: 500 })
  }

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: "log_backup_export",
    details: { tables: logBackupTables, exported_at: new Date().toISOString() },
  })

  return NextResponse.json({
    version: 1,
    type: "hesap-log-backup",
    exportedAt: new Date().toISOString(),
    exportedBy: guard.profile?.email || guard.user.email,
    tables,
  })
}

export async function POST(request: NextRequest) {
  const guard = await requireDashboardDeveloper()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => null) as { type?: string; tables?: Record<string, unknown[]> } | null
  if (!body?.tables || typeof body.tables !== "object") {
    return NextResponse.json({ error: "Log yedek dosyasi gecersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const restored: string[] = []

  for (const table of logBackupTables) {
    const rows = rowsForTable(body, table)
    if (rows.length === 0) continue

    const { error } = await admin.from(table).upsert(rows)
    if (error) {
      if (isMissingTableError(error)) continue
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    }
    restored.push(table)
  }

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: "log_backup_restore",
    details: { tables: restored, restored_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true, restored })
}

export async function DELETE(request: NextRequest) {
  const guard = await requireDashboardDeveloper()
  if (!guard.ok) return guard.response

  const target = request.nextUrl.searchParams.get("target") || "logs"
  const admin = createAdminClient()
  const deleted: string[] = []

  try {
    if (target === "logs" || target === "all") {
      await deleteAllById(admin, "security_events")
      deleted.push("security_events")
    }

    if (target === "security-settings" || target === "all") {
      await deleteAllById(admin, "terminal_devices")
      deleted.push("terminal_devices")
      await deleteAllById(admin, "device_licenses")
      deleted.push("device_licenses")
      await deleteAllById(admin, "dashboard_permission_overrides")
      deleted.push("dashboard_permission_overrides")
      const { error } = await admin.from("app_settings").delete().in("key", securitySettingKeys)
      if (error && !isMissingTableError(error)) throw new Error(`app_settings: ${error.message}`)
      deleted.push("app_settings")
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Log yedegi silinemedi." }, { status: 500 })
  }

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: "log_backup_delete",
    details: { target, deleted, deleted_at: new Date().toISOString() },
  })

  return NextResponse.json({ ok: true, deleted })
}
