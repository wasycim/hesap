import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getClientIp, getUserAgent } from "@/lib/system/client-info"

function normalizeDeviceId(value: unknown) {
  const text = String(value || "").trim()
  return /^[a-zA-Z0-9._:-]{8,180}$/.test(text) ? text : null
}

function normalizePlatform(value: unknown) {
  const platform = String(value || "web").toLowerCase().trim()
  return ["web", "desktop", "ios", "android"].includes(platform) ? platform : "web"
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const deviceId = normalizeDeviceId(body.deviceId)
  const platform = normalizePlatform(body.platform)
  const label = String(body.label || platform).trim().slice(0, 120)

  if (!deviceId) {
    return NextResponse.json({ error: "Cihaz kimligi gecersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("license_exempt, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  const now = new Date().toISOString()
  const { data: license, error } = await admin
    .from("device_licenses")
    .upsert({
      user_id: user.id,
      device_id: deviceId,
      platform,
      label,
      last_ip: getClientIp(request),
      user_agent: getUserAgent(request),
      last_seen_at: now,
      updated_at: now,
    }, { onConflict: "user_id,device_id,platform" })
    .select("id, active, revoked_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allowed = Boolean(profile?.license_exempt || profile?.is_developer || license?.active)
  if (!allowed) {
    await admin.from("security_events").insert({
      user_id: user.id,
      user_email: user.email,
      event_type: "device_license_blocked",
      details: { device_id: deviceId, platform },
    })
    return NextResponse.json({ error: "Bu cihaz lisansi iptal edilmis.", blocked: true }, { status: 403 })
  }

  return NextResponse.json({ ok: true, device: license, licenseExempt: Boolean(profile?.license_exempt || profile?.is_developer) })
}
