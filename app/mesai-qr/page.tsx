import { PersonnelTerminalScanner } from "@/components/mesai/personnel-terminal-scanner"
import { requireAuth } from "@/lib/qr-attendance/auth"

export default async function MesaiQrPage() {
  const session = await requireAuth()

  return <PersonnelTerminalScanner userName={session.name} />
}
