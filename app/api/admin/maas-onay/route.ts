import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const subeId = searchParams.get("subeId")
  const ayYil = searchParams.get("ayYil")

  if (!subeId || !ayYil) {
    return NextResponse.json({ error: "subeId ve ayYil zorunludur." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("maas_onaylari")
    .select("*")
    .eq("sube_id", subeId)
    .eq("ay_yil", ayYil)

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
  const { sube_id, ay_yil, personel_id, bankaya_gonderilen, kalan_nakit, nakit_odeme_tarihi } = body

  if (!sube_id || !ay_yil || !personel_id) {
    return NextResponse.json({ error: "sube_id, ay_yil ve personel_id zorunludur." }, { status: 400 })
  }

  const bankaAmt = Math.max(0, Number(bankaya_gonderilen) || 0)
  const kalanAmt = Math.max(0, Number(kalan_nakit) || 0)
  const odemeTarihi = nakit_odeme_tarihi ? String(nakit_odeme_tarihi).slice(0, 10) : null

  const { data, error } = await admin
    .from("maas_onaylari")
    .upsert(
      {
        sube_id,
        ay_yil,
        personel_id,
        bankaya_gonderilen: bankaAmt,
        kalan_nakit: kalanAmt,
        nakit_odeme_tarihi: odemeTarihi,
        approved_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sube_id,ay_yil,personel_id" }
    )
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, item: data?.[0] || null })
}
