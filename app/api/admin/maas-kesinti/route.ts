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
  let query = admin
    .from("maas_kesintileri")
    .select("*, personel:personeller(id, ad), ortak:ortaklar(id, ad)")

  if (subeId !== "all") {
    // Return kesintiler for this branch OR any ortak kesintileri (since partners are company-wide)
    query = query.or(`sube_id.eq.${subeId},target_type.eq.ortak`)
  }

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
  const {
    sube_id,
    ay_yil,
    personel_id,
    ortak_id,
    ortak_ad,
    target_type = "personel",
    tutar,
    aciklama,
    tarih,
  } = body

  const isOrtak = target_type === "ortak" || Boolean(ortak_id)

  if (!sube_id || !ay_yil || (!isOrtak && !personel_id) || (isOrtak && !ortak_id && !ortak_ad) || tutar === undefined) {
    return NextResponse.json({ error: "sube_id, ay_yil, hedef kişi ve tutar zorunludur." }, { status: 400 })
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
      target_type: isOrtak ? "ortak" : "personel",
      personel_id: isOrtak ? null : personel_id,
      ortak_id: isOrtak ? (ortak_id || null) : null,
      ortak_ad: isOrtak ? (ortak_ad || null) : null,
      tutar: numericTutar,
      aciklama: String(aciklama || (isOrtak ? "Ortak Maaş Kesintisi" : "Maaş Kesintisi")).trim(),
      tarih: recordDate,
    })
    .select("*, personel:personeller(id, ad), ortak:ortaklar(id, ad)")
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update existing maas_onaylari kalan_nakit only for personnel
  if (!isOrtak && personel_id) {
    const { data: targetOnay } = await admin
      .from("maas_onaylari")
      .select("*")
      .eq("personel_id", personel_id)
      .eq("sube_id", sube_id)
      .eq("ay_yil", ay_yil)
      .maybeSingle()

    if (targetOnay) {
      const updatedKalan = Math.max(0, Number(targetOnay.kalan_nakit || 0) - numericTutar)
      await admin
        .from("maas_onaylari")
        .update({ kalan_nakit: updatedKalan })
        .eq("id", targetOnay.id)
    }
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

  // Fetch kesinti before deleting to update maas_onaylari if personnel
  const { data: targetKesinti } = await admin
    .from("maas_kesintileri")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  const { error } = await admin.from("maas_kesintileri").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (targetKesinti && targetKesinti.target_type !== "ortak" && targetKesinti.personel_id) {
    const deletedTutar = Number(targetKesinti.tutar || 0)
    const { data: targetOnay } = await admin
      .from("maas_onaylari")
      .select("*")
      .eq("personel_id", targetKesinti.personel_id)
      .eq("sube_id", targetKesinti.sube_id)
      .eq("ay_yil", targetKesinti.ay_yil)
      .maybeSingle()

    if (targetOnay) {
      const updatedKalan = Number(targetOnay.kalan_nakit || 0) + deletedTutar
      await admin
        .from("maas_onaylari")
        .update({ kalan_nakit: updatedKalan })
        .eq("id", targetOnay.id)
    }
  }

  return NextResponse.json({ ok: true })
}
