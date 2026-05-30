import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"
import { formatMinutes } from "@/lib/qr-attendance/time"

function recentDate(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ notifications: [] })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("tc_kimlik")
    .eq("user_id", user.id)
    .maybeSingle()

  const appNotificationsPromise = admin
    .from("app_notifications")
    .select("id, title, body, href, level, read_at, created_at")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(20)

  const attendancePromise = profile?.tc_kimlik
    ? prisma.attendanceLog.findMany({
        where: {
          user: { tcKimlik: profile.tc_kimlik },
          workDate: { gte: recentDate(14) },
          OR: [{ lateMinutes: { gt: 0 } }, { overtimeMinutes: { gt: 0 } }],
        },
        orderBy: [{ workDate: "desc" }, { checkInAt: "desc" }],
        take: 10,
      })
    : Promise.resolve([])

  const [{ data: stored }, attendanceLogs] = await Promise.all([appNotificationsPromise, attendancePromise])

  const attendanceNotifications = attendanceLogs.flatMap((log) => {
    const items = []
    if (log.lateMinutes > 0) {
      items.push({
        id: `late-${log.id}`,
        title: "Geç kalma uyarısı",
        body: `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(log.workDate)} günü ${formatMinutes(log.lateMinutes)} geç giriş görünüyor.`,
        href: "/dashboard/mesai-takip",
        level: "warning",
        read_at: null,
        created_at: log.updatedAt.toISOString(),
      })
    }
    if (log.overtimeMinutes > 0) {
      items.push({
        id: `overtime-${log.id}`,
        title: "Fazla mesai oluştu",
        body: `${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeZone: "Europe/Istanbul" }).format(log.workDate)} günü ${formatMinutes(log.overtimeMinutes)} net fazla mesai kaydı var.`,
        href: "/dashboard/mesai-takip",
        level: "success",
        read_at: null,
        created_at: log.updatedAt.toISOString(),
      })
    }
    return items
  })

  return NextResponse.json({
    notifications: [...attendanceNotifications, ...(stored || [])].slice(0, 25),
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "").trim()
  if (!id || id.startsWith("late-") || id.startsWith("overtime-")) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
