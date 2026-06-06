import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const settingsKey = "mail_operations"

const defaultSettings = {
  dailyEnabled: true,
  dailyTime: "08:30",
  weeklyEnabled: true,
  weeklyDay: "monday",
  weeklyTime: "09:00",
  attachPdf: true,
  attachHtml: true,
  detailLevel: "detailed",
  reportTypes: ["attendance", "salary", "system"],
  targetRoles: ["admin", "developer"],
}

export async function GET() {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const [{ data: profiles, error: profileError }, { data: subscribers, error: subscriberError }, { data: settingsRow, error: settingsError }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("user_id, email, display_name, is_admin, is_developer, dashboard_access")
      .neq("dashboard_access", false)
      .order("display_name", { ascending: true }),
    admin.from("admin_digest_subscribers").select("*"),
    admin.from("app_settings").select("value").eq("key", settingsKey).maybeSingle(),
  ])

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (subscriberError) return NextResponse.json({ error: subscriberError.message }, { status: 500 })
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  const subscriberById = new Map((subscribers || []).map((item: any) => [item.user_id, item]))
  const users = (profiles || []).map((profile: any) => {
    const subscriber = subscriberById.get(profile.user_id)
    return {
      ...profile,
      role: profile.is_developer ? "developer" : profile.is_admin ? "admin" : "user",
      digest_email: subscriber?.email || profile.email || "",
      daily_enabled: Boolean(subscriber?.daily_enabled),
      weekly_enabled: Boolean(subscriber?.weekly_enabled),
    }
  })

  return NextResponse.json({
    settings: { ...defaultSettings, ...(settingsRow?.value || {}) },
    users,
  })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireDashboardAdmin()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const admin = createAdminClient()

  if (body.kind === "subscriber") {
    const userId = String(body.userId || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    if (!userId || !email) {
      return NextResponse.json({ error: "Hesap ve e-posta zorunlu." }, { status: 400 })
    }

    const { error } = await admin.from("admin_digest_subscribers").upsert(
      {
        user_id: userId,
        email,
        daily_enabled: Boolean(body.dailyEnabled),
        weekly_enabled: Boolean(body.weeklyEnabled),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await admin.from("security_events").insert({
      user_id: guard.user.id,
      user_email: guard.profile?.email || guard.user.email,
      event_type: "mail_subscriber_update",
      details: { target_user_id: userId, email, daily_enabled: Boolean(body.dailyEnabled), weekly_enabled: Boolean(body.weeklyEnabled) },
    })

    return NextResponse.json({ ok: true })
  }

  const settings = sanitizeSettings(body.settings || body)
  const { data, error } = await admin
    .from("app_settings")
    .upsert({
      key: settingsKey,
      value: settings,
      updated_by: guard.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: "mail_operations_update",
    details: settings,
  })

  return NextResponse.json({ ok: true, settings: data.value })
}

function sanitizeSettings(input: any) {
  const reportTypes = Array.isArray(input.reportTypes)
    ? input.reportTypes.filter((item: unknown) => ["attendance", "salary", "system", "finance"].includes(String(item))).slice(0, 8)
    : defaultSettings.reportTypes
  const targetRoles = Array.isArray(input.targetRoles)
    ? input.targetRoles.filter((item: unknown) => ["user", "admin", "developer"].includes(String(item))).slice(0, 3)
    : defaultSettings.targetRoles

  return {
    dailyEnabled: input.dailyEnabled !== false,
    dailyTime: /^\d{2}:\d{2}$/.test(String(input.dailyTime || "")) ? String(input.dailyTime) : defaultSettings.dailyTime,
    weeklyEnabled: input.weeklyEnabled !== false,
    weeklyDay: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].includes(String(input.weeklyDay))
      ? String(input.weeklyDay)
      : defaultSettings.weeklyDay,
    weeklyTime: /^\d{2}:\d{2}$/.test(String(input.weeklyTime || "")) ? String(input.weeklyTime) : defaultSettings.weeklyTime,
    attachPdf: input.attachPdf !== false,
    attachHtml: input.attachHtml !== false,
    detailLevel: ["summary", "detailed"].includes(String(input.detailLevel)) ? String(input.detailLevel) : defaultSettings.detailLevel,
    reportTypes: reportTypes.length ? reportTypes : defaultSettings.reportTypes,
    targetRoles: targetRoles.length ? targetRoles : defaultSettings.targetRoles,
  }
}
