import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"

function getAnonSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase URL veya anon anahtarı eksik.")
  }

  return createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const refreshToken = String(body.refreshToken || "").trim()
  if (!refreshToken) return NextResponse.json({ error: "Refresh token bulunamadı." }, { status: 400 })

  const supabase = getAnonSupabaseClient()
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "Oturum yenilenemedi." }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, is_developer, tc_kimlik")
    .eq("user_id", data.user.id)
    .maybeSingle()

  const isDeveloper = Boolean(profile?.is_developer)
  if (!isDeveloper) {
    const { data: personelRecord } = await admin
      .from("personeller")
      .select("aktif, isten_cikis_tarihi")
      .or(`user_id.eq.${data.user.id}${profile?.tc_kimlik ? `,id.eq.${profile.tc_kimlik}` : ""}`)
      .maybeSingle()

    const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
    const isExited = Boolean(
      personelRecord && (
        personelRecord.aktif === false ||
        (personelRecord.isten_cikis_tarihi && String(personelRecord.isten_cikis_tarihi).trim() <= todayStr)
      )
    )

    if (isExited) {
      return NextResponse.json(
        { error: "İşten çıkışınız verildiği için oturumunuz sonlandırılmıştır.", blocked: true, isExited: true },
        { status: 403 }
      )
    }
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: data.user.user_metadata?.display_name || data.user.email || "Kullanıcı",
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
