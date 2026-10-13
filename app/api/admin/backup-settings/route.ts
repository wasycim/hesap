import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { defaultBackupSettings, sanitizeBackupSettings } from "@/lib/backup/create-backup"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response
  const admin = createAdminClient()
  const [{ data: row, error }, { data: recent }] = await Promise.all([
    admin.from("app_settings").select("value").eq("key", "backup_delivery").maybeSingle(),
    admin.from("backup_snapshots").select("id, title, interval, object_path, size_bytes, status, error_message, completed_at, created_at").order("created_at", { ascending: false }).limit(8),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    settings: { ...defaultBackupSettings, ...(row?.value || {}) },
    storage: { provider: "Supabase Storage", bucket: process.env.BACKUP_STORAGE_BUCKET || "system-backups", encrypted: true },
    encryptionConfigured: Boolean(process.env.BACKUP_ENCRYPTION_KEY),
    recent: recent || [],
  })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response
  const input = await request.json().catch(() => ({}))
  const settings = sanitizeBackupSettings(input.settings || input)
  const admin = createAdminClient()
  const { error } = await admin.from("app_settings").upsert({
    key: "backup_delivery",
    value: settings,
    updated_by: guard.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "key" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from("security_events").insert({ user_id: guard.user.id, user_email: guard.user.email, event_type: "backup_delivery_settings_updated", details: settings })
  return NextResponse.json({ ok: true, settings })
}

