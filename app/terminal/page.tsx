import { TerminalScanner } from "@/components/mesai/terminal-scanner"
import { requireAuth } from "@/lib/qr-attendance/auth"

export default async function TerminalPage() {
  const session = await requireAuth()

  return <TerminalScanner operatorName={session.name} operatorRole={session.role} />
}
