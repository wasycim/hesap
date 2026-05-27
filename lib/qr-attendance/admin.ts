import "server-only"

import { createClient } from "@/lib/supabase/server"
import { getAuthSession } from "@/lib/qr-attendance/auth"

export async function requireAnyMesaiAdmin() {
  const mesaiSession = await getAuthSession()
  if (mesaiSession?.role === "ADMIN") {
    return {
      ok: true,
      name: mesaiSession.name,
      source: "mesai" as const,
    }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { ok: false, name: "", source: null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single()

  if (!profile?.is_admin) return { ok: false, name: "", source: null }

  return {
    ok: true,
    name: String(user.user_metadata?.display_name || user.email || "Admin"),
    source: "dashboard" as const,
  }
}
