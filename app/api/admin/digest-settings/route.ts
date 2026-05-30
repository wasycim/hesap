import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const admin = createAdminClient()
  const [{ data: profiles, error: profileError }, { data: subscribers, error: subscriberError }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("user_id, email, display_name, is_admin, dashboard_access")
      .eq("is_admin", true)
      .neq("dashboard_access", false)
      .order("display_name", { ascending: true }),
    admin.from("admin_digest_subscribers").select("*"),
  ])

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (subscriberError) return NextResponse.json({ error: subscriberError.message }, { status: 500 })

  const subscriberById = new Map((subscribers || []).map((item) => [item.user_id, item]))
  return NextResponse.json({
    users: (profiles || []).map((profile) => {
      const subscriber = subscriberById.get(profile.user_id)
      return {
        ...profile,
        email: subscriber?.email || profile.email || "",
        daily_enabled: Boolean(subscriber?.daily_enabled),
        weekly_enabled: Boolean(subscriber?.weekly_enabled),
      }
    }),
  })
}

export async function PATCH(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const userId = String(body.userId || "").trim()
  const email = String(body.email || "").trim().toLowerCase()
  const dailyEnabled = Boolean(body.dailyEnabled)
  const weeklyEnabled = Boolean(body.weeklyEnabled)

  if (!userId || !email) {
    return NextResponse.json({ error: "Yönetici ve e-posta zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from("admin_digest_subscribers").upsert(
    {
      user_id: userId,
      email,
      daily_enabled: dailyEnabled,
      weekly_enabled: weeklyEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.user.email,
    event_type: "digest_settings_update",
    details: { target_user_id: userId, email, daily_enabled: dailyEnabled, weekly_enabled: weeklyEnabled },
  })

  return NextResponse.json({ ok: true })
}
