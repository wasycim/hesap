import { NextRequest, NextResponse } from "next/server"
import { requireDashboardDeveloper } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const guard = await requireDashboardDeveloper()
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const { data: licenses, error } = await admin
    .from("device_licenses")
    .select("id, user_id, device_id, platform, label, active, revoked_at, last_ip, user_agent, last_seen_at, created_at, user_profiles:user_id(email, display_name, tc_kimlik)")
    .order("last_seen_at", { ascending: false })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ licenses: licenses || [] })
}

export async function PATCH(request: NextRequest) {
  const guard = await requireDashboardDeveloper()
  if (!guard.ok) return guard.response

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "").trim()
  const active = Boolean(body.active)
  if (!id) return NextResponse.json({ error: "Cihaz lisans id zorunlu." }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("device_licenses")
    .update({
      active,
      revoked_by: active ? null : guard.user.id,
      revoked_at: active ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: guard.user.id,
    user_email: guard.profile?.email || guard.user.email,
    event_type: active ? "device_license_restored" : "device_license_revoked",
    details: { id, user_id: data.user_id, platform: data.platform, device_id: data.device_id },
  })

  return NextResponse.json({ ok: true, license: data })
}
