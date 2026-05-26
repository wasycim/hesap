import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireDashboardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single()

  return { user, isAdmin: Boolean(profile?.is_admin) }
}

function isTime(value: unknown) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

const defaultFixedShifts = [
  { kod: "S", ad: "Sabah", simge: "S", baslangic: "06:00", bitis: "16:00", aktif: true },
  { kod: "A", ad: "Akşam", simge: "A", baslangic: "16:00", bitis: "02:00", aktif: true },
  { kod: "R", ad: "Ara", simge: "R", baslangic: "11:00", bitis: "21:00", aktif: true },
  { kod: "I", ad: "İzin", simge: "İ", baslangic: null, bitis: null, aktif: true },
]

async function getFixedShifts(admin: ReturnType<typeof createAdminClient>, subeId: string) {
  const { data, error } = await admin
    .from("vardiya_sabit_ayarlari")
    .select("id, kod, ad, simge, baslangic, bitis, aktif")
    .eq("sube_id", subeId)

  if (error) throw new Error(error.message)

  const byCode = new Map((data || []).map((row) => [row.kod, row]))
  return defaultFixedShifts.map((row) => ({
    ...row,
    ...(byCode.get(row.kod) || {}),
  }))
}

export async function GET(request: NextRequest) {
  const { isAdmin } = await requireDashboardAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const subeId = request.nextUrl.searchParams.get("subeId")
  if (!subeId) {
    return NextResponse.json({ error: "Şube zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const [{ data, error }, fixedShifts] = await Promise.all([
    admin
    .from("vardiya_tanimlari")
    .select("id, ad, simge, baslangic, bitis, aktif, sira")
    .eq("sube_id", subeId)
    .order("sira", { ascending: true })
      .order("created_at", { ascending: true }),
    getFixedShifts(admin, subeId),
  ])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ shifts: data || [], fixedShifts })
}

export async function POST(request: NextRequest) {
  const { user, isAdmin } = await requireDashboardAdmin()

  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const subeId = String(body.subeId || "")
  const ad = String(body.ad || "").trim()
  const simge = String(body.simge || "").trim().slice(0, 4)
  const baslangic = String(body.baslangic || "")
  const bitis = String(body.bitis || "")

  if (!subeId || !ad || !isTime(baslangic) || !isTime(bitis)) {
    return NextResponse.json({ error: "Ad, başlangıç ve bitiş saati zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from("vardiya_tanimlari")
    .select("id")
    .eq("sube_id", subeId)

  const { error } = await admin.from("vardiya_tanimlari").insert({
    user_id: user.id,
    sube_id: subeId,
    ad,
    simge,
    baslangic,
    bitis,
    aktif: true,
    sira: existing?.length || 0,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest) {
  const { user, isAdmin } = await requireDashboardAdmin()

  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const type = String(body.type || "custom")
  const subeId = String(body.subeId || "")
  const admin = createAdminClient()

  if (type === "fixed") {
    const kod = String(body.kod || "")
    const ad = String(body.ad || "").trim()
    const simge = String(body.simge || "").trim().slice(0, 4)
    const baslangic = body.baslangic ? String(body.baslangic) : null
    const bitis = body.bitis ? String(body.bitis) : null
    const aktif = Boolean(body.aktif)

    if (!subeId || !["S", "A", "R", "I"].includes(kod) || !ad || (kod !== "I" && (!isTime(baslangic) || !isTime(bitis)))) {
      return NextResponse.json({ error: "Sabit vardiya bilgileri eksik." }, { status: 400 })
    }

    const { error } = await admin
      .from("vardiya_sabit_ayarlari")
      .upsert({
        user_id: user.id,
        sube_id: subeId,
        kod,
        ad,
        simge,
        baslangic,
        bitis,
        aktif,
        updated_at: new Date().toISOString(),
      }, { onConflict: "sube_id,kod" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  const id = String(body.id || "")
  const ad = String(body.ad || "").trim()
  const simge = String(body.simge || "").trim().slice(0, 4)
  const baslangic = String(body.baslangic || "")
  const bitis = String(body.bitis || "")
  const aktif = Boolean(body.aktif)

  if (!id || !subeId || !ad || !isTime(baslangic) || !isTime(bitis)) {
    return NextResponse.json({ error: "Vardiya bilgileri eksik." }, { status: 400 })
  }

  const { error } = await admin
    .from("vardiya_tanimlari")
    .update({ ad, simge, baslangic, bitis, aktif, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sube_id", subeId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const { isAdmin } = await requireDashboardAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || "")
  const subeId = String(body.subeId || "")

  if (!id || !subeId) {
    return NextResponse.json({ error: "Silinecek vardiya zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from("vardiya_tanimlari")
    .delete()
    .eq("id", id)
    .eq("sube_id", subeId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
