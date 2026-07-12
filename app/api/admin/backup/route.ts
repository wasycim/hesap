import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { backupTables } from "@/lib/backup/tables"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendBackupDownloadedEmail } from "@/lib/email/backup-download-alert"

function isMissingTableError(error: { code?: string; message?: string }) {
  const message = String(error.message || "").toLowerCase()
  return error.code === "PGRST205" || message.includes("could not find the table") || message.includes("does not exist")
}

async function fetchAllRowsWithFilters(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
  selectCols: string,
  filterFn?: (q: any) => any
) {
  const allRows: any[] = []
  const pageSize = 1000
  let from = 0

  while (true) {
    const to = from + pageSize - 1
    let query = admin.from(table).select(selectCols).range(from, to)
    if (filterFn) {
      query = filterFn(query)
    }
    const { data, error } = await query
    if (error) {
      return { error }
    }
    if (!data || data.length === 0) break
    allRows.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: allRows }
}

export async function GET(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const searchParams = request.nextUrl.searchParams
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")

  const admin = createAdminClient()
  const tables: Record<string, unknown[]> = {}
  const skippedTables: string[] = []
  
  const exportedRecordIds = new Set<string>()

  for (const table of backupTables) {
    const selectCols = table === "backup_snapshots"
      ? "id, title, table_counts, created_by, created_at, interval, object_path, size_bytes, checksum_sha256, recipients, encrypted, status, error_message, completed_at"
      : "*"

    const filterFn = (query: any) => {
      if (startDate || endDate) {
        if (table === "records") {
          if (startDate) query = query.gte("record_date", startDate)
          if (endDate) query = query.lte("record_date", endDate)
        } else if ([
          "gelir_kayitlari", "gider_kayitlari", "corbalar", 
          "kargo_cari_kayitlar", "kargo_cari_notlari", "vardiya_planlari", 
          "on_dort_no_hesap_kayitlari"
        ].includes(table)) {
          if (startDate) query = query.gte("tarih", startDate)
          if (endDate) query = query.lte("tarih", endDate)
        } else if (table === "attendance_logs") {
          if (startDate) query = query.gte("work_date", startDate)
          if (endDate) query = query.lte("work_date", endDate)
        } else if (["security_events", "app_notifications", "push_delivery_logs"].includes(table)) {
          if (startDate) query = query.gte("created_at", `${startDate}T00:00:00.000Z`)
          if (endDate) query = query.lte("created_at", `${endDate}T23:59:59.999Z`)
        } else if (table === "kargo_cari_odemeler") {
          if (startDate) query = query.gte("updated_at", `${startDate}T00:00:00.000Z`)
          if (endDate) query = query.lte("updated_at", `${endDate}T23:59:59.999Z`)
        }
      }
      return query
    }

    const { data, error } = await fetchAllRowsWithFilters(admin, table, selectCols, filterFn)
    if (error) {
      if (isMissingTableError(error)) {
        skippedTables.push(table)
        continue
      }
      return NextResponse.json({ error: `${table}: ${error.message}` }, { status: 500 })
    }

    let rows = data || []
    if (startDate || endDate) {
      if (table === "records") {
        rows.forEach((row: any) => {
          if (row.id) exportedRecordIds.add(row.id)
        })
      } else if (["company_amounts", "partner_shares", "record_summary"].includes(table)) {
        rows = rows.filter((row: any) => exportedRecordIds.has(row.record_id))
      }
    }

    tables[table] = rows
  }

  const ipAddress = request.headers.get("x-forwarded-for") || request.ip || "Bilinmiyor"
  const userAgent = request.headers.get("user-agent") || "Bilinmiyor"
  const filterRange = startDate || endDate
    ? `${startDate || "Başlangıç"} ile ${endDate || "Bugün"} arası`
    : "Tüm Zamanlar"

  let emailStatus = "success"
  let emailError: string | null = null

  try {
    await sendBackupDownloadedEmail({
      userEmail: adminGuard.user.email,
      ipAddress,
      userAgent,
      filterRange,
    })
  } catch (err: any) {
    emailStatus = "failed"
    emailError = err.message || String(err)
  }

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "backup_export",
    details: { 
      tables: backupTables, 
      exported_at: new Date().toISOString(), 
      filter: { startDate, endDate },
      ip_address: ipAddress,
      user_agent: userAgent,
      email_delivery: {
        status: emailStatus,
        error: emailError,
        recipient: adminGuard.user.email
      }
    },
  })

  return NextResponse.json({
    version: 2,
    exportedAt: new Date().toISOString(),
    exportedBy: adminGuard.user.email,
    skippedTables,
    tables,
    filter: { startDate, endDate }
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
