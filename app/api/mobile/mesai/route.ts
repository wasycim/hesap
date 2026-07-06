import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getRequestAuthUser } from "@/lib/mobile-auth"
import { getShiftLabel } from "@/lib/qr-attendance/time"
import { syncRealProfileToAttendanceUser } from "@/lib/qr-attendance/sync-users"
import { createAdminClient } from "@/lib/supabase/admin"

function dateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function dateToPrisma(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
}

function daysAgoInIstanbul(days: number) {
  const today = new Date(`${todayInIstanbul()}T00:00:00.000Z`)
  today.setUTCDate(today.getUTCDate() - days)
  return dateKey(today)
}

function minutesBetween(start: Date, end: Date | null) {
  if (!end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
}

export async function GET(request: NextRequest) {
  const authUser = await getRequestAuthUser(request)
  if (!authUser) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, email, display_name, tc_kimlik, is_admin, vardiya, sube_id")
    .eq("user_id", authUser.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.tc_kimlik) {
    return NextResponse.json({ error: "Mesai için TC kimlik eşleşmesi bulunamadı." }, { status: 404 })
  }

  const attendanceUser = await syncRealProfileToAttendanceUser(profile, {
    email: authUser.email || profile.email || undefined,
    user_metadata: authUser.user_metadata || {},
  })

  if (!attendanceUser?.isActive) {
    return NextResponse.json({ error: "Mesai kullanıcısı aktif değil." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const today = todayInIstanbul()
  const from = dateParam(searchParams.get("from")) || daysAgoInIstanbul(14)
  const to = dateParam(searchParams.get("to")) || today

  const [logs, openLog, branch] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: {
        userId: attendanceUser.id,
        workDate: {
          gte: dateToPrisma(from),
          lte: dateToPrisma(to),
        },
      },
      orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
      include: { shift: true },
      take: 100,
    }),
    prisma.attendanceLog.findFirst({
      where: {
        userId: attendanceUser.id,
        checkOutAt: null,
      },
      orderBy: { checkInAt: "desc" },
      include: { shift: true },
    }),
    profile.sube_id
      ? admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    range: { from, to },
    today,
    user: {
      id: attendanceUser.id,
      name: attendanceUser.name,
      tcKimlik: attendanceUser.tcKimlik,
      role: attendanceUser.role,
    },
    profile: {
      displayName: profile.display_name,
      branch: branch.data || null,
    },
    openLog: openLog ? serializeLog(openLog) : null,
    logs: logs.map(serializeLog),
  }, { headers: { "Cache-Control": "no-store" } })
}

function serializeLog(log: {
  id: number
  workDate: Date
  checkInAt: Date
  checkOutAt: Date | null
  lateMinutes: number
  overtimeMinutes: number
  status: string
  shift: { id: number | string; name: string; startMinute: number; endMinute: number } | null
}) {
  return {
    id: log.id,
    workDate: dateKey(log.workDate),
    checkInAt: log.checkInAt.toISOString(),
    checkOutAt: log.checkOutAt?.toISOString() || null,
    workedMinutes: minutesBetween(log.checkInAt, log.checkOutAt),
    lateMinutes: Number(log.lateMinutes || 0),
    overtimeMinutes: Number(log.overtimeMinutes || 0),
    status: log.status,
    shift: log.shift ? {
      id: String(log.shift.id),
      name: log.shift.name,
      label: getShiftLabel(log.shift),
    } : null,
  }
}
