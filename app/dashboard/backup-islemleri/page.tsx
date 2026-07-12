import { redirect } from "next/navigation"
import { BackupIslemleriPanel } from "@/components/developer/backup-islemleri-panel"
import { getDashboardAdmin } from "@/lib/admin/require-admin"

export default async function BackupIslemleriPage() {
  const guard = await getDashboardAdmin()
  if (!guard.user || !guard.isDeveloper) {
    redirect("/dashboard")
  }

  return <BackupIslemleriPanel />
}
