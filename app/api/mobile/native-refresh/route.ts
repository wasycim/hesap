import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

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
