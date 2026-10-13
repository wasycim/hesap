import { NextRequest, NextResponse } from "next/server"
import { getRequestAuthUser } from "@/lib/mobile-auth"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestAuthUser(request)
    if (!user) return NextResponse.json({ notifications: [], unreadCount: 0 })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from("app_notifications")
      .select("id, user_id, title, body, href, level, read_at, created_at")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      console.error("Notifications fetch error:", error)
      return NextResponse.json({ notifications: [], unreadCount: 0 })
    }

    const notifications = (data || []).slice(0, 30).map((item: any) => ({
      ...item,
      deletable: item.user_id === user.id,
    }))

    const unreadCount = notifications.filter((n: any) => !n.read_at).length

    return NextResponse.json({
      notifications,
      unreadCount,
    })
  } catch (err: any) {
    console.error("GET /api/notifications error:", err)
    return NextResponse.json({ notifications: [], unreadCount: 0 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getRequestAuthUser(request)
    if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const admin = createAdminClient()

    if (body.all === true) {
      const { error } = await admin
        .from("app_notifications")
        .update({ read_at: new Date().toISOString() })
        .or(`user_id.eq.${user.id},user_id.is.null`)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ ok: true })
    }

    const id = String(body.id || "").trim()
    if (!id) return NextResponse.json({ ok: true })

    const { error } = await admin
      .from("app_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .or(`user_id.eq.${user.id},user_id.is.null`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("PATCH /api/notifications error:", err)
    return NextResponse.json({ error: err?.message || "İşlem başarısız." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getRequestAuthUser(request)
    if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

    const id = String(request.nextUrl.searchParams.get("id") || "").trim()
    if (!id) return NextResponse.json({ error: "Bildirim id zorunlu." }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin
      .from("app_notifications")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .not("read_at", "is", null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error("DELETE /api/notifications error:", err)
    return NextResponse.json({ error: err?.message || "İşlem başarısız." }, { status: 500 })
  }
}
