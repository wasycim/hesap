import { NextRequest } from "next/server"

export function getClientIp(request: NextRequest) {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")
  if (vercelForwarded) return vercelForwarded.split(",")[0]?.trim() || null
  const cfConnecting = request.headers.get("cf-connecting-ip")
  if (cfConnecting) return cfConnecting
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || null
  return request.headers.get("x-real-ip") || request.headers.get("x-client-ip")
}

export function getUserAgent(request: NextRequest) {
  return request.headers.get("user-agent") || null
}
