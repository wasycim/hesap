import "server-only"

import bcrypt from "bcryptjs"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Role, User } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const authCookieName = "mesai_auth"

type AuthPayload = {
  sub: string
  role: Role
  name: string
  tcKimlik: string
}

export type AuthSession = {
  id: number
  role: Role
  name: string
  tcKimlik: string
}

export function jwtSecret() {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length >= 32) {
    return secret
  }

  const fallbackSecret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY

  if (fallbackSecret) {
    return crypto.createHash("sha256").update(fallbackSecret).digest("hex")
  }

  throw new Error("JWT_SECRET veya server-side fallback secret tanimli olmali.")
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export function signAuthToken(user: Pick<User, "id" | "role" | "name" | "tcKimlik">) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
      name: user.name,
      tcKimlik: user.tcKimlik,
    } satisfies AuthPayload,
    jwtSecret(),
    {
      expiresIn: "12h",
      issuer: "hesap-mesai",
      audience: "hesap-mesai-web",
    },
  )
}

export function verifyAuthToken(token?: string | null): AuthSession | null {
  if (!token) return null

  try {
    const payload = jwt.verify(token, jwtSecret(), {
      issuer: "hesap-mesai",
      audience: "hesap-mesai-web",
    }) as AuthPayload

    return {
      id: Number(payload.sub),
      role: payload.role,
      name: payload.name,
      tcKimlik: payload.tcKimlik,
    }
  } catch {
    return null
  }
}

export async function getAuthSession() {
  const cookieStore = await cookies()
  return verifyAuthToken(cookieStore.get(authCookieName)?.value)
}

export async function requireAuth(roles?: Role[]) {
  const session = await getAuthSession()

  if (!session) {
    redirect("/auth/giris")
  }

  if (roles?.length && !roles.includes(session.role)) {
    redirect("/auth/giris")
  }

  return session
}

export async function getFreshAuthUser() {
  const session = await getAuthSession()
  if (!session) return null

  return prisma.user.findFirst({
    where: { id: session.id, isActive: true },
    select: {
      id: true,
      tcKimlik: true,
      name: true,
      role: true,
      shiftId: true,
    },
  })
}

