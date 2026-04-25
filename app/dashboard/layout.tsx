import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
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
    <div className="flex h-screen bg-background">
      <DashboardSidebar userEmail={user.email ?? ""} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  </UnsavedChangesProvider>
</SubeProvider>
  )
}
