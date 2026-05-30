import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidTcKimlik, normalizeTcKimlik } from "@/lib/tc-kimlik"

const genericMessage = "Eğer bu TC kimlik numarasına bağlı gerçek bir e-posta varsa şifre sıfırlama bağlantısı gönderildi."
const productionAppUrl = "https://pamukkaleturizm.info"

function normalizeAppUrl(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim().replace(/\/+$/, "")
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const hostname = url.hostname.toLowerCase()

    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".local")) {
      return null
    }

    return url.origin
  } catch {
    return null
  }
}

function publicAppOrigin() {
  return (
    normalizeAppUrl(process.env.PASSWORD_RESET_BASE_URL) ||
    normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    productionAppUrl
  )
}

function isSyntheticAttendanceEmail(email: string, tcKimlik: string) {
  return email.toLowerCase() === `personel-${tcKimlik}@pamukkaleturizm.info`
}

async function writeResetEvent(
  admin: ReturnType<typeof createAdminClient>,
  details: {
    userId?: string | null
    email?: string | null
    tcKimlik: string
    status: "sent" | "missing-email" | "not-found" | "failed"
    error?: string
  },
) {
  await admin.from("security_events").insert({
    user_id: details.userId || null,
    user_email: details.email || null,
    event_type: "password_reset_request",
    details: {
      tc_kimlik: details.tcKimlik,
      status: details.status,
      error: details.error,
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarası hatalı." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, email")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: "Şifre sıfırlama isteği alınamadı." }, { status: 500 })
  }

  let userId = profile?.user_id || null
  let email = String(profile?.email || "").trim().toLowerCase()

  if (userId && !email) {
    const { data: authUser } = await admin.auth.admin.getUserById(userId)
    email = String(authUser.user?.email || "").trim().toLowerCase()
  }

  if (!userId || !email) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const matchedUser = (authData?.users || []).find(user => normalizeTcKimlik(user.user_metadata?.tc_kimlik) === tcKimlik)
    userId = matchedUser?.id || userId
    email = String(matchedUser?.email || email).trim().toLowerCase()
  }

  if (!email) {
    await writeResetEvent(admin, { userId, email: null, tcKimlik, status: userId ? "missing-email" : "not-found" })
    return NextResponse.json({ ok: true, message: genericMessage })
  }

  if (isSyntheticAttendanceEmail(email, tcKimlik)) {
    await writeResetEvent(admin, { userId, email, tcKimlik, status: "missing-email" })
    return NextResponse.json({ ok: true, message: genericMessage })
  }

  const callbackUrl = new URL("/auth/callback", publicAppOrigin())
  callbackUrl.searchParams.set("next", "/auth/sifre-sifirla")

  const { error: resetError } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl.toString(),
  })

  if (resetError) {
    await writeResetEvent(admin, { userId, email, tcKimlik, status: "failed", error: resetError.message })
    return NextResponse.json({ error: "Şifre sıfırlama e-postası gönderilemedi." }, { status: 500 })
  }

  await writeResetEvent(admin, { userId, email, tcKimlik, status: "sent" })
  return NextResponse.json({ ok: true, message: genericMessage, redirectTo: callbackUrl.toString() })
}
