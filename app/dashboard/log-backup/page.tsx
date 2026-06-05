import { redirect } from "next/navigation"
import { LogBackupPanel } from "@/components/developer/log-backup-panel"
import { getDashboardAdmin } from "@/lib/admin/require-admin"

export default async function LogBackupPage() {
  const guard = await getDashboardAdmin()
  if (!guard.user || !guard.isDeveloper) {
    redirect("/dashboard")
  }

  return <LogBackupPanel />
}
