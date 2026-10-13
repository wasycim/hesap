import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getClientIp, getUserAgent } from "@/lib/system/client-info"

function normalizeDeviceKey(value: unknown) {
  const text = String(value || "").trim()
  return /^[a-zA-Z0-9._:-]{16,160}$/.test(text) ? text : null
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const deviceKey = normalizeDeviceKey(body.deviceKey)
  const label = String(body.label || "Terminal").trim().slice(0, 80) || "Terminal"

  if (!deviceKey) {
    return NextResponse.json({ error: "Terminal cihaz kimliği geçersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from("terminal_devices")
    .upsert(
      {
        device_key: deviceKey,
        label,
        last_seen_at: now,
        last_ip: getClientIp(request),
        user_agent: getUserAgent(request),
        updated_at: now,
      },
      { onConflict: "device_key" },
    )
    .select("id, label, approved, last_seen_at, created_at")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ device: data })
}
