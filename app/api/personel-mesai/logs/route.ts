import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/qr-attendance/auth"
import { getShiftLabel } from "@/lib/qr-attendance/time"

function dateParam(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const session = await getAuthSession()

  if (!session || session.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const from = dateParam(searchParams.get("from"))
  const to = dateParam(searchParams.get("to"))
  const shiftId = Number(searchParams.get("shiftId") || 0)
  const status = searchParams.get("status")

  const logs = await prisma.attendanceLog.findMany({
    where: {
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(shiftId ? { shiftId } : {}),
      ...(status === "late" ? { lateMinutes: { gt: 0 } } : {}),
      ...(status === "overtime" ? { overtimeMinutes: { gt: 0 } } : {}),
      ...(status === "open" ? { checkOutAt: null } : {}),
    },
    orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
    take: 500,
    include: {
      user: true,
      shift: true,
    },
  })

  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      checkInAt: log.checkInAt,
      checkOutAt: log.checkOutAt,
      workDate: log.workDate,
      lateMinutes: log.lateMinutes,
      overtimeMinutes: log.overtimeMinutes,
      status: log.status,
      user: {
        id: log.user.id,
        name: log.user.name,
        tcKimlik: log.user.tcKimlik,
      },
      shift: log.shift ? { id: log.shift.id, name: log.shift.name, label: getShiftLabel(log.shift) } : null,
    })),
  })
}
