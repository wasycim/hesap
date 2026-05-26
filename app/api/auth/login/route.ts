import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { authCookieName, signAuthToken, verifyPassword } from "@/lib/qr-attendance/auth"

const loginSchema = z.object({
  tcKimlik: z.string().regex(/^\d{11}$/, "TC kimlik 11 haneli olmalı."),
  password: z.string().min(4, "Şifre çok kısa."),
})

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Geçersiz giriş." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { tcKimlik: parsed.data.tcKimlik },
  })

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "TC veya şifre hatalı." }, { status: 401 })
  }

  const validPassword = await verifyPassword(parsed.data.password, user.passwordHash)

  if (!validPassword) {
    return NextResponse.json({ error: "TC veya şifre hatalı." }, { status: 401 })
  }

  const token = signAuthToken(user)
  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      tcKimlik: user.tcKimlik,
    },
  })

  response.cookies.set(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  })

  return response
}
