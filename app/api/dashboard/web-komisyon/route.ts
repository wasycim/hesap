import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function normalizeSubeName(name: string): string {
  return String(name || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
}

async function getAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()

  return { user, profile }
}

async function resolveSube(admin: ReturnType<typeof createAdminClient>, requestedSubeId: string | null, profile: any) {
  const isAdmin = Boolean(profile?.is_admin || profile?.is_developer)
  const subeId = isAdmin ? requestedSubeId || profile?.sube_id : profile?.sube_id
  if (!subeId) return { sube: null, isAdmin }

  const { data: sube, error } = await admin
    .from("subeler")
    .select("id, ad, kod")
    .eq("id", subeId)
    .eq("aktif", true)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return { sube, isAdmin }
}

export async function GET(request: NextRequest) {
  const { user, profile } = await getAccess()
  if (!user || profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const isAdmin = Boolean(profile?.is_admin || profile?.is_developer)
  if (!isAdmin) {
    return NextResponse.json({ error: "Web Komisyon sayfasına sadece yöneticiler erişebilir." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const requestedSubeId = searchParams.get("subeId")
  const admin = createAdminClient()

  const { sube } = await resolveSube(admin, requestedSubeId, profile)
  if (!sube) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 })

  // 14 No subesini bul (14 No firmalarinin kaynagi)
  const { data: activeSubeler, error: subeErr } = await admin
    .from("subeler")
    .select("id, ad, kod")
    .eq("aktif", true)

  if (subeErr) return NextResponse.json({ error: subeErr.message }, { status: 500 })

  const onDortSube = (activeSubeler || []).find((item: any) => {
    const ad = normalizeSubeName(item.ad || "").replace(/\s+/g, "")
    const kod = normalizeSubeName(item.kod || "").replace(/\s+/g, "")
    return kod === "14" || ad === "14" || ad.includes("14no") || ad.includes("14numara")
  })

  // 14 No subesindeki firmalari ve/veya aktif gelir firmalarini getir
  const targetSubeId = onDortSube?.id || sube.id
  const { data: firmalarData, error: firmaErr } = await admin
    .from("gelir_firmalar")
    .select("id, ad, color, sira")
    .eq("sube_id", targetSubeId)
    .eq("aktif", true)
    .order("sira", { ascending: true })

  if (firmaErr) return NextResponse.json({ error: firmaErr.message }, { status: 500 })

  // Web komisyon kayitlarini getir (ilgili yil icin - tum subeler arasi ortak)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const { data: recordsData, error: recordsErr } = await admin
    .from("web_komisyon_kayitlari")
    .select("*")
    .gte("tarih", yearStart)
    .lte("tarih", yearEnd)
    .order("tarih", { ascending: true })

  if (recordsErr) return NextResponse.json({ error: recordsErr.message }, { status: 500 })

  // Deduplicate by ay_yil: pick the record with valid data / most recently updated
  const recordsByAyYil: Record<string, any> = {}
  ;(recordsData || []).forEach((rec: any) => {
    const existing = recordsByAyYil[rec.ay_yil]
    if (!existing) {
      recordsByAyYil[rec.ay_yil] = rec
    } else {
      const existingTotal = Number(existing.toplam_komisyon) || 0
      const currentTotal = Number(rec.toplam_komisyon) || 0
      if (currentTotal > 0 && existingTotal === 0) {
        recordsByAyYil[rec.ay_yil] = rec
      } else if (currentTotal > 0 && existingTotal > 0) {
        if (new Date(rec.updated_at) > new Date(existing.updated_at)) {
          recordsByAyYil[rec.ay_yil] = rec
        }
      }
    }
  })

  return NextResponse.json({
    sube,
    isAdmin: true,
    firmalar: firmalarData || [],
    records: Object.values(recordsByAyYil),
  })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAccess()
  if (!user || profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const isAdmin = Boolean(profile?.is_admin || profile?.is_developer)
  if (!isAdmin) {
    return NextResponse.json({ error: "Web Komisyon kaydı için yönetici yetkisi gereklidir." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const requestedSubeId = String(body.subeId || "")
  const records = Array.isArray(body.records) ? body.records : [body]
  const admin = createAdminClient()

  const { sube } = await resolveSube(admin, requestedSubeId, profile)
  if (!sube) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 })

  // Check existing records for these ay_yil values across all subes
  const ayYilList = records.map((r: any) => r.ay_yil).filter(Boolean)
  const { data: existingRecords } = await admin
    .from("web_komisyon_kayitlari")
    .select("id, sube_id, ay_yil")
    .in("ay_yil", ayYilList)

  const existingMap = new Map<string, { id: string; sube_id: string }>()
  ;(existingRecords || []).forEach((r: any) => {
    if (!existingMap.has(r.ay_yil)) {
      existingMap.set(r.ay_yil, { id: r.id, sube_id: r.sube_id })
    }
  })

  const upsertPayloads = records.map((rec: any) => {
    const firmaDegerleri = typeof rec.firma_degerleri === "object" && rec.firma_degerleri !== null
      ? rec.firma_degerleri
      : {}

    const total = Object.values(firmaDegerleri).reduce(
      (sum: number, val: any) => sum + (Number(val) || 0),
      0
    )

    const existing = existingMap.get(rec.ay_yil)

    const payload: any = {
      sube_id: existing?.sube_id || sube.id,
      tarih: rec.tarih,
      ay_yil: rec.ay_yil,
      firma_degerleri: firmaDegerleri,
      toplam_komisyon: total,
      notlar: rec.notlar || null,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      payload.id = existing.id
    }

    return payload
  })

  const { data, error } = await admin
    .from("web_komisyon_kayitlari")
    .upsert(upsertPayloads)
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, count: data?.length || 0 })
}
