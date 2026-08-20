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
    .select("id, user_id, display_name, sube_id, is_admin, is_developer, tc_kimlik")
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
  const isManager = Boolean(profile.is_admin || profile.is_developer)

  let query = admin
    .from("avans_talepleri")
    .select("*")
    .order("created_at", { ascending: false })

  if (!isManager) {
    // Regular personnel sees their own advance requests
    query = query.or(`user_id.eq.${user.id}${profile.tc_kimlik ? `,tc_kimlik.eq.${profile.tc_kimlik}` : ""}`)
  } else if (profile.sube_id && !profile.is_developer) {
    // Admin sees all advance requests for their branch
    query = query.eq("sube_id", profile.sube_id)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const managerUserIds = Array.from(new Set((data || []).map((r) => r.onaylayan_user_id).filter(Boolean)))
  let managerNameMap = new Map<string, string>()
  if (managerUserIds.length > 0) {
    const { data: managers } = await admin
      .from("user_profiles")
      .select("user_id, display_name")
      .in("user_id", managerUserIds)
    if (managers) {
      managerNameMap = new Map(managers.map((m) => [m.user_id, m.display_name || "Yönetici"]))
    }
  }

  const enrichedRequests = (data || []).map((r) => ({
    ...r,
    reviewer_name: r.onaylayan_user_id ? managerNameMap.get(r.onaylayan_user_id) || "Yönetici" : null,
  }))

  return NextResponse.json({ requests: enrichedRequests, isManager }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAuthUserAndProfile(request)
  if (!user || !profile) {
    return NextResponse.json({ error: "Oturum açmanız gerekiyor." }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "").toLowerCase()
  const admin = createAdminClient()

  // Case A: Manager Approving or Rejecting an Advance Request
  if (action === "approve" || action === "reject") {
    const isManager = Boolean(profile.is_admin || profile.is_developer)
    if (!isManager) {
      return NextResponse.json({ error: "Yetkisiz erişim. Sadece yöneticiler avans onaylayabilir." }, { status: 403 })
    }

    const requestId = String(body.id || "").trim()
    if (!requestId) {
      return NextResponse.json({ error: "Avans talep ID zorunludur." }, { status: 400 })
    }

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
      const odemeTarihi = String(body.odeme_tarihi || new Date().toISOString().split("T")[0]).trim()
      updatePayload.durum = "onaylandi"
      updatePayload.odeme_tarihi = odemeTarihi
      updatePayload.red_sebebi = null

      const formattedTutar = Number(existingRequest.tutar).toLocaleString("tr-TR")
      const formattedDate = new Date(odemeTarihi).toLocaleDateString("tr-TR")
      title = "Avans Talebiniz Onaylandı ✅"
      bodyText = `${formattedTutar} ₺ avans talebiniz onaylanmıştır. Ödeme tarihi: ${formattedDate}`
      level = "success"
    } else {
      const redSebebi = String(body.red_sebebi || "Yönetici tarafından reddedildi").trim()
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

    // Send push notification to applicant personnel
    const applicantUserId = existingRequest.user_id
    if (applicantUserId) {
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
    }

    return NextResponse.json({ ok: true, request: updated })
  }

  // Case B: Personnel Submitting a New Advance Request
  const tutar = Number(body.tutar)
  const aciklama = String(body.aciklama || "").trim()

  if (!tutar || isNaN(tutar) || tutar <= 0) {
    return NextResponse.json({ error: "Geçerli bir avans tutarı giriniz." }, { status: 400 })
  }

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

  // Find admins/developers of the branch to notify
  let adminQuery = admin
    .from("user_profiles")
    .select("user_id")
    .or("is_admin.eq.true,is_developer.eq.true")

  if (profile.sube_id) {
    adminQuery = adminQuery.or(`sube_id.eq.${profile.sube_id},is_developer.eq.true`)
  }

  const { data: admins } = await adminQuery

  const title = "Yeni Avans Talebi 💰"
  const bodyText = `${userName} ${tutar.toLocaleString("tr-TR")} ₺ avans talebinde bulundu.`
  const href = "/dashboard/maaslar"

  for (const adm of admins || []) {
    if (!adm.user_id || adm.user_id === user.id) continue
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
