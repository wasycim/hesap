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

function defaultMailSettings() {
  return {
    dailyEnabled: true,
    weeklyEnabled: true,
    attachPdf: true,
    attachHtml: true,
    detailLevel: "detailed",
    reportTypes: ["attendance", "salary", "system"],
    targetRoles: ["admin", "developer"],
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const headerSecret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const querySecret = request.nextUrl.searchParams.get("secret")
  if (secret && headerSecret !== secret && querySecret !== secret) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 401 })
  }

  const interval = request.nextUrl.searchParams.get("interval") === "weekly" ? "weekly" : "daily"
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1"
  const since = interval === "weekly" ? daysAgo(7) : startOfToday()

  if (!dryRun && !canSendAdminDigestEmail()) {
    return NextResponse.json({ ok: false, error: "SMTP ayarlari yok." }, { status: 202 })
  }

  const admin = createAdminClient()
  const [{ data: subscribers, error }, { data: settingsRow }, { data: profiles }] = await Promise.all([
    admin
      .from("admin_digest_subscribers")
      .select("*")
      .eq(interval === "weekly" ? "weekly_enabled" : "daily_enabled", true),
    admin.from("app_settings").select("value").eq("key", "mail_operations").maybeSingle(),
    admin
      .from("user_profiles")
      .select("user_id, email, display_name, is_admin, is_developer, dashboard_access")
      .neq("dashboard_access", false),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const mailSettings = { ...defaultMailSettings(), ...(settingsRow?.value || {}) }
  if ((interval === "daily" && mailSettings.dailyEnabled === false) || (interval === "weekly" && mailSettings.weeklyEnabled === false)) {
    return NextResponse.json({ ok: true, dryRun, sent: 0, disabled: true })
  }

  const recipients = new Map<string, { email: string; userId?: string | null }>()
  for (const subscriber of subscribers || []) {
    if (subscriber.email) recipients.set(String(subscriber.email).toLowerCase(), { email: subscriber.email, userId: subscriber.user_id })
  }

  const targetRoles = new Set(Array.isArray(mailSettings.targetRoles) ? mailSettings.targetRoles : ["admin", "developer"])
  for (const profile of profiles || []) {
    const role = profile.is_developer ? "developer" : profile.is_admin ? "admin" : "user"
    if (!targetRoles.has(role) || !profile.email) continue
    recipients.set(String(profile.email).toLowerCase(), { email: profile.email, userId: profile.user_id })
  }

  if (recipients.size === 0) return NextResponse.json({ ok: true, dryRun, sent: 0 })

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
    .slice(0, 8)
    .map((log) => `${log.user.name}: ${formatMinutes(log.overtimeMinutes)} fazla mesai`)
  const recentDetails = logs.slice(0, 14).map((log) => {
    const checkout = log.checkOutAt
      ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: "Europe/Istanbul" }).format(log.checkOutAt)
      : "cikis bekliyor"
    const day = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(log.workDate)
    return `${log.user.name} / ${day} / ${log.shift?.name || "Vardiya yok"} / ${checkout}`
  })
  const details = [
    ...(topOvertime.length ? ["En fazla mesai yapanlar:", ...topOvertime] : []),
    ...(mailSettings.detailLevel === "detailed" ? ["Son mesai hareketleri:", ...recentDetails] : []),
  ]

  const metrics = [
    { label: "Aktif personel", value: String(userCount) },
    { label: "Tamamlanan kayit", value: String(completedCount) },
    { label: "Acik mesai", value: String(openCount) },
    { label: "Fazla mesai", value: formatMinutes(overtimeMinutes) },
    { label: "Gec kalma", value: formatMinutes(lateMinutes) },
  ]

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dryRun,
      interval,
      subscribers: recipients.size,
      settings: mailSettings,
      metrics,
      details,
    })
  }

  let sent = 0
  for (const recipient of recipients.values()) {
    await sendAdminDigestEmail({
      to: recipient.email,
      title: interval === "weekly" ? "Haftalik Mesai Ozeti" : "Gunluk Mesai Ozeti",
      subtitle: `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(new Date())} tarihli Hesap sistem ozeti.`,
      metrics,
      details,
      attachPdf: mailSettings.attachPdf !== false,
      attachHtml: mailSettings.attachHtml !== false,
      reportLabel: `hesap-${interval}-ozet-${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())}`,
    })
    sent += 1
  }

  await admin.from("security_events").insert({
    event_type: "admin_digest_sent",
    details: {
      interval,
      sent,
      since: since.toISOString(),
      attach_pdf: mailSettings.attachPdf !== false,
      attach_html: mailSettings.attachHtml !== false,
    },
  })

  return NextResponse.json({ ok: true, sent })
}
