import crypto from "node:crypto"

export const passwordRecoveryCookieName = "hesap_password_recovery"
const passwordRecoveryMaxAgeSeconds = 10 * 60
const passwordRecoveryPurpose = "password-recovery"

type PasswordRecoveryPayload = {
  exp: number
  purpose: typeof passwordRecoveryPurpose
  sub: string
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function recoverySecret() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET

  if (!secret) {
    throw new Error("Password recovery secret is not configured.")
  }

  return secret
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", recoverySecret()).update(payload).digest("base64url")
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function createPasswordRecoveryToken(userId: string) {
  const payload: PasswordRecoveryPayload = {
    exp: Math.floor(Date.now() / 1000) + passwordRecoveryMaxAgeSeconds,
    purpose: passwordRecoveryPurpose,
    sub: userId,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyPasswordRecoveryToken(token: string | undefined, userId: string) {
  if (!token || !userId) return false

  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) return false

  const expectedSignature = signPayload(encodedPayload)
  if (!safeEqual(signature, expectedSignature)) return false

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as PasswordRecoveryPayload

    return (
      payload.purpose === passwordRecoveryPurpose &&
      payload.sub === userId &&
      Number.isFinite(payload.exp) &&
      payload.exp > Math.floor(Date.now() / 1000)
    )
  } catch {
    return false
  }
}

export function passwordRecoveryCookieOptions(maxAge = passwordRecoveryMaxAgeSeconds) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  }
}
