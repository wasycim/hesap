import { NextRequest, NextResponse } from "next/server"
import { AttendanceStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/qr-attendance/auth"
import { parseTerminalQrPayload, verifyTerminalQrPayload } from "@/lib/qr-attendance/qr"
import { calculateLateMinutes, calculateOvertimeMinutes, getShiftLabel, getWorkDate } from "@/lib/qr-attendance/time"
import {
  ensurePrismaShift,
  findDashboardPersonelForAttendanceUser,
  resolvePersonelDashboardShift,
  todayInIstanbul,
} from "@/lib/qr-attendance/dashboard-vardiya"

export async function POST(request: NextRequest) {
  const session = await getAuthSession()

  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadi. Tekrar giris yapin." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const payload = parseTerminalQrPayload(body.qr)

  if (!payload || !verifyTerminalQrPayload(payload)) {
    return NextResponse.json({ error: "Terminal QR gecersiz veya suresi dolmus." }, { status: 403 })
  }

  const now = new Date()

  try {
    const currentUser = await prisma.user.findFirst({
      where: { id: session.id, isActive: true },
      include: { shift: true },
    })

    if (!currentUser) {
      return NextResponse.json({ error: "Personel bulunamadi." }, { status: 404 })
    }

    const dashboardPersonel = await findDashboardPersonelForAttendanceUser(currentUser)
    const dashboardShift = dashboardPersonel
      ? await resolvePersonelDashboardShift({
          subeId: dashboardPersonel.subeId,
          personelId: dashboardPersonel.id,
          date: todayInIstanbul(),
          fallbackCode: dashboardPersonel.sabitVardiya,
        })
      : null
    const activeShift = dashboardShift ? await ensurePrismaShift(dashboardShift) : currentUser.shift

    const result = await prisma.$transaction(async (tx) => {
      const user = currentUser

      const openLog = await tx.attendanceLog.findFirst({
        where: {
          userId: user.id,
          status: AttendanceStatus.OPEN,
          checkOutAt: null,
        },
        orderBy: { checkInAt: "desc" },
      })

      if (openLog) {
        const overtimeMinutes = calculateOvertimeMinutes(now, openLog.workDate, activeShift)
        await tx.attendanceLog.update({
          where: { id: openLog.id },
          data: {
            checkOutAt: now,
            overtimeMinutes,
            status: AttendanceStatus.CLOSED,
          },
        })

        return {
          action: "CHECK_OUT" as const,
          user: { id: user.id, name: user.name, tcKimlik: user.tcKimlik },
          shift: activeShift ? { name: activeShift.name, label: getShiftLabel(activeShift) } : null,
        }
      }

      const workDate = getWorkDate(now, activeShift)
      const lateMinutes = calculateLateMinutes(now, activeShift)
      await tx.attendanceLog.create({
        data: {
          userId: user.id,
          shiftId: activeShift?.id,
          checkInAt: now,
          workDate,
          lateMinutes,
          status: AttendanceStatus.OPEN,
        },
      })

      return {
        action: "CHECK_IN" as const,
        user: { id: user.id, name: user.name, tcKimlik: user.tcKimlik },
        shift: activeShift ? { name: activeShift.name, label: getShiftLabel(activeShift) } : null,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Mesai islemi tamamlanamadi. QR'i tekrar okutun." }, { status: 500 })
  }
}
