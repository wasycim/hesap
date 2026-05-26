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

  const shifts = await prisma.shift.findMany({ orderBy: { startMinute: "asc" } })

  return NextResponse.json({
    shifts: shifts.map((shift) => ({
      ...shift,
      label: getShiftLabel(shift),
    })),
  })
}
