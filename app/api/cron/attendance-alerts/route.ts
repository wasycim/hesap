import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"
import { formatMinutes } from "@/lib/qr-attendance/time"

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
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 })
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
    .select("user_id, tc_kimlik")
    .in("tc_kimlik", tcKimliks)

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const userIdByTc = new Map((profiles || []).map((profile) => [String(profile.tc_kimlik), String(profile.user_id)]))
  let created = 0
  let pushed = 0
  let skipped = 0

  for (const log of logs) {
    const userId = userIdByTc.get(log.user.tcKimlik)
    if (!userId) continue

    const alerts = [
      log.lateMinutes > 0
        ? {
            sourceKey: `attendance:late:${log.id}`,
            title: "Geç kalma uyarısı",
            body: `${formatWorkDate(log.workDate)} günü ${formatMinutes(log.lateMinutes)} geç giriş görünüyor.`,
            level: "warning" as const,
          }
        : null,
      log.overtimeMinutes > 0
        ? {
            sourceKey: `attendance:overtime:${log.id}`,
            title: "Fazla mesai oluştu",
            body: `${formatWorkDate(log.workDate)} günü ${formatMinutes(log.overtimeMinutes)} net fazla mesai kaydı var.`,
            level: "success" as const,
          }
        : null,
    ].filter(Boolean) as Array<{ sourceKey: string; title: string; body: string; level: "success" | "warning" }>

    for (const alert of alerts) {
      if (dryRun) {
        created += 1
        continue
      }

      const { data: existing } = await admin
        .from("app_notifications")
        .select("id, push_status")
        .eq("source_key", alert.sourceKey)
        .maybeSingle()

      let notificationId = existing?.id as string | undefined
      if (!notificationId) {
        const { data: notification, error: insertError } = await admin
          .from("app_notifications")
          .insert({
            user_id: userId,
            title: alert.title,
            body: alert.body,
            href: "/dashboard/mesai-takip",
            level: alert.level,
            source_key: alert.sourceKey,
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
        userId,
        notificationId,
        title: alert.title,
        body: alert.body,
        href: "/dashboard/mesai-takip",
        level: alert.level,
      })
      pushed += delivery.sent
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
