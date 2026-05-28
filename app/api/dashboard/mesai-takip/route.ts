import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getShiftLabel, shiftBoundary } from "@/lib/qr-attendance/time"

function dateParam(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function dateToPrisma(value: string) {
  return new Date(`${value}T00:00:00.000Z`)
}

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR")
}

function minutesBetween(start: Date, end: Date | null) {
  if (!end) return 0
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000))
}

function shiftDurationMinutes(shift: { startMinute: number; endMinute: number } | null) {
  if (!shift) return 0
  return shift.endMinute <= shift.startMinute
    ? (24 * 60 - shift.startMinute) + shift.endMinute
    : shift.endMinute - shift.startMinute
}

function calculateTiming(log: {
  checkInAt: Date
  checkOutAt: Date | null
  workDate: Date
  shift: { startMinute: number; endMinute: number } | null
}) {
  const workedMinutes = minutesBetween(log.checkInAt, log.checkOutAt)
  if (!log.shift) {
    return { workedMinutes, earlyMinutes: 0, lateMinutes: 0, afterShiftMinutes: 0, overtimeMinutes: 0 }
  }

  const crossesMidnight = log.shift.endMinute <= log.shift.startMinute
  const startsAt = shiftBoundary(log.workDate, log.shift.startMinute)
  const endsAt = shiftBoundary(log.workDate, log.shift.endMinute, crossesMidnight)
  const scheduledMinutes = shiftDurationMinutes(log.shift)
  const earlyMinutes = Math.max(0, Math.floor((startsAt.getTime() - log.checkInAt.getTime()) / 60000))
  const lateMinutes = Math.max(0, Math.floor((log.checkInAt.getTime() - startsAt.getTime()) / 60000))
  const afterShiftMinutes = log.checkOutAt
    ? Math.max(0, Math.floor((log.checkOutAt.getTime() - endsAt.getTime()) / 60000))
    : 0
  const overtimeMinutes = log.checkOutAt
    ? Math.max(0, workedMinutes - scheduledMinutes)
    : 0

  return { workedMinutes, earlyMinutes, lateMinutes, afterShiftMinutes, overtimeMinutes }
}

async function requireDashboardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single()

  return Boolean(profile?.is_admin)
}

export async function GET(request: NextRequest) {
  const isAdmin = await requireDashboardAdmin()
  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  const from = dateParam(searchParams.get("from")) || today
  const to = dateParam(searchParams.get("to")) || from
  const subeId = searchParams.get("subeId") || "all"

  const admin = createAdminClient()
  let personelQuery = admin
    .from("personeller")
    .select("id, ad, sube_id, aktif, sira")
    .eq("aktif", true)
    .order("sira", { ascending: true })
    .order("ad", { ascending: true })

  if (subeId !== "all") personelQuery = personelQuery.eq("sube_id", subeId)

  const [{ data: branches, error: branchError }, { data: personeller, error: personelError }, { data: profiles, error: profileError }] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("aktif", true).order("ad"),
    personelQuery,
    admin.from("user_profiles").select("display_name, tc_kimlik, sube_id, is_admin"),
  ])

  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 500 })
  if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const branchById = new Map((branches || []).map((branch) => [branch.id, branch]))
  const branchIds = new Set((personeller || []).map((personel) => personel.sube_id))
  const profileByTc = new Map((profiles || []).filter((profile) => profile.tc_kimlik).map((profile) => [profile.tc_kimlik, profile]))
  const profileByBranchAndName = new Map((profiles || []).map((profile) => [
    `${profile.sube_id || ""}:${normalizeName(profile.display_name)}`,
    profile,
  ]))

  const logs = await prisma.attendanceLog.findMany({
    where: {
      workDate: {
        gte: dateToPrisma(from),
        lte: dateToPrisma(to),
      },
      ...(subeId !== "all"
        ? {
            user: {
              tcKimlik: {
                in: (profiles || [])
                  .filter((profile) => profile.sube_id === subeId && profile.tc_kimlik)
                  .map((profile) => profile.tc_kimlik),
              },
            },
          }
        : {}),
    },
    orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
    include: { user: true, shift: true },
    take: 1000,
  })

  const summaryByKey = new Map<string, {
    personelId: string
    name: string
    tcKimlik: string | null
    branch: { id: string; ad: string; kod: string } | null
    logCount: number
    openCount: number
    earlyMinutes: number
    lateMinutes: number
    afterShiftMinutes: number
    overtimeMinutes: number
    workedMinutes: number
  }>()

  for (const personel of personeller || []) {
    const branch = branchById.get(personel.sube_id) || null
    const profile = profileByBranchAndName.get(`${personel.sube_id || ""}:${normalizeName(personel.ad)}`)
    summaryByKey.set(`${personel.sube_id}:${normalizeName(personel.ad)}`, {
      personelId: personel.id,
      name: personel.ad,
      tcKimlik: profile?.tc_kimlik || null,
      branch,
      logCount: 0,
      openCount: 0,
      earlyMinutes: 0,
      lateMinutes: 0,
      afterShiftMinutes: 0,
      overtimeMinutes: 0,
      workedMinutes: 0,
    })
  }

  const details = logs
    .filter((log) => {
      const profile = profileByTc.get(log.user.tcKimlik)
      return subeId === "all" ? !profile?.sube_id || branchIds.has(profile.sube_id) : profile?.sube_id === subeId
    })
    .map((log) => {
      const profile = profileByTc.get(log.user.tcKimlik)
      const branch = profile?.sube_id ? branchById.get(profile.sube_id) || null : null
      const key = `${profile?.sube_id || ""}:${normalizeName(profile?.display_name || log.user.name)}`
      const summary = summaryByKey.get(key)
      const timing = calculateTiming({
        checkInAt: log.checkInAt,
        checkOutAt: log.checkOutAt,
        workDate: log.workDate,
        shift: log.shift,
      })

      if (summary) {
        summary.logCount += 1
        summary.openCount += log.checkOutAt ? 0 : 1
        summary.earlyMinutes += timing.earlyMinutes
        summary.lateMinutes += timing.lateMinutes
        summary.afterShiftMinutes += timing.afterShiftMinutes
        summary.overtimeMinutes += timing.overtimeMinutes
        summary.workedMinutes += timing.workedMinutes
      }

      return {
        id: log.id,
        personel: profile?.display_name || log.user.name,
        tcKimlik: log.user.tcKimlik,
        branch,
        workDate: log.workDate,
        checkInAt: log.checkInAt,
        checkOutAt: log.checkOutAt,
        workedMinutes: timing.workedMinutes,
        earlyMinutes: timing.earlyMinutes,
        lateMinutes: timing.lateMinutes,
        afterShiftMinutes: timing.afterShiftMinutes,
        overtimeMinutes: timing.overtimeMinutes,
        status: log.status,
        shift: log.shift ? { id: String(log.shift.id), name: log.shift.name, label: getShiftLabel(log.shift) } : null,
      }
    })

  const summaries = Array.from(summaryByKey.values())
  const branchSummaries = (branches || [])
    .filter((branch) => subeId === "all" ? branchIds.has(branch.id) : branch.id === subeId)
    .map((branch) => {
      const people = summaries.filter((summary) => summary.branch?.id === branch.id)
      return {
        branch,
        personelCount: people.length,
        logCount: people.reduce((sum, item) => sum + item.logCount, 0),
        openCount: people.reduce((sum, item) => sum + item.openCount, 0),
        earlyMinutes: people.reduce((sum, item) => sum + item.earlyMinutes, 0),
        lateMinutes: people.reduce((sum, item) => sum + item.lateMinutes, 0),
        afterShiftMinutes: people.reduce((sum, item) => sum + item.afterShiftMinutes, 0),
        overtimeMinutes: people.reduce((sum, item) => sum + item.overtimeMinutes, 0),
        workedMinutes: people.reduce((sum, item) => sum + item.workedMinutes, 0),
      }
    })

  return NextResponse.json({
    range: { from, to },
    branches: branches || [],
    branchSummaries,
    personelSummaries: summaries,
    details,
  })
}

