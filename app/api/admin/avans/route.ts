import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deliverPushToUserDevices } from "@/lib/notifications/push"

async function getAuthUserAndProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("id, user_id, display_name, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .single()

  return { user, profile }
}

export async function GET(request: NextRequest) {
  const { user, profile } = await getAuthUserAndProfile()
  if (!user || !profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 })
  }

  const admin = createAdminClient()
  let query = admin
    .from("avans_talepleri")
    .select("*")
    .order("created_at", { ascending: false })

  if (profile.sube_id && !profile.is_developer) {
    query = query.eq("sube_id", profile.sube_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ requests: data || [] })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAuthUserAndProfile()
  if (!user || !profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "").toLowerCase()
  const requestId = String(body.id || "").trim()

  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Geçersiz istek parametreleri." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existingRequest, error: fetchErr } = await admin
    .from("avans_talepleri")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchErr || !existingRequest) {
    return NextResponse.json({ error: "Avans talebi bulunamadı." }, { status: 404 })
  }

  const islemTarihi = new Date().toISOString()
  let updatePayload: any = {
    onaylayan_user_id: user.id,
    islem_tarihi: islemTarihi,
    updated_at: islemTarihi,
  }

  let title = ""
  let bodyText = ""
  let level: "success" | "warning" = "info" as any

  if (action === "approve") {
    const odemeTarihi = String(body.odeme_tarihi || "").trim()
    if (!odemeTarihi) {
      return NextResponse.json({ error: "Ödeme tarihi seçilmesi zorunludur." }, { status: 400 })
    }

    updatePayload.durum = "onaylandi"
    updatePayload.odeme_tarihi = odemeTarihi
    updatePayload.red_sebebi = null

    const formattedTutar = Number(existingRequest.tutar).toLocaleString("tr-TR")
    const formattedDate = new Date(odemeTarihi).toLocaleDateString("tr-TR")
    title = "Avans Talebiniz Onaylandı ✅"
    bodyText = `${formattedTutar} ₺ avans talebiniz onaylanmıştır. Ödeme tarihi: ${formattedDate}`
    level = "success"
  } else {
    const redSebebi = String(body.red_sebebi || "").trim()
    if (!redSebebi) {
      return NextResponse.json({ error: "Red sebebi yazılması zorunludur." }, { status: 400 })
    }

    updatePayload.durum = "reddedildi"
    updatePayload.red_sebebi = redSebebi
    updatePayload.odeme_tarihi = null

    const formattedTutar = Number(existingRequest.tutar).toLocaleString("tr-TR")
    title = "Avans Talebiniz Reddedildi ❌"
    bodyText = `${formattedTutar} ₺ avans talebiniz reddedildi. Neden: ${redSebebi}`
    level = "warning"
  }

  const { data: updated, error: updateErr } = await admin
    .from("avans_talepleri")
    .update(updatePayload)
    .eq("id", requestId)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Notify applicant personnel
  const applicantUserId = existingRequest.user_id
  const { data: notification } = await admin
    .from("app_notifications")
    .insert({
      user_id: applicantUserId,
      title,
      body: bodyText,
      href: "/mobile/maasim",
      level,
      push_status: "pending",
    })
    .select("id")
    .single()

  if (notification?.id) {
    await deliverPushToUserDevices(admin, {
      userId: applicantUserId,
      notificationId: notification.id,
      title,
      body: bodyText,
      href: "/mobile/maasim",
      level,
    }).catch(() => undefined)
  }

  return NextResponse.json({ ok: true, request: updated })
}
