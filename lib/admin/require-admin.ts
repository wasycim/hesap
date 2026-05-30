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
    .select("is_admin, dashboard_access, email, display_name")
    .eq("user_id", user.id)
    .maybeSingle()

  return {
    user,
    profile,
    isAdmin: Boolean(profile?.is_admin && profile.dashboard_access !== false),
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
