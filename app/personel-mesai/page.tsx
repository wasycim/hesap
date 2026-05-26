import { Role } from "@prisma/client"
import { AdminAttendanceDashboard } from "@/components/mesai/admin-attendance-dashboard"
import { requireAuth } from "@/lib/qr-attendance/auth"

export default async function PersonelMesaiPage() {
  const session = await requireAuth([Role.ADMIN])

  return <AdminAttendanceDashboard adminName={session.name} />
}
