import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const snapshotTables = [
  "subeler",
  "user_profiles",
  "personeller",
  "gelir_kayitlari",
  "gider_kayitlari",
  "corbalar",
  "kargo_cari_kayitlar",
  "attendance_logs",
  "vardiya_planlari",
  "app_notifications",
]

export async function GET() {
  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}

  for (const table of snapshotTables) {
    const { data, error, count } = await admin.from(table).select("*", { count: "exact" }).limit(2000)
    if (error) {
      counts[table] = -1
      continue
    }
    tables[table] = data || []
    counts[table] = count || data?.length || 0
  }

  const { error } = await admin.from("backup_snapshots").insert({
    title: `Otomatik gunluk yedek - ${new Date().toISOString().slice(0, 10)}`,
    tables,
    table_counts: counts,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await admin.from("security_events").insert({
    event_type: "daily_backup_created",
    details: { table_counts: counts },
  })

  return NextResponse.json({ ok: true, tableCounts: counts })
}
