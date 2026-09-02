import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const subeId = searchParams.get("subeId")

  const admin = createAdminClient()
  let query = admin.from("maas_zamlari").select("*, personel:personeller(id, ad)").order("created_at", { ascending: false })
  
  if (subeId) {
    query = query.eq("sube_id", subeId)
  }

  const { data, error } = await query

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
    .select("is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  const isManager = Boolean(profile?.is_admin || profile?.is_developer)
  if (!isManager) {
    return NextResponse.json({ error: "Bu işlemi sadece yöneticiler yapabilir." }, { status: 403 })
  }

  const body = await request.json()
  const { target_type, target_id, sube_id, eski_maas, zam_orani, yeni_maas, yururluk_tarihi, aciklama } = body

  if (!target_id || !sube_id || yeni_maas === undefined) {
    return NextResponse.json({ error: "Hedef, şube ve yeni maaş alanları zorunludur." }, { status: 400 })
  }

  const newSalary = Number(yeni_maas)
  if (isNaN(newSalary) || newSalary <= 0) {
    return NextResponse.json({ error: "Geçerli bir yeni maaş tutarı giriniz." }, { status: 400 })
  }

  const effectiveDate = yururluk_tarihi ? String(yururluk_tarihi).slice(0, 10) : new Date().toISOString().slice(0, 10)

  // 1. Insert raise log record
  const { data: zamRecord, error: zamError } = await admin
    .from("maas_zamlari")
    .insert({
      personel_id: target_type === "personel" ? target_id : null,
      sube_id,
      eski_maas: Number(eski_maas || 0),
      zam_orani: Number(zam_orani || 0),
      yeni_maas: newSalary,
      yururluk_tarihi: effectiveDate,
      aciklama: String(aciklama || "Maaş Zammı").trim(),
    })
    .select()
    .single()

  if (zamError) {
    return NextResponse.json({ error: zamError.message }, { status: 500 })
  }

  // 2. Update personnel salary in personeller table if effectiveDate is today or earlier
  const todayStr = new Date().toISOString().slice(0, 10)
  if (target_type === "personel" && effectiveDate <= todayStr) {
    const { error: updateError } = await admin
      .from("personeller")
      .update({ aylik_maas: newSalary })
      .eq("id", target_id)

    if (updateError) {
      console.error("Error updating personeller aylik_maas:", updateError)
    }
  }

  return NextResponse.json({ ok: true, item: zamRecord })
}
