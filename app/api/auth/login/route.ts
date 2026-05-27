import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { authCookieName, signAuthToken } from "@/lib/qr-attendance/auth"
import { getRealProfileByTc, syncRealProfileToAttendanceUser, verifyRealUserPassword } from "@/lib/qr-attendance/sync-users"

const loginSchema = z.object({
  tcKimlik: z.string().regex(/^\d{11}$/, "TC kimlik 11 haneli olmali."),
  password: z.string().min(4, "Sifre cok kisa."),
})

export async function POST(request: NextRequest) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})))

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Gecersiz giris." }, { status: 400 })
  }

  const realUser = await getRealProfileByTc(parsed.data.tcKimlik)
  const email = realUser?.profile.email || realUser?.authUser?.email || ""

  if (!realUser || !email) {
    return NextResponse.json({ error: "TC veya sifre hatali." }, { status: 401 })
  }

  const validPassword = await verifyRealUserPassword(email, parsed.data.password)

  if (!validPassword) {
    return NextResponse.json({ error: "TC veya sifre hatali." }, { status: 401 })
  }

  const user = await syncRealProfileToAttendanceUser(realUser.profile, realUser.authUser)

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Kullanici mesai sistemine aktarilamadi." }, { status: 500 })
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
