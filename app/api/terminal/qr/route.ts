import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { createTerminalQrPayload } from "@/lib/qr-attendance/qr"
import { createAdminClient } from "@/lib/supabase/admin"
import { getClientIp, getUserAgent } from "@/lib/system/client-info"

function normalizeDeviceKey(value: string | null) {
  const text = String(value || "").trim()
  return /^[a-zA-Z0-9._:-]{16,160}$/.test(text) ? text : null
}

export async function GET(request: NextRequest) {
  const deviceKey = normalizeDeviceKey(request.headers.get("x-terminal-device-key"))

  if (!deviceKey) {
    return NextResponse.json(
      { error: "Terminal cihazı eşleştirilmemiş.", code: "TERMINAL_DEVICE_REQUIRED" },
      { status: 403 },
    )
  }

  const admin = createAdminClient()
  const { data: device, error } = await admin
    .from("terminal_devices")
    .select("id, approved, allowed_ips")
    .eq("device_key", deviceKey)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!device?.approved) {
    const now = new Date().toISOString()
    await admin
      .from("terminal_devices")
      .upsert(
        {
          device_key: deviceKey,
          label: "Terminal",
          last_seen_at: now,
          last_ip: getClientIp(request),
          user_agent: getUserAgent(request),
          updated_at: now,
        },
        { onConflict: "device_key" },
      )

    return NextResponse.json(
      { error: "Bu terminal cihazı henüz yönetici tarafından onaylanmadı.", code: "TERMINAL_DEVICE_PENDING" },
      { status: 403 },
    )
  }

  const clientIp = getClientIp(request)
  const allowedIps = Array.isArray(device.allowed_ips) ? device.allowed_ips.filter(Boolean) : []
  if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
    await admin.from("security_events").insert({
      event_type: "terminal_ip_blocked",
      details: { terminal_id: device.id, device_key: deviceKey, client_ip: clientIp, allowed_ips: allowedIps },
    })
    return NextResponse.json(
      { error: "Bu terminal IP adresi yetkili degil.", code: "TERMINAL_IP_BLOCKED" },
      { status: 403 },
    )
  }

  await admin
    .from("terminal_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      last_ip: clientIp,
      user_agent: getUserAgent(request),
      updated_at: new Date().toISOString(),
    })
    .eq("id", device.id)

  const terminalQr = createTerminalQrPayload()

  return NextResponse.json({
    qr: terminalQr.qr,
    expiresAt: terminalQr.expiresAt,
    ttlSeconds: terminalQr.ttlSeconds,
  })
}
