import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"
import { formatMinutes } from "@/lib/qr-attendance/time"

type RuleRow = {
  active?: boolean
  late_enabled?: boolean
  late_threshold_minutes?: number
  overtime_enabled?: boolean
  overtime_threshold_minutes?: number
  send_to_personnel?: boolean
  send_to_admins?: boolean
}

const defaultRule: Required<RuleRow> = {
  active: true,
  late_enabled: true,
  late_threshold_minutes: 1,
  overtime_enabled: true,
  overtime_threshold_minutes: 45,
  send_to_personnel: true,
  send_to_admins: false,
}

function recentWindow() {
  const date = new Date()
  date.setUTCHours(date.getUTCHours() - 36)
  return date
}

function formatWorkDate(date: Date) {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(date)
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = request.nextUrl.searchParams.get("secret")
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 401 })
  }

  const logs = await prisma.attendanceLog.findMany({
    where: {
      updatedAt: { gte: recentWindow() },
      OR: [{ lateMinutes: { gt: 0 } }, { overtimeMinutes: { gt: 0 } }],
    },
    include: { user: true },
    orderBy: { updatedAt: "desc" },
    take: 250,
  })

  const tcKimliks = Array.from(new Set(logs.map((log) => log.user.tcKimlik).filter(Boolean)))
  if (!tcKimliks.length) return NextResponse.json({ ok: true, scanned: logs.length, created: 0, pushed: 0 })

  const admin = createAdminClient()
  const { data: profiles, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, tc_kimlik, sube_id, is_admin, dashboard_access")
    .in("tc_kimlik", tcKimliks)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const [{ data: ruleRows }, { data: adminProfiles }] = await Promise.all([
    admin.from("attendance_alert_rules").select("*"),
    admin
      .from("user_profiles")
      .select("user_id, sube_id, is_admin, dashboard_access")
      .eq("is_admin", true)
      .neq("dashboard_access", false),
  ])

  const ruleByBranch = new Map((ruleRows || []).map((rule: any) => [String(rule.sube_id), rule as RuleRow]))
  const profileByTc = new Map((profiles || []).map((profile: any) => [String(profile.tc_kimlik), profile]))
  let created = 0
  let pushed = 0
  let skipped = 0

  for (const log of logs) {
    const profile = profileByTc.get(log.user.tcKimlik)
    const userId = profile?.user_id ? String(profile.user_id) : null
    if (!userId) continue

    const branchId = profile?.sube_id ? String(profile.sube_id) : ""
    const rule = { ...defaultRule, ...(ruleByBranch.get(branchId) || {}) }
    if (rule.active === false) {
      skipped += 1
      continue
    }

    const alerts = [
      rule.late_enabled !== false && log.lateMinutes >= Number(rule.late_threshold_minutes || 1)
        ? {
            sourceKey: `attendance:late:${log.id}`,
            title: "Gec kalma uyarisi",
            body: `${formatWorkDate(log.workDate)} gunu ${formatMinutes(log.lateMinutes)} gec giris gorunuyor.`,
            level: "warning" as const,
          }
        : null,
      rule.overtime_enabled !== false && log.overtimeMinutes >= Number(rule.overtime_threshold_minutes || 45)
        ? {
            sourceKey: `attendance:overtime:${log.id}`,
            title: "Fazla mesai olustu",
            body: `${formatWorkDate(log.workDate)} gunu ${formatMinutes(log.overtimeMinutes)} net fazla mesai kaydi var.`,
            level: "success" as const,
          }
        : null,
    ].filter(Boolean) as Array<{ sourceKey: string; title: string; body: string; level: "success" | "warning" }>

    for (const alert of alerts) {
      const recipients = new Set<string>()
      if (rule.send_to_personnel !== false) recipients.add(userId)
      if (rule.send_to_admins) {
        ;(adminProfiles || [])
          .filter((adminProfile: any) => !branchId || !adminProfile.sube_id || String(adminProfile.sube_id) === branchId)
          .forEach((adminProfile: any) => {
            if (adminProfile.user_id) recipients.add(String(adminProfile.user_id))
          })
      }

      if (!recipients.size) {
        skipped += 1
        continue
      }

      if (dryRun) {
        created += recipients.size
        continue
      }

      for (const recipientId of recipients) {
        const sourceKey = `${alert.sourceKey}:${recipientId}`
        const { data: existing } = await admin
          .from("app_notifications")
          .select("id, push_status")
          .eq("source_key", sourceKey)
          .maybeSingle()

        let notificationId = existing?.id as string | undefined
        if (!notificationId) {
          const { data: notification, error: insertError } = await admin
            .from("app_notifications")
            .insert({
              user_id: recipientId,
              title: alert.title,
              body: alert.body,
              href: "/dashboard/mesai-takip",
              level: alert.level,
              source_key: sourceKey,
              push_status: "pending",
            })
            .select("id")
            .single()

          if (insertError) {
            skipped += 1
            continue
          }
          notificationId = notification.id
          created += 1
        }

        if (existing?.push_status === "sent") {
          skipped += 1
          continue
        }
        if (!notificationId) {
          skipped += 1
          continue
        }

        const delivery = await deliverPushToUserDevices(admin, {
          userId: recipientId,
          notificationId,
          title: alert.title,
          body: alert.body,
          href: "/dashboard/mesai-takip",
          level: alert.level,
        })
        pushed += delivery.sent
      }
    }
  }

  if (!dryRun) {
    await admin.from("security_events").insert({
      event_type: "attendance_push_alerts_sent",
      details: { scanned: logs.length, created, pushed, skipped },
    })
  }

  return NextResponse.json({ ok: true, dryRun, scanned: logs.length, created, pushed, skipped })
}
