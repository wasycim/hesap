const cookieName = "hesap-device-trust"

export { cookieName as deviceTrustCookieName }

type DeviceTrustPayload = {
  userId: string
  deviceId: string
  expiresAt: number
}

function secret() {
  const value = process.env.DEVICE_TRUST_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SECRET_KEY
  if (!value) throw new Error("Cihaz doğrulama anahtarı yapılandırılmamış.")
  return value
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")
  const binary = atob(normalized)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function signature(value: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))))
}

export async function issueDeviceTrustToken(userId: string, deviceId: string) {
  const payload: DeviceTrustPayload = {
    userId,
    deviceId,
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
  }
  const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  return `${encoded}.${await signature(encoded)}`
}

export async function verifyDeviceTrustToken(token: string | undefined, userId: string) {
  if (!token) return null
  const [encoded, receivedSignature, extra] = token.split(".")
  if (!encoded || !receivedSignature || extra) return null
  const expectedSignature = await signature(encoded).catch(() => "")
  if (!expectedSignature || expectedSignature.length !== receivedSignature.length) return null

  let mismatch = 0
  for (let index = 0; index < expectedSignature.length; index += 1) {
    mismatch |= expectedSignature.charCodeAt(index) ^ receivedSignature.charCodeAt(index)
  }
  if (mismatch !== 0) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encoded))) as DeviceTrustPayload
    if (payload.userId !== userId || payload.expiresAt <= Date.now() || !payload.deviceId) return null
    return payload
  } catch {
    return null
  }
}

export function deviceTrustCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  }
}

