import { cookies } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import {
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
  verifyPasswordRecoveryToken,
} from "@/lib/auth/password-recovery"
import { createClient } from "@/lib/supabase/server"

async function getRecoveryState() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { allowed: false, supabase, user: null }
  }

  const cookieStore = await cookies()
  const recoveryToken = cookieStore.get(passwordRecoveryCookieName)?.value
  const allowed = verifyPasswordRecoveryToken(recoveryToken, user.id)

  return { allowed, supabase, user }
}

export async function GET() {
  const { allowed } = await getRecoveryState()
  return NextResponse.json({ ok: allowed })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const password = String(body.password || "")

  if (password.length < 6) {
    return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı." }, { status: 400 })
  }

  const { allowed, supabase } = await getRecoveryState()

  if (!allowed) {
    return NextResponse.json(
      { error: "Bu sayfa yalnızca e-postadaki şifre sıfırlama bağlantısı ile kullanılabilir." },
      { status: 403 },
    )
  }

  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    return NextResponse.json({ error: "Şifre güncellenemedi. Yeni bağlantı isteyin." }, { status: 500 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(passwordRecoveryCookieName, "", passwordRecoveryCookieOptions(0))
  return response
}
