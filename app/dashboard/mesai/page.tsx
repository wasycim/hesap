import { redirect } from "next/navigation"
import { PersonnelTerminalScanner } from "@/components/mesai/personnel-terminal-scanner"
import { getAuthSession } from "@/lib/qr-attendance/auth"

export default async function DashboardMesaiPage() {
  const session = await getAuthSession()

  if (!session) {
    redirect("/api/auth/mesai-session?next=/dashboard/mesai")
  }

  return <PersonnelTerminalScanner userName={session.name} dashboardMode />
}
