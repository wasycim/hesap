import { createHmac, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import {
  deviceTrustCookieName,
  deviceTrustCookieOptions,
  issueDeviceTrustToken,
} from "@/lib/security/device-trust"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const challengeId = String(body.challengeId || "").trim()
  const deviceId = String(body.deviceId || "").trim()
  const code = String(body.code || "").replace(/\D/g, "")
  if (!challengeId || !deviceId || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "6 haneli doğrulama kodunu eksiksiz girin." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: challenge, error } = await admin
    .from("device_verification_challenges")
    .select("id, device_id, platform, label, code_hash, expires_at, attempt_count, consumed_at")
    .eq("id", challengeId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!challenge || challenge.device_id !== deviceId || challenge.consumed_at) {
    return NextResponse.json({ error: "Doğrulama isteği geçersiz veya kullanılmış." }, { status: 400 })
  }
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Kodun süresi doldu. Yeni kod isteyin." }, { status: 410 })
  }
  if (Number(challenge.attempt_count || 0) >= 5) {
    return NextResponse.json({ error: "Deneme sınırı aşıldı. Yeni kod isteyin." }, { status: 429 })
  }

  const expected = Buffer.from(challenge.code_hash, "hex")
  const received = Buffer.from(hashCode(user.id, deviceId, code), "hex")
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    await admin.from("device_verification_challenges").update({ attempt_count: Number(challenge.attempt_count || 0) + 1 }).eq("id", challenge.id)
    return NextResponse.json({ error: "Doğrulama kodu hatalı." }, { status: 400 })
  }

  const verifiedAt = new Date().toISOString()
  const { error: trustError } = await admin.from("trusted_devices").upsert({
    user_id: user.id,
    device_id: deviceId,
    platform: challenge.platform || "web",
    label: challenge.label,
    verified_at: verifiedAt,
    last_seen_at: verifiedAt,
    revoked_at: null,
  }, { onConflict: "user_id,device_id" })
  if (trustError) return NextResponse.json({ error: trustError.message }, { status: 500 })

  await admin.from("device_verification_challenges").update({ consumed_at: verifiedAt }).eq("id", challenge.id)
  await admin.from("security_events").insert({
    user_id: user.id,
    user_email: user.email || null,
    event_type: "device_verified",
    details: { device_id: deviceId, platform: challenge.platform },
  })

  const response = NextResponse.json({ ok: true })
  response.cookies.set(deviceTrustCookieName, await issueDeviceTrustToken(user.id, deviceId), deviceTrustCookieOptions())
  return response
}

function hashCode(userId: string, deviceId: string, code: string) {
  const secret = process.env.DEVICE_TRUST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error("Cihaz doğrulama anahtarı yapılandırılmamış.")
  return createHmac("sha256", secret).update(`${userId}:${deviceId}:${code}`).digest("hex")
}

