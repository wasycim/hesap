import { NextResponse } from "next/server"
import { getFreshAuthUser } from "@/lib/qr-attendance/auth"

export async function GET() {
  const user = await getFreshAuthUser()

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  return NextResponse.json({ user })
}
