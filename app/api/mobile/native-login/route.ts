import { NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { normalizeTcKimlik } from "@/lib/tc-kimlik"

const loginSchema = z.object({
  tcKimlik: z.string().min(1),
  password: z.string().min(4, "Şifre çok kısa."),
})

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
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Geçersiz giriş." }, { status: 400 })
  }

  const tcKimlik = normalizeTcKimlik(parsed.data.tcKimlik)
  if (!/^\d{11}$/.test(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarası 11 haneli olmalı." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, email, display_name, sube_id, dashboard_access, tc_kimlik")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.user_id) {
    return NextResponse.json({ error: "TC veya şifre hatalı." }, { status: 401 })
  }

  let email = String(profile.email || "").trim().toLowerCase()
  if (!email) {
    const { data: authUser } = await admin.auth.admin.getUserById(profile.user_id)
    email = String(authUser.user?.email || "").trim().toLowerCase()
  }
  if (!email) return NextResponse.json({ error: "Bu kullanıcı için e-posta bulunamadı." }, { status: 409 })

  const supabase = getAnonSupabaseClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  if (error || !data.session || !data.user) {
    return NextResponse.json({ error: "TC veya şifre hatalı." }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: profile.display_name || data.user.user_metadata?.display_name || data.user.email || "Kullanıcı",
    },
    profile: {
      subeId: profile.sube_id,
      dashboardAccess: profile.dashboard_access !== false,
      tcKimlik: profile.tc_kimlik,
    },
    session: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
    },
  }, { headers: { "Cache-Control": "no-store" } })
}
