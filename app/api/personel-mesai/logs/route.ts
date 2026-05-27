import { NextRequest, NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAnyMesaiAdmin } from "@/lib/qr-attendance/admin"
import { getShiftLabel } from "@/lib/qr-attendance/time"
import { createAdminClient } from "@/lib/supabase/admin"

function dateParam(value: string | null) {
  if (!value) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  const session = await requireAnyMesaiAdmin()

  if (!session.ok) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const from = dateParam(searchParams.get("from"))
  const to = dateParam(searchParams.get("to"))
  const shiftId = searchParams.get("shiftId") || "all"
  const subeId = searchParams.get("subeId")
  const status = searchParams.get("status")
  const tcKimlikList: string[] = []

  if (subeId && subeId !== "all") {
    const admin = createAdminClient()
    const { data: profiles, error } = await admin
      .from("user_profiles")
      .select("tc_kimlik")
      .eq("sube_id", subeId)
      .not("tc_kimlik", "is", null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    tcKimlikList.push(...(profiles || []).map((profile) => profile.tc_kimlik).filter(Boolean))
  }

  const logs = await prisma.attendanceLog.findMany({
    where: {
      user: { isActive: true, role: Role.PERSONNEL },
      ...(subeId && subeId !== "all" ? { user: { isActive: true, role: Role.PERSONNEL, tcKimlik: { in: tcKimlikList } } } : {}),
      ...(from || to
        ? {
            workDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
      ...(shiftId !== "all" ? { shift: { name: { contains: shiftId } } } : {}),
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
