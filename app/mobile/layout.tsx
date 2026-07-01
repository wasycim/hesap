import { redirect } from "next/navigation"
import { IosAppShell } from "@/components/mobile/ios-app-shell"
import { createClient } from "@/lib/supabase/server"

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/giris?next=/mobile")

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()
  if (profile?.dashboard_access === false) redirect("/mesai-qr")

  return <IosAppShell displayName={String(profile?.display_name || user.email || "Kullanıcı")}>{children}</IosAppShell>
}

