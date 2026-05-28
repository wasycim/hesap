import { AdminAttendanceDashboard } from "@/components/mesai/admin-attendance-dashboard"
import { requireAnyMesaiAdmin } from "@/lib/qr-attendance/admin"
import { redirect } from "next/navigation"

export default async function PersonelMesaiPage() {
  const session = await requireAnyMesaiAdmin()
  if (!session.ok) redirect("/auth/giris")

  return <AdminAttendanceDashboard adminName={session.name} />
}
