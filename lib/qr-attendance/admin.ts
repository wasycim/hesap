import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/qr-attendance/auth"

import { getRequestAuthUser } from "@/lib/mobile-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function requireAnyMesaiAdmin(request?: any) {
  const mesaiSession = await getAuthSession()
  if (mesaiSession?.role === "ADMIN") {
    return {
      ok: true,
      name: mesaiSession.name,
      source: "mesai" as const,
    }
  }

  let user: any = null
  if (request) {
    user = await getRequestAuthUser(request)
  }

  if (!user) {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    user = authData?.user || null
  }

  if (!user) return { ok: false, name: "", source: null }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin, display_name")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile) return { ok: false, name: "", source: null }

  return {
    ok: true,
    name: String(profile.display_name || user.user_metadata?.display_name || user.email || "Kullanıcı"),
    source: "dashboard" as const,
  }
}
