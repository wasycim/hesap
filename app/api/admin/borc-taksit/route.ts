import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
]

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const subeId = searchParams.get("subeId")
  const personelId = searchParams.get("personelId")

  const admin = createAdminClient()
  let query = admin.from("personel_borc_taksitleri").select("*, personel:personeller(id, ad)").order("created_at", { ascending: false })

  if (personelId) {
    query = query.eq("personel_id", personelId)
  } else if (subeId) {
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
  const { personel_id, sube_id, toplam_borc, taksit_sayisi, aciklama, baslangic_tarihi } = body

  if (!personel_id || !sube_id || !toplam_borc || !taksit_sayisi) {
    return NextResponse.json({ error: "Personel, şube, toplam borç ve taksit sayısı zorunludur." }, { status: 400 })
  }

  const totalAmount = Number(toplam_borc)
  const count = Number(taksit_sayisi)

  if (isNaN(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: "Geçerli bir toplam borç tutarı giriniz." }, { status: 400 })
  }
  if (isNaN(count) || count < 1) {
    return NextResponse.json({ error: "Taksit sayısı en az 1 olmalıdır." }, { status: 400 })
  }

  const monthlyAmount = Math.round((totalAmount / count) * 100) / 100
  const startDateStr = baslangic_tarihi ? String(baslangic_tarihi).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number)

  // Calculate end date (adding count - 1 months)
  const endDateObj = new Date(startYear, startMonth - 1 + (count - 1), startDay)
  const endDateStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`

  const cleanDescription = String(aciklama || "Taksitli Borç").trim()

  // 1. Insert personel_borc_taksitleri record
  const { data: taksitRecord, error: taksitError } = await admin
    .from("personel_borc_taksitleri")
    .insert({
      personel_id,
      sube_id,
      toplam_borc: totalAmount,
      taksit_sayisi: count,
      aylik_taksit: monthlyAmount,
      odenen_taksit_sayisi: 0,
      baslangic_tarihi: startDateStr,
      bitis_tarihi: endDateStr,
      aciklama: cleanDescription,
      durum: "aktif",
    })
    .select()
    .single()

  if (taksitError) {
    return NextResponse.json({ error: taksitError.message }, { status: 500 })
  }

  // 2. Generate monthly maas_kesintileri records for each installment month!
  const kesintilerToInsert = []
  for (let i = 0; i < count; i++) {
    const instDateObj = new Date(startYear, startMonth - 1 + i, startDay)
    const instDateStr = `${instDateObj.getFullYear()}-${String(instDateObj.getMonth() + 1).padStart(2, "0")}-${String(instDateObj.getDate()).padStart(2, "0")}`
    const instMonthName = MONTH_NAMES[instDateObj.getMonth()]
    const instAyYil = `${instMonthName}-${instDateObj.getFullYear()}`

    kesintilerToInsert.push({
      personel_id,
      sube_id,
      tutar: monthlyAmount,
      aciklama: `${cleanDescription} (${i + 1}/${count}. Taksit)`,
      tarih: instDateStr,
      ay_yil: instAyYil,
    })
  }

  const { error: kesintiInsertError } = await admin.from("maas_kesintileri").insert(kesintilerToInsert)

  if (kesintiInsertError) {
    console.error("Error inserting installment kesintileri:", kesintiInsertError)
  }

  return NextResponse.json({ ok: true, item: taksitRecord })
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

  const { error } = await admin.from("personel_borc_taksitleri").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
