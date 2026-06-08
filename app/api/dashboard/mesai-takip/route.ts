import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getShiftLabel, shiftBoundary } from "@/lib/qr-attendance/time"
import { roundOvertimeToPaidMinutes } from "@/lib/mesai/overtime"
import { getDashboardShiftCatalog } from "@/lib/qr-attendance/dashboard-vardiya"
import type { DashboardShift } from "@/lib/qr-attendance/dashboard-vardiya"

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
    return { workedMinutes, beforeShiftMinutes: 0, earlyMinutes: 0, lateMinutes: 0, afterShiftMinutes: 0, overtimeMinutes: 0 }
  }

  const crossesMidnight = log.shift.endMinute <= log.shift.startMinute
  const startsAt = shiftBoundary(log.workDate, log.shift.startMinute)
  const endsAt = shiftBoundary(log.workDate, log.shift.endMinute, crossesMidnight)
  const scheduledMinutes = shiftDurationMinutes(log.shift)
  const beforeShiftMinutes = log.checkOutAt && log.checkOutAt <= startsAt ? workedMinutes : 0
  const earlyMinutes = Math.max(0, Math.floor((startsAt.getTime() - log.checkInAt.getTime()) / 60000))
  const lateMinutes = Math.max(0, Math.floor((log.checkInAt.getTime() - startsAt.getTime()) / 60000))
  const afterShiftMinutes = log.checkOutAt
    ? Math.max(0, Math.floor((log.checkOutAt.getTime() - endsAt.getTime()) / 60000))
    : 0
  const overtimeMinutes = beforeShiftMinutes > 0
    ? beforeShiftMinutes
    : log.checkOutAt
      ? Math.max(0, workedMinutes - scheduledMinutes)
      : 0

  if (beforeShiftMinutes > 0) {
    return { workedMinutes, beforeShiftMinutes, earlyMinutes: 0, lateMinutes: 0, afterShiftMinutes: 0, overtimeMinutes }
  }

  return { workedMinutes, beforeShiftMinutes, earlyMinutes, lateMinutes, afterShiftMinutes, overtimeMinutes }
}

function calculateGroupedTiming(group: {
  intervals: Array<{ checkInAt: Date; checkOutAt: Date | null }>
  workDate: Date
  shift: { startMinute: number; endMinute: number } | null
}) {
  const intervals = [...group.intervals].sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime())
  const firstCheckInAt = intervals[0]?.checkInAt
  const allClosed = intervals.every((interval) => interval.checkOutAt)
  const lastCheckOutAt = allClosed
    ? intervals.reduce<Date | null>((latest, interval) => {
        if (!interval.checkOutAt) return latest
        return !latest || interval.checkOutAt > latest ? interval.checkOutAt : latest
      }, null)
    : null
  const workedMinutes = intervals.reduce((sum, interval) => sum + minutesBetween(interval.checkInAt, interval.checkOutAt), 0)
  const breakMinutes = intervals.reduce((sum, interval, index) => {
    if (index === 0) return sum
    const previous = intervals[index - 1]
    if (!previous.checkOutAt) return sum
    return sum + Math.max(0, Math.floor((interval.checkInAt.getTime() - previous.checkOutAt.getTime()) / 60000))
  }, 0)

  if (!group.shift || !firstCheckInAt) {
    return {
      checkInAt: firstCheckInAt,
      checkOutAt: lastCheckOutAt,
      workedMinutes,
      breakMinutes,
      beforeShiftMinutes: 0,
      earlyMinutes: 0,
      lateMinutes: 0,
      afterShiftMinutes: 0,
      overtimeMinutes: 0,
    }
  }

  const crossesMidnight = group.shift.endMinute <= group.shift.startMinute
  const startsAt = shiftBoundary(group.workDate, group.shift.startMinute)
  const endsAt = shiftBoundary(group.workDate, group.shift.endMinute, crossesMidnight)
  const scheduledMinutes = shiftDurationMinutes(group.shift)
  const beforeShiftMinutes = lastCheckOutAt && lastCheckOutAt <= startsAt ? workedMinutes : 0
  const earlyMinutes = beforeShiftMinutes > 0 ? 0 : Math.max(0, Math.floor((startsAt.getTime() - firstCheckInAt.getTime()) / 60000))
  const lateMinutes = beforeShiftMinutes > 0 ? 0 : Math.max(0, Math.floor((firstCheckInAt.getTime() - startsAt.getTime()) / 60000))
  const afterShiftMinutes = lastCheckOutAt
    ? Math.max(0, Math.floor((lastCheckOutAt.getTime() - endsAt.getTime()) / 60000))
    : 0
  const overtimeMinutes = beforeShiftMinutes > 0
    ? beforeShiftMinutes
    : lastCheckOutAt
      ? Math.max(0, workedMinutes - scheduledMinutes)
      : 0

  return {
    checkInAt: firstCheckInAt,
    checkOutAt: lastCheckOutAt,
    workedMinutes,
    breakMinutes,
    beforeShiftMinutes,
    earlyMinutes,
    lateMinutes,
    afterShiftMinutes,
    overtimeMinutes,
  }
}

function workDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

type ResolvedShift = {
  id: string | number
  name: string
  startMinute: number
  endMinute: number
  label?: string
}

async function getDashboardAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, isAdmin: false, profile: null }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, tc_kimlik, sube_id, is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .single()

  return {
    user,
    profile,
    isAdmin: Boolean((profile?.is_admin || profile?.is_developer) && profile.dashboard_access !== false),
  }
}

export async function GET(request: NextRequest) {
  const access = await getDashboardAccess()
  if (!access.user || access.profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  const from = dateParam(searchParams.get("from")) || today
  const to = dateParam(searchParams.get("to")) || from
  const requestedSubeId = searchParams.get("subeId") || "all"
  const subeId = access.isAdmin ? requestedSubeId : access.profile?.sube_id || "none"

  const admin = createAdminClient()
  let personelQuery = admin
    .from("personeller")
    .select("id, ad, sube_id, aktif, sira, sabit_vardiya")
    .eq("aktif", true)
    .order("sira", { ascending: true })
    .order("ad", { ascending: true })

  if (subeId !== "all") personelQuery = personelQuery.eq("sube_id", subeId)

  const [{ data: branches, error: branchError }, { data: personeller, error: personelError }, { data: profiles, error: profileError }] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("aktif", true).order("ad"),
    personelQuery,
    admin.from("user_profiles").select("user_id, display_name, tc_kimlik, sube_id, is_admin"),
  ])

  if (branchError) return NextResponse.json({ error: branchError.message }, { status: 500 })
  if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const visiblePersoneller = access.isAdmin
    ? (personeller || [])
    : (personeller || []).filter((personel) => normalizeName(personel.ad) === normalizeName(access.profile?.display_name))
  const branchById = new Map((branches || []).map((branch) => [branch.id, branch]))
  const branchIds = new Set(visiblePersoneller.map((personel) => personel.sube_id))
  if (!access.isAdmin && access.profile?.sube_id) branchIds.add(access.profile.sube_id)
  const profileByTc = new Map((profiles || []).filter((profile) => profile.tc_kimlik).map((profile) => [profile.tc_kimlik, profile]))
  const profileByBranchAndName = new Map((profiles || []).map((profile) => [
    `${profile.sube_id || ""}:${normalizeName(profile.display_name)}`,
    profile,
  ]))
  const personelMetaBySummaryKey = new Map<string, { personelId: string; subeId: string; sabitVardiya: string | null }>()

  const logs = await prisma.attendanceLog.findMany({
    where: {
      workDate: {
        gte: dateToPrisma(from),
        lte: dateToPrisma(to),
      },
      ...(!access.isAdmin
        ? {
            user: { tcKimlik: access.profile?.tc_kimlik || "__no_tc__" },
          }
        : subeId !== "all"
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
    beforeShiftMinutes: number
    earlyMinutes: number
    lateMinutes: number
    afterShiftMinutes: number
    overtimeMinutes: number
    payableOvertimeMinutes: number
    workedMinutes: number
  }>()

  for (const personel of visiblePersoneller) {
    const branch = branchById.get(personel.sube_id) || null
    const profile = profileByBranchAndName.get(`${personel.sube_id || ""}:${normalizeName(personel.ad)}`)
    const summaryKey = `${personel.sube_id}:${normalizeName(personel.ad)}`
    personelMetaBySummaryKey.set(summaryKey, {
      personelId: String(personel.id),
      subeId: String(personel.sube_id || ""),
      sabitVardiya: personel.sabit_vardiya ? String(personel.sabit_vardiya) : null,
    })
    summaryByKey.set(summaryKey, {
      personelId: personel.id,
      name: personel.ad,
      tcKimlik: profile?.tc_kimlik || null,
      branch,
      logCount: 0,
      openCount: 0,
      beforeShiftMinutes: 0,
      earlyMinutes: 0,
      lateMinutes: 0,
      afterShiftMinutes: 0,
      overtimeMinutes: 0,
      payableOvertimeMinutes: 0,
      workedMinutes: 0,
    })
  }

  if (!access.isAdmin && access.profile && summaryByKey.size === 0) {
    const branch = access.profile.sube_id ? branchById.get(access.profile.sube_id) || null : null
    summaryByKey.set(`${access.profile.sube_id || ""}:${normalizeName(access.profile.display_name)}`, {
      personelId: access.profile.user_id,
      name: access.profile.display_name || "Personel",
      tcKimlik: access.profile.tc_kimlik || null,
      branch,
      logCount: 0,
      openCount: 0,
      beforeShiftMinutes: 0,
      earlyMinutes: 0,
      lateMinutes: 0,
      afterShiftMinutes: 0,
      overtimeMinutes: 0,
      payableOvertimeMinutes: 0,
      workedMinutes: 0,
    })
  }

  const shiftCatalogByBranch = new Map<string, DashboardShift[]>()
  try {
    const catalogEntries = await Promise.all(
      Array.from(branchIds)
        .filter(Boolean)
        .map(async (branchId) => [branchId, await getDashboardShiftCatalog(branchId)] as const),
    )
    for (const [branchId, catalog] of catalogEntries) {
      shiftCatalogByBranch.set(branchId, catalog)
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Vardiya tanimlari okunamadi." },
      { status: 500 },
    )
  }

  const visiblePersonelIds = Array.from(new Set(Array.from(personelMetaBySummaryKey.values()).map((meta) => meta.personelId)))
  const { data: plannedShiftRows, error: plannedShiftError } = visiblePersonelIds.length
    ? await admin
        .from("vardiya_planlari")
        .select("sube_id, personel_id, tarih, vardiya")
        .in("personel_id", visiblePersonelIds)
        .gte("tarih", from)
        .lte("tarih", to)
    : { data: [], error: null }

  if (plannedShiftError) {
    return NextResponse.json({ error: plannedShiftError.message }, { status: 500 })
  }

  const plannedShiftByKey = new Map(
    (plannedShiftRows || []).map((row) => [`${row.sube_id}:${row.personel_id}:${row.tarih}`, String(row.vardiya || "")]),
  )

  function resolveCurrentShift(summaryKey: string, workDate: Date, savedShift: ResolvedShift | null): ResolvedShift | null {
    const meta = personelMetaBySummaryKey.get(summaryKey)
    if (!meta?.subeId || !meta.personelId) return savedShift

    const date = workDateKey(workDate)
    const plannedCode = plannedShiftByKey.get(`${meta.subeId}:${meta.personelId}:${date}`)
    const code = String(plannedCode !== undefined ? plannedCode : meta.sabitVardiya || "").trim()

    if (code === "I") return null
    if (code) {
      const dashboardShift = shiftCatalogByBranch.get(meta.subeId)?.find((shift) => shift.code === code)
      if (dashboardShift) {
        return {
          id: dashboardShift.code,
          name: dashboardShift.name,
          startMinute: dashboardShift.startMinute,
          endMinute: dashboardShift.endMinute,
          label: dashboardShift.label,
        }
      }
    }

    return savedShift
  }

  const groupedLogs = new Map<string, typeof logs[number][]>()

  for (const log of logs) {
    if (log.checkOutAt && minutesBetween(log.checkInAt, log.checkOutAt) === 0) continue

    const profile = profileByTc.get(log.user.tcKimlik)
    if (!profile?.sube_id) continue
    if (subeId !== "all" && profile.sube_id !== subeId) continue
    if (!branchIds.has(profile.sube_id)) continue

    const summaryKey = `${profile.sube_id}:${normalizeName(profile.display_name || log.user.name)}`
    if (!summaryByKey.has(summaryKey)) continue

    const groupKey = `${summaryKey}:${workDateKey(log.workDate)}`
    const current = groupedLogs.get(groupKey) || []
    current.push(log)
    groupedLogs.set(groupKey, current)
  }

  const rawDetails = Array.from(groupedLogs.values())
    .map((groupLogs) => {
      const orderedLogs = [...groupLogs].sort((a, b) => a.checkInAt.getTime() - b.checkInAt.getTime())
      const firstLog = orderedLogs[0]
      const profile = profileByTc.get(firstLog.user.tcKimlik)
      const branch = profile?.sube_id ? branchById.get(profile.sube_id) || null : null
      const summaryKey = `${profile?.sube_id || ""}:${normalizeName(profile?.display_name || firstLog.user.name)}`
      const summary = summaryByKey.get(summaryKey)
      const currentShift = resolveCurrentShift(summaryKey, firstLog.workDate, firstLog.shift)
      const timing = calculateGroupedTiming({
        intervals: orderedLogs.map((log) => ({ checkInAt: log.checkInAt, checkOutAt: log.checkOutAt })),
        workDate: firstLog.workDate,
        shift: currentShift,
      })

      if (summary) {
        summary.logCount += orderedLogs.length
        summary.openCount += timing.checkOutAt ? 0 : 1
        summary.beforeShiftMinutes += timing.beforeShiftMinutes
        summary.earlyMinutes += timing.earlyMinutes
        summary.lateMinutes += timing.lateMinutes
        summary.afterShiftMinutes += timing.afterShiftMinutes
        summary.overtimeMinutes += timing.overtimeMinutes
        summary.workedMinutes += timing.workedMinutes
      }

      const payableOvertimeMinutes = roundOvertimeToPaidMinutes(timing.overtimeMinutes)
      return {
        id: Number(firstLog.id),
        sourceLogIds: orderedLogs.map((log) => Number(log.id)),
        segments: orderedLogs.map((log) => ({
          id: Number(log.id),
          checkInAt: log.checkInAt,
          checkOutAt: log.checkOutAt,
          workedMinutes: minutesBetween(log.checkInAt, log.checkOutAt),
          status: log.checkOutAt ? "CLOSED" as const : "OPEN" as const,
        })),
        segmentCount: orderedLogs.length,
        breakMinutes: timing.breakMinutes,
        summaryKey,
        personelId: summary?.personelId || null,
        personel: profile?.display_name || firstLog.user.name,
        tcKimlik: firstLog.user.tcKimlik,
        branch,
        workDate: firstLog.workDate,
        checkInAt: timing.checkInAt || firstLog.checkInAt,
        checkOutAt: timing.checkOutAt,
        workedMinutes: timing.workedMinutes,
        beforeShiftMinutes: timing.beforeShiftMinutes,
        earlyMinutes: timing.earlyMinutes,
        lateMinutes: timing.lateMinutes,
        afterShiftMinutes: timing.afterShiftMinutes,
        overtimeMinutes: timing.overtimeMinutes,
        payableOvertimeMinutes,
        approvedPayableOvertimeMinutes: 0,
        approvalId: null as string | null,
        approvalNote: null as string | null,
        approvalStatus: payableOvertimeMinutes > 0 ? "pending" as const : null,
        status: timing.checkOutAt ? "CLOSED" as const : "OPEN" as const,
        shift: currentShift ? { id: String(currentShift.id), name: currentShift.name, label: currentShift.label || getShiftLabel(currentShift) } : null,
      }
    })
    .sort((a, b) => new Date(b.workDate).getTime() - new Date(a.workDate).getTime() || new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime())

  const overtimeApprovalRows = rawDetails
    .filter((detail) => detail.payableOvertimeMinutes > 0 && detail.checkOutAt)
    .map((detail) => {
      const profile = profileByTc.get(detail.tcKimlik)
      return {
        attendance_log_id: detail.id,
        personel_id: detail.personelId,
        user_profile_id: profile?.user_id || null,
        personel_name: detail.personel,
        branch_name: detail.branch?.ad || null,
        work_date: new Date(detail.workDate).toISOString().slice(0, 10),
        raw_minutes: detail.overtimeMinutes,
        payable_minutes: detail.payableOvertimeMinutes,
        status: "pending",
        updated_at: new Date().toISOString(),
      }
    })

  const approvalIds = rawDetails.map((detail) => detail.id).filter(Boolean)
  let approvalRows: any[] = []
  if (approvalIds.length) {
    const { data, error } = await admin
      .from("overtime_approvals")
      .select("id, attendance_log_id, status, raw_minutes, payable_minutes, manual_minutes, note")
      .in("attendance_log_id", approvalIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    approvalRows = data || []
  }

  if (access.isAdmin && approvalIds.length) {
    let approvalRowsChanged = false
    const currentApprovalByLogId = new Map(approvalRows.map((approval: any) => [Number(approval.attendance_log_id), approval]))
    const nextApprovalByLogId = new Map(overtimeApprovalRows.map((approval) => [Number(approval.attendance_log_id), approval]))
    const missingApprovals = overtimeApprovalRows.filter((approval) => !currentApprovalByLogId.has(Number(approval.attendance_log_id)))

    if (missingApprovals.length > 0) {
      const { error } = await admin.from("overtime_approvals").insert(missingApprovals)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      approvalRowsChanged = true
    }

    for (const existing of approvalRows) {
      const attendanceLogId = Number(existing.attendance_log_id)
      const nextApproval = nextApprovalByLogId.get(attendanceLogId)

      if (!nextApproval) {
        const shouldClear = Number(existing.raw_minutes || 0) !== 0 || Number(existing.payable_minutes || 0) !== 0 || existing.status === "approved"
        if (!shouldClear) continue

        const { error } = await admin
          .from("overtime_approvals")
          .update({
            raw_minutes: 0,
            payable_minutes: 0,
            status: "rejected",
            note: "Vardiya plani degistigi icin fazla mesai otomatik sifirlandi.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        approvalRowsChanged = true
        continue
      }

      const rawChanged = Number(existing.raw_minutes || 0) !== Number(nextApproval.raw_minutes || 0)
      const payableChanged = Number(existing.payable_minutes || 0) !== Number(nextApproval.payable_minutes || 0)
      if (!rawChanged && !payableChanged) continue

      const resetDecision = existing.status !== "pending"
      const { error } = await admin
        .from("overtime_approvals")
        .update({
          raw_minutes: nextApproval.raw_minutes,
          payable_minutes: nextApproval.payable_minutes,
          ...(resetDecision
            ? {
                status: "pending",
                approved_by: null,
                approved_at: null,
                note: `Vardiya plani degistigi icin mesai yeniden hesaplandi. Onceki karar: ${existing.status}.`,
              }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      approvalRowsChanged = true
    }

    if (approvalRowsChanged) {
      const { data, error } = await admin
        .from("overtime_approvals")
        .select("id, attendance_log_id, status, raw_minutes, payable_minutes, manual_minutes, note")
        .in("attendance_log_id", approvalIds)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      approvalRows = data || []
    }
  }

  const approvalByLogId = new Map((approvalRows || []).map((approval: any) => [Number(approval.attendance_log_id), approval]))
  for (const summary of summaryByKey.values()) {
    summary.payableOvertimeMinutes = 0
  }

  const details = rawDetails.map(({ summaryKey, ...detail }) => {
    const approval = detail.payableOvertimeMinutes > 0 ? approvalByLogId.get(Number(detail.id)) : null
    const approvedPayableOvertimeMinutes = approval?.status === "approved"
      ? Number(approval.payable_minutes) || 0
      : 0
    const summary = summaryByKey.get(summaryKey)
    if (summary) {
      summary.payableOvertimeMinutes += approvedPayableOvertimeMinutes
    }

    return {
      ...detail,
      approvalId: approval?.id || null,
      approvalNote: approval?.note || null,
      approvalStatus: approval?.status || detail.approvalStatus,
      approvedPayableOvertimeMinutes,
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
        beforeShiftMinutes: people.reduce((sum, item) => sum + item.beforeShiftMinutes, 0),
        earlyMinutes: people.reduce((sum, item) => sum + item.earlyMinutes, 0),
        lateMinutes: people.reduce((sum, item) => sum + item.lateMinutes, 0),
        afterShiftMinutes: people.reduce((sum, item) => sum + item.afterShiftMinutes, 0),
        overtimeMinutes: people.reduce((sum, item) => sum + item.overtimeMinutes, 0),
        payableOvertimeMinutes: people.reduce((sum, item) => sum + item.payableOvertimeMinutes, 0),
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

