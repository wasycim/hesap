import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { hashPushToken } from "@/lib/notifications/push"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const deviceId = String(body.deviceId || "").trim().slice(0, 160)
  const platform = String(body.platform || "web").trim().slice(0, 32) || "web"
  const pushToken = String(body.pushToken || "").trim() || null

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("user_devices")
    .upsert(
      {
        user_id: user.id,
        device_id: deviceId || null,
        platform,
        push_token: pushToken,
        enabled: true,
        last_seen_at: now,
        updated_at: now,
      },
      { onConflict: "user_id,device_id,platform" },
    )
    .select("id, platform, last_seen_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: user.id,
    user_email: user.email || null,
    event_type: "mobile_device_registered",
    details: {
      device_id: deviceId || null,
      platform,
      has_push_token: Boolean(pushToken),
      push_token_hash: pushToken ? hashPushToken(pushToken) : null,
    },
  })

  return NextResponse.json({ ok: true, device: data, pushTokenSaved: Boolean(pushToken) })
}
