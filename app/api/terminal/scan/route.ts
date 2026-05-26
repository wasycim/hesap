import { NextRequest, NextResponse } from "next/server"
import { AttendanceStatus, Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getFreshAuthUser } from "@/lib/qr-attendance/auth"
import { parseQrPayload, verifyDynamicQrPayload } from "@/lib/qr-attendance/qr"
import { calculateLateMinutes, calculateOvertimeMinutes, getWorkDate, getShiftLabel } from "@/lib/qr-attendance/time"

export async function POST(request: NextRequest) {
  const operator = await getFreshAuthUser()

  if (!operator) {
    return NextResponse.json({ error: "Terminal için giriş yapmalısınız." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const payload = parseQrPayload(body.qr)

  if (!payload) {
    return NextResponse.json({ error: "QR formatı geçersiz." }, { status: 400 })
  }

  const now = new Date()

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: payload.userId, isActive: true },
        include: { shift: true },
      })

      if (!user || !verifyDynamicQrPayload(payload, user)) {
        return { error: "QR token doğrulanamadı veya süresi doldu.", status: 403 as const }
      }

      const openLog = await tx.attendanceLog.findFirst({
        where: {
          userId: user.id,
          status: AttendanceStatus.OPEN,
          checkOutAt: null,
        },
        orderBy: { checkInAt: "desc" },
      })

      if (openLog) {
        const overtimeMinutes = calculateOvertimeMinutes(now, openLog.workDate, user.shift)
        const closedLog = await tx.attendanceLog.update({
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
          shift: user.shift ? { name: user.shift.name, label: getShiftLabel(user.shift) } : null,
          log: closedLog,
        }
      }

      const workDate = getWorkDate(now, user.shift)
      const lateMinutes = calculateLateMinutes(now, user.shift)
      const createdLog = await tx.attendanceLog.create({
        data: {
          userId: user.id,
          shiftId: user.shiftId,
          checkInAt: now,
          workDate,
          lateMinutes,
          status: AttendanceStatus.OPEN,
        },
      })

      return {
        action: "CHECK_IN" as const,
        user: { id: user.id, name: user.name, tcKimlik: user.tcKimlik },
        shift: user.shift ? { name: user.shift.name, label: getShiftLabel(user.shift) } : null,
        log: createdLog,
      }
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "İşlem tamamlanamadı. Lütfen tekrar okutun." }, { status: 500 })
  }
}
