import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const allowedThemes = new Set(["light", "dark", "system"])

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ theme: "system" })

  const { data } = await supabase
    .from("user_profiles")
    .select("theme_preference")
    .eq("user_id", user.id)
    .maybeSingle()

  return NextResponse.json({ theme: data?.theme_preference || "system" })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const theme = String(body.theme || "system")
  if (!allowedThemes.has(theme)) {
    return NextResponse.json({ error: "Tema tercihi geçersiz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("user_profiles")
    .update({ theme_preference: theme, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, theme })
}
