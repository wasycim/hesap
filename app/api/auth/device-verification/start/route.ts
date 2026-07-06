import { createHmac, randomInt, randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { sendDeviceVerificationEmail } from "@/lib/email/device-verification"
import {
  deviceTrustCookieName,
  deviceTrustCookieOptions,
  issueDeviceTrustToken,
} from "@/lib/security/device-trust"
import { getRequestAuthUser } from "@/lib/mobile-auth"
import { createAdminClient } from "@/lib/supabase/admin"

const codeTtlMs = 10 * 60 * 1000

export async function POST(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const deviceId = String(body.deviceId || "").trim()
  const platform = String(body.platform || "web").trim().slice(0, 30)
  const label = String(body.label || platform || "Bilinmeyen cihaz").trim().slice(0, 140)
  const resend = body.resend === true
  if (!isPhoneMobileVerificationRequest(request, platform)) {
    return NextResponse.json({ error: "Cihaz doğrulaması sadece telefon mobil uygulaması için kullanılır." }, { status: 403 })
  }
  if (!/^[a-zA-Z0-9._:-]{8,200}$/.test(deviceId)) {
    return NextResponse.json({ error: "Cihaz kimliği geçersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: currentDevice, error: currentError } = await admin
    .from("trusted_devices")
    .select("id")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .is("revoked_at", null)
    .maybeSingle()

  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 })
  if (currentDevice) {
    await admin.from("trusted_devices").update({ last_seen_at: new Date().toISOString(), platform, label }).eq("id", currentDevice.id)
    return trustedResponse(user.id, deviceId, { challengeRequired: false, trusted: true })
  }

  const { data: anyTrusted, error: trustedError } = await admin
    .from("trusted_devices")
    .select("id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .limit(1)

  if (trustedError) return NextResponse.json({ error: trustedError.message }, { status: 500 })

  // İlk kayıtlı cihaz doğrulama maili gerektirmez; sonraki her cihaz gerektirir.
  if (!anyTrusted?.length) {
    const { error } = await admin.from("trusted_devices").upsert({
      user_id: user.id,
      device_id: deviceId,
      platform,
      label,
      verified_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,device_id" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await audit(admin, user.id, user.email, "device_first_trusted", { device_id: deviceId, platform })
    return trustedResponse(user.id, deviceId, { challengeRequired: false, trusted: true, firstDevice: true })
  }

  if (!user.email) {
    return NextResponse.json({ error: "Doğrulama kodunun gönderileceği e-posta adresi bulunamadı." }, { status: 409 })
  }

  const now = new Date()
  const { data: activeChallenges } = await admin
    .from("device_verification_challenges")
    .select("id, created_at, expires_at")
    .eq("user_id", user.id)
    .eq("device_id", deviceId)
    .is("consumed_at", null)
    .gt("expires_at", now.toISOString())
    .order("created_at", { ascending: false })
    .limit(1)

  const activeChallenge = activeChallenges?.[0]
  const activeAgeMs = activeChallenge ? now.getTime() - new Date(activeChallenge.created_at).getTime() : Infinity
  if (activeChallenge && (!resend || activeAgeMs < 60_000)) {
    return NextResponse.json({
      challengeRequired: true,
      challengeId: activeChallenge.id,
      maskedEmail: maskEmail(user.email),
      expiresAt: activeChallenge.expires_at,
      resendAfterSeconds: Math.max(0, Math.ceil((60_000 - activeAgeMs) / 1000)),
    })
  }

  if (activeChallenge) {
    await admin.from("device_verification_challenges").update({ consumed_at: now.toISOString() }).eq("id", activeChallenge.id)
  }

  const challengeId = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const expiresAt = new Date(now.getTime() + codeTtlMs).toISOString()
  const { error: insertError } = await admin.from("device_verification_challenges").insert({
    id: challengeId,
    user_id: user.id,
    device_id: deviceId,
    platform,
    label,
    code_hash: hashCode(user.id, deviceId, code),
    expires_at: expiresAt,
    requested_ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
  })
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  try {
    await sendDeviceVerificationEmail({ to: user.email, code, deviceLabel: label })
  } catch (error) {
    await admin.from("device_verification_challenges").delete().eq("id", challengeId)
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Doğrulama e-postası gönderilemedi.",
    }, { status: 503 })
  }

  await audit(admin, user.id, user.email, "device_verification_sent", { device_id: deviceId, platform })
  return NextResponse.json({
    challengeRequired: true,
    challengeId,
    maskedEmail: maskEmail(user.email),
    expiresAt,
    resendAfterSeconds: 60,
  })
}

function verificationSecret() {
  return process.env.DEVICE_TRUST_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
}

function hashCode(userId: string, deviceId: string, code: string) {
  const secret = verificationSecret()
  if (!secret) throw new Error("Cihaz doğrulama anahtarı yapılandırılmamış.")
  return createHmac("sha256", secret).update(`${userId}:${deviceId}:${code}`).digest("hex")
}

async function trustedResponse(userId: string, deviceId: string, body: Record<string, unknown>) {
  const response = NextResponse.json(body)
  response.cookies.set(deviceTrustCookieName, await issueDeviceTrustToken(userId, deviceId), deviceTrustCookieOptions())
  return response
}

function isPhoneMobileVerificationRequest(request: NextRequest, platform: string) {
  const nativePlatform = request.cookies.get("hesap-native-platform")?.value
  return ["ios", "android", "ios-web", "android-web"].includes(platform) || nativePlatform === "ios" || nativePlatform === "android"
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@")
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`
}

async function audit(admin: ReturnType<typeof createAdminClient>, userId: string, email: string | undefined, eventType: string, details: Record<string, unknown>) {
  await admin.from("security_events").insert({ user_id: userId, user_email: email || null, event_type: eventType, details })
}
