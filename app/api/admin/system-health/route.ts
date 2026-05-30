import { NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const checks = await Promise.allSettled([
    prisma.$queryRaw`select 1`,
    prisma.attendanceLog.count(),
    prisma.user.count(),
    createAdminClient().from("security_events").select("id", { count: "exact", head: true }),
    createAdminClient().from("terminal_devices").select("id", { count: "exact", head: true }),
    createAdminClient().from("user_devices").select("id", { count: "exact", head: true }),
  ])

  const names = [
    "Veritabanı bağlantısı",
    "Mesai kayıtları",
    "QR personel tablosu",
    "Güvenlik kayıtları",
    "Terminal cihazları",
    "Mobil cihaz tokenları",
  ]

  const components = checks.map((check, index) => ({
    name: names[index],
    status: check.status === "fulfilled" ? "operational" : "down",
    message: check.status === "fulfilled" ? "Çalışıyor" : check.reason instanceof Error ? check.reason.message : "Kontrol başarısız",
  }))

  const admin = createAdminClient()
  const [{ data: latestEvents }, { data: resetEvents }, { data: pendingDevices }] = await Promise.all([
    admin.from("security_events").select("*").order("created_at", { ascending: false }).limit(8),
    admin
      .from("security_events")
      .select("*")
      .eq("event_type", "password_reset_request")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("terminal_devices")
      .select("*")
      .eq("approved", false)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    overall: components.some((item) => item.status === "down") ? "down" : "operational",
    components,
    latestEvents: latestEvents || [],
    resetEvents: resetEvents || [],
    pendingDevices: pendingDevices || [],
  })
}
