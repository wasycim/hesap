import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("terminal_devices")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ devices: data || [] })
}

export async function PATCH(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "").trim()
  const approved = Boolean(body.approved)
  const label = String(body.label || "").trim().slice(0, 80)
  const allowedIps = Array.isArray(body.allowedIps)
    ? body.allowedIps.map((item: unknown) => String(item).trim()).filter(Boolean)
    : String(body.allowedIps || "").split(/[\n,; ]+/).map((item) => item.trim()).filter(Boolean)

  if (!id) {
    return NextResponse.json({ error: "Cihaz seçimi zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { error } = await admin
    .from("terminal_devices")
    .update({
      approved,
      label: label || undefined,
      allowed_ips: allowedIps,
      camera_required: body.cameraRequired !== false,
      approved_by: approved ? adminGuard.user.id : null,
      approved_at: approved ? now : null,
      updated_at: now,
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: approved ? "terminal_device_approved" : "terminal_device_revoked",
    details: { terminal_device_id: id, label, allowed_ips: allowedIps },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "").trim()

  if (!id) {
    return NextResponse.json({ error: "Cihaz seçimi zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from("terminal_devices").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "terminal_device_delete",
    details: { terminal_device_id: id },
  })

  return NextResponse.json({ ok: true })
}
