import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { QuickCommand } from "@/components/dashboard/quick-command"
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

  return (
    <SubeProvider>
  <UnsavedChangesProvider>
    <div className="flex h-dvh bg-background lg:flex-row">
      <DashboardSidebar userEmail={user.email ?? ""} displayName={String(user.user_metadata?.display_name || "")} />
      <QuickCommand />
      <main className="mobile-safe-area min-w-0 flex-1 overflow-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  </UnsavedChangesProvider>
</SubeProvider>
  )
}
