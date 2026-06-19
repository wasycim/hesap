import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { QuickCommand } from "@/components/dashboard/quick-command"
import { DashboardPermissionGate } from "@/components/dashboard/permission-gate"
import { NotificationCenter } from "@/components/notifications/notification-center"
import { AnnouncementBanner } from "@/components/notifications/announcement-banner"
import { DeviceLicenseRegistration } from "@/components/security/device-license-registration"
import { SubeProvider } from "@/contexts/sube-context"
import { UnsavedChangesProvider } from "@/contexts/unsaved-changes-context"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/giris")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("dashboard_access, display_name")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profile?.dashboard_access === false) {
    redirect("/mesai-qr")
  }

  return (
    <SubeProvider>
  <UnsavedChangesProvider>
    <div className="dashboard-shell flex h-dvh bg-background lg:flex-row">
      <DashboardSidebar
        userEmail={user.email ?? ""}
        displayName={String(profile?.display_name || user.user_metadata?.display_name || "")}
      />
      <QuickCommand />
      <NotificationCenter />
      <AnnouncementBanner />
      <DeviceLicenseRegistration />
      <main className="mobile-safe-area min-w-0 flex-1 overflow-auto pt-14 lg:pt-0">
        <DashboardPermissionGate>{children}</DashboardPermissionGate>
      </main>
    </div>
  </UnsavedChangesProvider>
</SubeProvider>
  )
}
