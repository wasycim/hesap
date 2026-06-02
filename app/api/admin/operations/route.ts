import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin, requireDashboardDeveloper } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const adminTables = new Set([
  "notification_rule_definitions",
  "overtime_approvals",
  "pdf_templates",
  "pdf_archives",
  "app_announcements",
  "holidays",
  "offline_conflicts",
])

const developerTables = new Set([
  "app_settings",
  "dashboard_permission_overrides",
  "system_health_alerts",
  "error_reports",
  "app_store_metadata",
  "backup_snapshots",
])

function tableFromUrl(request: NextRequest) {
  return request.nextUrl.searchParams.get("table") || ""
}

function sanitizePayload(table: string, body: any, userId: string) {
  const now = new Date().toISOString()
  if (table === "notification_rule_definitions") {
    return {
      name: String(body.name || "Kural").trim().slice(0, 120),
      sube_id: body.sube_id || null,
      user_id: body.user_id || null,
      vardiya_code: body.vardiya_code || null,
      event_type: String(body.event_type || "attendance").trim().slice(0, 60),
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      level: ["info", "success", "warning", "error"].includes(body.level) ? body.level : "warning",
      message_template: String(body.message_template || "").trim().slice(0, 1000),
      active: body.active !== false,
      created_by: userId,
      updated_at: now,
    }
  }
  if (table === "overtime_approvals") {
    const rawMinutes = Math.max(0, Math.round(Number(body.raw_minutes) || 0))
    const payableMinutes = Math.max(0, Math.round(Number(body.payable_minutes) || Number(body.manual_minutes) || rawMinutes || 0))
    const manualMinutes = Math.max(0, Math.round(Number(body.manual_minutes) || 0))
    const status = ["pending", "approved", "rejected"].includes(body.status) ? body.status : "pending"
    return {
      attendance_log_id: body.attendance_log_id ? Number(body.attendance_log_id) : null,
      personel_id: body.personel_id || null,
      source_key: body.source_key ? String(body.source_key).trim().slice(0, 180) : null,
      user_profile_id: body.user_profile_id || null,
      personel_name: String(body.personel_name || "").trim().slice(0, 160),
      branch_name: String(body.branch_name || "").trim().slice(0, 120),
      work_date: body.work_date || null,
      raw_minutes: rawMinutes,
      payable_minutes: payableMinutes,
      manual_minutes: manualMinutes,
      hourly_rate: body.hourly_rate ? Number(body.hourly_rate) : null,
      amount: body.amount ? Number(body.amount) : null,
      status,
      requested_by: userId,
      approved_by: status === "approved" ? userId : null,
      approved_at: status === "approved" ? now : null,
      note: String(body.note || body.manual_reason || "").trim().slice(0, 1000),
      updated_at: now,
    }
  }
  if (table === "pdf_templates") {
    return {
      name: String(body.name || "PDF Sablonu").trim().slice(0, 120),
      report_type: String(body.report_type || "general").trim().slice(0, 80),
      orientation: body.orientation === "portrait" ? "portrait" : "landscape",
      template_json: body.template_json && typeof body.template_json === "object" ? body.template_json : {},
      active: body.active !== false,
      created_by: userId,
      updated_at: now,
    }
  }
  if (table === "pdf_archives") {
    return {
      report_type: String(body.report_type || "general").trim().slice(0, 80),
      title: String(body.title || "PDF Rapor").trim().slice(0, 180),
      period_label: String(body.period_label || "").trim().slice(0, 180),
      file_name: String(body.file_name || "").trim().slice(0, 180),
      html_snapshot: String(body.html_snapshot || "").slice(0, 200000),
      created_by: userId,
    }
  }
  if (table === "dashboard_permission_overrides") {
    const scopeType = body.scope_type === "user" ? "user" : "role"
    return {
      scope_type: scopeType,
      role_key: scopeType === "role" && ["developer", "admin", "user"].includes(body.role_key) ? body.role_key : null,
      user_id: scopeType === "user" ? body.user_id || null : null,
      permission_key: String(body.permission_key || "").trim().slice(0, 100),
      allowed: body.allowed !== false,
      note: String(body.note || "").trim().slice(0, 500),
      active: body.active !== false,
      created_by: userId,
      updated_at: now,
    }
  }
  if (table === "app_announcements") {
    return {
      title: String(body.title || "Duyuru").trim().slice(0, 160),
      body: String(body.body || "").trim().slice(0, 1600),
      level: ["info", "success", "warning", "error"].includes(body.level) ? body.level : "info",
      target_type: ["all", "branch", "user"].includes(body.target_type) ? body.target_type : "all",
      sube_id: body.sube_id || null,
      user_id: body.user_id || null,
      active: body.active !== false,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      created_by: userId,
      updated_at: now,
    }
  }
  if (table === "holidays") {
    return {
      holiday_date: body.holiday_date,
      name: String(body.name || "").trim().slice(0, 160),
      type: String(body.type || "official").trim().slice(0, 60),
      active: body.active !== false,
      created_by: userId,
    }
  }
  if (table === "app_store_metadata") {
    return {
      platform: String(body.platform || "android").trim().slice(0, 40),
      title: String(body.title || "Hesap").trim().slice(0, 120),
      subtitle: String(body.subtitle || "").trim().slice(0, 160),
      description: String(body.description || "").trim().slice(0, 4000),
      keywords: String(body.keywords || "").trim().slice(0, 500),
      screenshot_url: String(body.screenshot_url || "/store-screenshots").trim().slice(0, 240),
      updated_by: userId,
      updated_at: now,
    }
  }
  return body
}

async function authorize(table: string) {
  if (developerTables.has(table)) return requireDashboardDeveloper()
  if (adminTables.has(table)) return requireDashboardAdmin()
  return {
    ok: false as const,
    response: NextResponse.json({ error: "Gecersiz operasyon tablosu." }, { status: 400 }),
  }
}

export async function GET(request: NextRequest) {
  const table = tableFromUrl(request)
  const guard = await authorize(table)
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  let query = admin.from(table).select("*")

  if (table === "overtime_approvals") query = query.order("created_at", { ascending: false }).limit(300)
  else if (table === "offline_conflicts") query = query.order("created_at", { ascending: false }).limit(300)
  else if (table === "error_reports") query = query.order("created_at", { ascending: false }).limit(200)
  else if (table === "dashboard_permission_overrides") query = query.order("created_at", { ascending: false }).limit(500)
  else if (table === "app_settings") query = query.order("key", { ascending: true })
  else query = query.order("created_at", { ascending: false }).limit(300)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request: NextRequest) {
  const table = tableFromUrl(request)
  const guard = await authorize(table)
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const payload = sanitizePayload(table, body, guard.user.id)
  const admin = createAdminClient()

  if (table === "dashboard_permission_overrides") {
    let existingQuery = admin
      .from(table)
      .select("id")
      .eq("scope_type", payload.scope_type)
      .eq("permission_key", payload.permission_key)
      .eq("active", true)

    if (payload.scope_type === "role") existingQuery = existingQuery.eq("role_key", payload.role_key)
    if (payload.scope_type === "user") existingQuery = existingQuery.eq("user_id", payload.user_id)

    const { data: existing, error: existingError } = await existingQuery.maybeSingle()
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })
    if (existing?.id) {
      const { data, error } = await admin.from(table).update(payload).eq("id", existing.id).select("*").single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      await admin.from("security_events").insert({
        user_id: guard.user.id,
        user_email: guard.profile?.email || guard.user.email,
        event_type: `${table}_update`,
        details: { id: data.id },
      })

      return NextResponse.json({ ok: true, item: data })
    }
  }

  const { data, error } = await admin.from(table).insert(payload).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: `${table}_create`,
    details: { id: data.id || data.key },
  })

  return NextResponse.json({ ok: true, item: data })
}

export async function PATCH(request: NextRequest) {
  const table = tableFromUrl(request)
  const guard = await authorize(table)
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || body.key || "").trim()
  if (!id) return NextResponse.json({ error: "Kayit id/key zorunlu." }, { status: 400 })

  const admin = createAdminClient()
  let payload: any
  if (table === "app_settings") {
    payload = { value: body.value && typeof body.value === "object" ? body.value : {}, updated_by: guard.user.id, updated_at: new Date().toISOString() }
  } else if (table === "overtime_approvals") {
    const status = ["pending", "approved", "rejected"].includes(body.status) ? body.status : "pending"
    const nextPayableMinutes = body.payable_minutes === undefined
      ? undefined
      : Math.max(0, Math.round(Number(body.payable_minutes) || 0))
    payload = {
      status,
      note: String(body.note || "").slice(0, 1000),
      approved_by: status === "pending" ? null : guard.user.id,
      approved_at: status === "pending" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(nextPayableMinutes === undefined ? {} : { payable_minutes: nextPayableMinutes }),
    }
  } else if (table === "offline_conflicts") {
    payload = { status: String(body.status || "resolved"), resolved_by: guard.user.id, resolved_at: new Date().toISOString() }
  } else {
    payload = sanitizePayload(table, body, guard.user.id)
  }

  const keyColumn = table === "app_settings" ? "key" : "id"
  const { data, error } = await admin.from(table).update(payload).eq(keyColumn, id).select("*").single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: `${table}_update`,
    details: { id },
  })

  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(request: NextRequest) {
  const table = tableFromUrl(request)
  const guard = await authorize(table)
  if (!guard.ok) return guard.response

  const id = String(request.nextUrl.searchParams.get("id") || "").trim()
  if (!id) return NextResponse.json({ error: "Kayit id zorunlu." }, { status: 400 })
  if (table === "app_settings") return NextResponse.json({ error: "Sistem ayari silinemez." }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from(table).delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: `${table}_delete`,
    details: { id },
  })

  return NextResponse.json({ ok: true })
}
