import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const subeId = searchParams.get("subeId")
  const ayYil = searchParams.get("ayYil")

  if (!subeId) {
    return NextResponse.json({ error: "subeId zorunludur." }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin.from("maas_kesintileri").select("*, personel:personeller(id, ad)").eq("sube_id", subeId)
  
  if (ayYil) {
    query = query.eq("ay_yil", ayYil)
  }

  const { data, error } = await query.order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ items: data || [] }, { headers: { "Cache-Control": "no-store" } })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes?.data?.user

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin, is_developer, sube_id")
    .eq("user_id", user.id)
    .maybeSingle()

  const isManager = Boolean(profile?.is_admin || profile?.is_developer)
  if (!isManager) {
    return NextResponse.json({ error: "Bu işlemi sadece yöneticiler yapabilir." }, { status: 403 })
  }

  const body = await request.json()
  const { sube_id, ay_yil, personel_id, tutar, aciklama, tarih } = body

  if (!sube_id || !ay_yil || !personel_id || tutar === undefined) {
    return NextResponse.json({ error: "sube_id, ay_yil, personel_id ve tutar zorunludur." }, { status: 400 })
  }

  const numericTutar = Number(tutar)
  if (isNaN(numericTutar) || numericTutar <= 0) {
    return NextResponse.json({ error: "Geçerli bir kesinti tutarı giriniz." }, { status: 400 })
  }

  const recordDate = tarih ? String(tarih).slice(0, 10) : new Date().toISOString().slice(0, 10)

  const { data, error } = await admin
    .from("maas_kesintileri")
    .insert({
      sube_id,
      ay_yil,
      personel_id,
      tutar: numericTutar,
      aciklama: String(aciklama || "Maaş Kesintisi").trim(),
      tarih: recordDate,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, item: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const userRes = await supabase.auth.getUser()
  const user = userRes?.data?.user

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  const isManager = Boolean(profile?.is_admin || profile?.is_developer)
  if (!isManager) {
    return NextResponse.json({ error: "Bu işlemi sadece yöneticiler yapabilir." }, { status: 403 })
  }

  const { searchParams } = request.nextUrl
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "id zorunludur." }, { status: 400 })
  }

  const { error } = await admin.from("maas_kesintileri").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
