import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

const defaultRule = {
  active: true,
  late_enabled: true,
  late_threshold_minutes: 1,
  overtime_enabled: true,
  overtime_threshold_minutes: 45,
  send_to_personnel: true,
  send_to_admins: false,
}

function minutes(value: unknown, fallback: number) {
  const next = Number(value)
  if (!Number.isFinite(next)) return fallback
  return Math.max(0, Math.min(24 * 60, Math.round(next)))
}

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const [branchesRes, rulesRes] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("aktif", true).order("ad", { ascending: true }),
    admin.from("attendance_alert_rules").select("*"),
  ])

  if (branchesRes.error) return NextResponse.json({ error: branchesRes.error.message }, { status: 500 })
  if (rulesRes.error) return NextResponse.json({ error: rulesRes.error.message }, { status: 500 })

  const ruleByBranch = new Map((rulesRes.data || []).map((rule: any) => [String(rule.sube_id), rule]))
  return NextResponse.json({
    rules: (branchesRes.data || []).map((branch: any) => ({
      ...defaultRule,
      ...(ruleByBranch.get(String(branch.id)) || {}),
      sube_id: branch.id,
      sube_ad: branch.ad,
      sube_kod: branch.kod,
    })),
  })
}

export async function PATCH(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const subeId = String(body.subeId || "").trim()
  if (!subeId) return NextResponse.json({ error: "Sube zorunlu." }, { status: 400 })

  const payload = {
    sube_id: subeId,
    active: Boolean(body.active),
    late_enabled: Boolean(body.lateEnabled),
    late_threshold_minutes: minutes(body.lateThresholdMinutes, defaultRule.late_threshold_minutes),
    overtime_enabled: Boolean(body.overtimeEnabled),
    overtime_threshold_minutes: minutes(body.overtimeThresholdMinutes, defaultRule.overtime_threshold_minutes),
    send_to_personnel: Boolean(body.sendToPersonnel),
    send_to_admins: Boolean(body.sendToAdmins),
    updated_by: adminGuard.user.id,
    updated_at: new Date().toISOString(),
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("attendance_alert_rules")
    .upsert(payload, { onConflict: "sube_id" })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.profile?.email || adminGuard.user.email || null,
    event_type: "attendance_rule_update",
    details: payload,
  })

  return NextResponse.json({ ok: true, rule: data })
}
