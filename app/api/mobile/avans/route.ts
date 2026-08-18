import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"
import { getRequestAuthUser } from "@/lib/mobile-auth"

async function getAuthUserAndProfile(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return { user: null, profile: null }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, user_id, display_name, sube_id, is_admin, tc_kimlik")
    .eq("user_id", user.id)
    .maybeSingle()

  return { user, profile }
}

export async function GET(request: NextRequest) {
  const { user, profile } = await getAuthUserAndProfile(request)
  if (!user || !profile) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("avans_talepleri")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data || [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAuthUserAndProfile(request)
  if (!user || !profile) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const tutar = Number(body.tutar)
  const aciklama = String(body.aciklama || "").trim()

  if (!tutar || isNaN(tutar) || tutar <= 0) {
    return NextResponse.json({ error: "Geçerli bir avans tutarı giriniz." }, { status: 400 })
  }

  const admin = createAdminClient()
  const userName = profile.display_name || user.email?.split("@")[0] || "Personel"

  const { data: newRequest, error: insertError } = await admin
    .from("avans_talepleri")
    .insert({
      user_id: user.id,
      sube_id: profile.sube_id,
      user_name: userName,
      tc_kimlik: profile.tc_kimlik || null,
      tutar,
      aciklama,
      durum: "beklemede",
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Find admins of the branch to notify
  const { data: admins } = await admin
    .from("user_profiles")
    .select("user_id")
    .eq("sube_id", profile.sube_id)
    .eq("is_admin", true)

  const title = "Yeni Avans Talebi 💰"
  const bodyText = `${userName} ${tutar.toLocaleString("tr-TR")} ₺ avans talebinde bulundu.`
  const href = "/dashboard/maaslar"

  for (const adm of admins || []) {
    if (!adm.user_id) continue
    const { data: notification } = await admin
      .from("app_notifications")
      .insert({
        user_id: adm.user_id,
        title,
        body: bodyText,
        href,
        level: "warning",
        push_status: "pending",
      })
      .select("id")
      .single()

    if (notification?.id) {
      await deliverPushToUserDevices(admin, {
        userId: adm.user_id,
        notificationId: notification.id,
        title,
        body: bodyText,
        href,
        level: "warning",
      }).catch(() => undefined)
    }
  }

  return NextResponse.json({ ok: true, request: newRequest })
}
