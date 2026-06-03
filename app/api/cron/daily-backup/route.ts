import { NextRequest, NextResponse } from "next/server"
import { appSnapshotTables } from "@/lib/backup/tables"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = request.nextUrl.searchParams.get("secret")
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 401 })
  }

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}
  const counts: Record<string, number> = {}
  const skippedTables: string[] = []

  for (const table of appSnapshotTables) {
    const { data, error, count } = await admin.from(table).select("*", { count: "exact" }).limit(10000)
    if (error) {
      counts[table] = -1
      skippedTables.push(table)
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
    details: { table_counts: counts, skipped_tables: skippedTables },
  })

  return NextResponse.json({ ok: true, tableCounts: counts, skippedTables })
}
