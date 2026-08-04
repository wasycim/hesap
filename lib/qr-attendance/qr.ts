import crypto from "crypto"
import jwt from "jsonwebtoken"
import type { User } from "@prisma/client"
import { jwtSecret } from "@/lib/qr-attendance/auth"
import { publicAppOrigin } from "@/lib/public-app-url"

export type QrPayload = {
  userId: number
  token: string
}

export type TerminalQrPayload = {
  terminalId: string
  token: string
}

type DynamicQrClaims = {
  sub: string
  typ: "attendance-qr"
  nonce: string
  tokenHash: string
}

const qrIssuer = "hesap-mesai"
const qrAudience = "hesap-mesai-terminal"
export const dynamicQrTtlSeconds = 25
export const terminalQrTtlSeconds = 30

export function createQrToken() {
  return crypto.randomBytes(32).toString("base64url")
}

export function parseQrPayload(value: unknown): QrPayload | null {
  if (typeof value !== "string") return null

  try {
    const payload = JSON.parse(value) as Partial<QrPayload>
    const userId = payload.userId
    const token = payload.token

    if (!Number.isInteger(userId) || typeof token !== "string") {
      return null
    }

    if (token.length < 32 || token.length > 2048) {
      return null
    }

    return {
      userId: userId as number,
      token,
    }
  } catch {
    return null
  }
}

export function parseTerminalQrPayload(value: unknown): TerminalQrPayload | null {
  if (typeof value !== "string" || !value.trim()) return null
  const str = value.trim()

  // 1. Check if URL or Deep Link
  const fromUrl = parseTerminalQrUrl(str)
  if (fromUrl) return fromUrl

  // 2. Check if raw JWT token string (e.g. "eyJhbGciOiJIUzI1Ni...")
  if (!str.startsWith("{") && str.length >= 32 && str.length <= 2048) {
    return {
      terminalId: "fixed-terminal",
      token: str,
    }
  }

  // 3. Check if JSON payload string (e.g. '{"terminalId":"fixed-terminal","token":"..."}')
  try {
    const payload = JSON.parse(str) as Partial<TerminalQrPayload>
    if (payload.token && typeof payload.token === "string" && payload.token.length >= 32 && payload.token.length <= 2048) {
      return {
        terminalId: payload.terminalId || "fixed-terminal",
        token: payload.token,
      }
    }
  } catch {
    // fallback
  }

  return null
}

function parseTerminalQrUrl(value: string): TerminalQrPayload | null {
  try {
    let cleanUrl = value
    if (cleanUrl.startsWith("hesapgo://")) {
      cleanUrl = cleanUrl.replace("hesapgo://", "https://app/")
    }

    const url = new URL(cleanUrl)
    const token = url.searchParams.get("t") || url.searchParams.get("token") || url.searchParams.get("qr")
    if (!token) return null
    if (token.length < 32 || token.length > 2048) return null
    return {
      terminalId: "fixed-terminal",
      token,
    }
  } catch {
    return null
  }
}

function qrTokenHash(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url")
}

export function createDynamicQrPayload(user: Pick<User, "id" | "qrToken">) {
  const expiresAt = new Date(Date.now() + dynamicQrTtlSeconds * 1000)
  const token = jwt.sign(
    {
      typ: "attendance-qr",
      nonce: crypto.randomBytes(16).toString("base64url"),
      tokenHash: qrTokenHash(user.qrToken),
    } satisfies Omit<DynamicQrClaims, "sub">,
    jwtSecret(),
    {
      subject: String(user.id),
      expiresIn: dynamicQrTtlSeconds,
      issuer: qrIssuer,
      audience: qrAudience,
    },
  )

  return {
    userId: user.id,
    token,
    expiresAt,
    ttlSeconds: dynamicQrTtlSeconds,
    qr: JSON.stringify({ userId: user.id, token }),
  }
}

export function createTerminalQrPayload(origin = publicAppOrigin()) {
  const expiresAt = new Date(Date.now() + terminalQrTtlSeconds * 1000)
  const token = jwt.sign(
    {
      typ: "terminal-attendance-qr",
      nonce: crypto.randomBytes(16).toString("base64url"),
    },
    jwtSecret(),
    {
      subject: "fixed-terminal",
      expiresIn: terminalQrTtlSeconds,
      issuer: qrIssuer,
      audience: "hesap-mesai-personnel",
    },
  )
  const scanUrl = `${origin.replace(/\/+$/, "")}/mesai-qr/okut?t=${encodeURIComponent(token)}`

  return {
    terminalId: "fixed-terminal",
    token,
    expiresAt,
    ttlSeconds: terminalQrTtlSeconds,
    qr: scanUrl,
    payload: JSON.stringify({ terminalId: "fixed-terminal", token }),
    scanUrl,
  }
}

export function verifyTerminalQrPayload(payload: TerminalQrPayload) {
  try {
    const claims = jwt.verify(payload.token, jwtSecret(), {
      subject: "fixed-terminal",
      issuer: qrIssuer,
      audience: "hesap-mesai-personnel",
    }) as { typ?: string }

    return payload.terminalId === "fixed-terminal" && claims.typ === "terminal-attendance-qr"
  } catch {
    return false
  }
}

export function verifyTerminalQrPayloadAt(payload: TerminalQrPayload, scannedAt: Date) {
  try {
    const claims = jwt.verify(payload.token, jwtSecret(), {
      subject: "fixed-terminal",
      issuer: qrIssuer,
      audience: "hesap-mesai-personnel",
      ignoreExpiration: true,
    }) as { typ?: string; exp?: number; iat?: number }

    if (payload.terminalId !== "fixed-terminal" || claims.typ !== "terminal-attendance-qr") {
      return false
    }

    if (!claims.exp || !claims.iat) return false

    const scannedAtMs = scannedAt.getTime()
    const issuedAtMs = claims.iat * 1000
    const expiresAtMs = claims.exp * 1000
    const scanGraceMs = 30_000
    const replayWindowMs = 14 * 24 * 60 * 60 * 1000
    const nowMs = Date.now()

    return (
      scannedAtMs >= issuedAtMs - 5_000 &&
      scannedAtMs <= expiresAtMs + scanGraceMs &&
      scannedAtMs <= nowMs + 5 * 60 * 1000 &&
      scannedAtMs >= nowMs - replayWindowMs
    )
  } catch {
    return false
  }
}

export function verifyDynamicQrPayload(payload: QrPayload, user: Pick<User, "id" | "qrToken">) {
  try {
    const claims = jwt.verify(payload.token, jwtSecret(), {
      subject: String(payload.userId),
      issuer: qrIssuer,
      audience: qrAudience,
    }) as DynamicQrClaims

    if (payload.userId !== user.id || claims.typ !== "attendance-qr") {
      return false
    }

    return safeTokenEquals(claims.tokenHash, qrTokenHash(user.qrToken))
  } catch {
    return false
  }
}

export function safeTokenEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}
