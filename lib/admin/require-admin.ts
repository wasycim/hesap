import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function getDashboardAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, is_developer, dashboard_access, email, display_name")
    .eq("user_id", user.id)
    .maybeSingle()

  return {
    user,
    profile,
    isAdmin: Boolean((profile?.is_admin || profile?.is_developer) && profile.dashboard_access !== false),
    isDeveloper: Boolean(profile?.is_developer && profile.dashboard_access !== false),
  }
}

export async function requireDashboardAdmin() {
  const result = await getDashboardAdmin()
  if (!result.user || !result.isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user: result.user,
    profile: result.profile,
  }
}

export async function requireDashboardDeveloper() {
  const result = await getDashboardAdmin()
  if (!result.user || !result.isDeveloper) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Bu islem icin developer yetkisi gerekli." }, { status: 403 }),
    }
  }

  return {
    ok: true as const,
    user: result.user,
    profile: result.profile,
  }
}
