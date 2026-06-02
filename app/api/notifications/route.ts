import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ notifications: [] })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("app_notifications")
    .select("id, user_id, title, body, href, level, read_at, created_at")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    notifications: (data || []).slice(0, 25).map((item: any) => ({
      ...item,
      deletable: item.user_id === user.id,
    })),
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

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
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadi." }, { status: 401 })

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
}
