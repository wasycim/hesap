import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createAdminClient } from "@/lib/supabase/admin"
import { canSendAdminDigestEmail, sendAdminDigestEmail } from "@/lib/email/admin-digest"
import { formatMinutes } from "@/lib/qr-attendance/time"

function startOfToday() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  return new Date(`${today}T00:00:00.000Z`)
}

function daysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = request.nextUrl.searchParams.get("secret")
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 401 })
  }

  const interval = request.nextUrl.searchParams.get("interval") === "weekly" ? "weekly" : "daily"
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
  const since = interval === "weekly" ? daysAgo(7) : startOfToday()

  if (!dryRun && !canSendAdminDigestEmail()) {
    return NextResponse.json({ ok: false, error: "SMTP ayarları yok." }, { status: 202 })
  }

  const admin = createAdminClient()
  const { data: subscribers, error } = await admin
    .from("admin_digest_subscribers")
    .select("*")
    .eq(interval === "weekly" ? "weekly_enabled" : "daily_enabled", true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!subscribers?.length) return NextResponse.json({ ok: true, dryRun, sent: 0 })

  const [logs, openCount, userCount] = await Promise.all([
    prisma.attendanceLog.findMany({
      where: { updatedAt: { gte: since } },
      include: { user: true, shift: true },
      take: 500,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.attendanceLog.count({ where: { status: "OPEN" } }),
    prisma.user.count({ where: { isActive: true } }),
  ])

  const lateMinutes = logs.reduce((sum, log) => sum + log.lateMinutes, 0)
  const overtimeMinutes = logs.reduce((sum, log) => sum + log.overtimeMinutes, 0)
  const completedCount = logs.filter((log) => log.checkOutAt).length
  const topOvertime = logs
    .filter((log) => log.overtimeMinutes > 0)
    .slice(0, 5)
    .map((log) => `${log.user.name}: ${formatMinutes(log.overtimeMinutes)} fazla mesai`)

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun,
      interval,
      subscribers: subscribers.length,
      metrics: {
        activeUsers: userCount,
        completedCount,
        openCount,
        overtime: formatMinutes(overtimeMinutes),
        late: formatMinutes(lateMinutes),
      },
      topOvertime,
    })
  }

  let sent = 0
  for (const subscriber of subscribers) {
    await sendAdminDigestEmail({
      to: subscriber.email,
      title: interval === "weekly" ? "Haftalık Mesai Özeti" : "Günlük Mesai Özeti",
      subtitle: `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date())} tarihli Hesap sistem özeti.`,
      metrics: [
        { label: "Aktif personel", value: String(userCount) },
        { label: "Tamamlanan kayıt", value: String(completedCount) },
        { label: "Açık mesai", value: String(openCount) },
        { label: "Fazla mesai", value: formatMinutes(overtimeMinutes) },
        { label: "Geç kalma", value: formatMinutes(lateMinutes) },
      ],
      details: topOvertime,
    })
    sent += 1
  }

  await admin.from("security_events").insert({
    event_type: "admin_digest_sent",
    details: { interval, sent, since: since.toISOString() },
  })

  return NextResponse.json({ ok: true, sent })
}
