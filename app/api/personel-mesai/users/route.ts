import { NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/qr-attendance/auth"
import { getShiftLabel } from "@/lib/qr-attendance/time"

export async function GET() {
  const session = await getAuthSession()

  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { shift: true },
  })

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      tcKimlik: user.tcKimlik,
      name: user.name,
      role: user.role,
      shift: user.shift ? { id: user.shift.id, name: user.shift.name, label: getShiftLabel(user.shift) } : null,
    })),
  })
}
