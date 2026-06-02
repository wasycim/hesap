import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const VARDIYASIZ_SUBELER = ["carsi", "darica"]

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

function getGiderTotalKey(tarih: string, vardiya: string, isTekVardiya: boolean) {
  return isTekVardiya ? tarih : `${tarih}__${vardiya || "S"}`
}

function dateInMonth(value: string, month: string, year: number) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false
  const monthNames = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
  ]
  return date.getFullYear() === year && monthNames[date.getMonth()] === month
}

async function getAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, profile: null }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer, dashboard_access, vardiya")
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

  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get("month") || ""
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const ayYil = searchParams.get("ayYil") || `${month}-${year}`
  const requestedSubeId = searchParams.get("subeId")
  const admin = createAdminClient()

  const { sube, isAdmin } = await resolveSube(admin, requestedSubeId, profile)
  if (!sube) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 })

  const isTekVardiya = VARDIYASIZ_SUBELER.includes(normalizeSubeName(sube.ad)) || (!isAdmin && (!profile?.vardiya || profile.vardiya === "T"))

  const [settingsRes, firmaRes, gelirRes, giderRes] = await Promise.all([
    admin
      .from("kolon_ayarlari")
      .select("*")
      .eq("sube_id", sube.id)
      .eq("table_type", "gelir")
      .order("sort_order", { ascending: true }),
    admin
      .from("gelir_firmalar")
      .select("id, ad, color")
      .eq("sube_id", sube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true }),
    admin
      .from("gelir_kayitlari")
      .select("*")
      .eq("sube_id", sube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true }),
    admin
      .from("gider_kayitlari")
      .select("tarih, vardiya, genel_toplam")
      .eq("sube_id", sube.id)
      .eq("ay_yil", ayYil),
  ])

  for (const result of [settingsRes, firmaRes, gelirRes, giderRes]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const giderTotals = new Map<string, number>()
  ;(giderRes.data || []).forEach((row: any) => {
    const key = getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)
    giderTotals.set(key, (giderTotals.get(key) || 0) + (Number(row.genel_toplam) || 0))
  })

  const rows = (gelirRes.data || [])
    .filter((row: any) => dateInMonth(row.tarih, month, year))
    .map((row: any) => {
      const vardiya = isTekVardiya ? "" : (row.vardiya || "S")
      const giderler = giderTotals.get(getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)) ?? (Number(row.giderler) || 0)
      const toplam = Number(row.toplam) || 0
      return {
        id: row.id,
        user_id: row.user_id,
        sube_id: row.sube_id,
        tarih: row.tarih,
        vardiya,
        pamukkale_turizm: Number(row.pamukkale_turizm) || 0,
        anadolu_ulasim: Number(row.anadolu_ulasim) || 0,
        inegol_seyahat: Number(row.inegol_seyahat) || 0,
        alasehir_turizm: Number(row.alasehir_turizm) || 0,
        unlu_1: Number(row.unlu_1) || 0,
        unlu_2: Number(row.unlu_2) || 0,
        pamukkale_kargo: Number(row.pamukkale_kargo) || 0,
        diger_komisyon: Number(row.diger_komisyon) || 0,
        kasa_gelen: Number(row.kasa_gelen) || 0,
        toplam,
        giderler,
        kalan: toplam - giderler,
        durum: row.durum || "KONTROL EDİLMEDİ",
        custom_values: row.custom_values || {},
      }
    })

  return NextResponse.json({
    userId: user.id,
    sube,
    isAdmin,
    userVardiya: profile?.vardiya || null,
    isTekVardiya,
    columnSettings: settingsRes.data || [],
    firmalar: firmaRes.data || [],
    rows,
  })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAccess()
  if (!user || profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const month = String(body.month || "")
  const year = Number(body.year) || new Date().getFullYear()
  const ayYil = String(body.ayYil || `${month}-${year}`)
  const rows = Array.isArray(body.rows) ? body.rows : []
  const admin = createAdminClient()
  const { sube, isAdmin } = await resolveSube(admin, String(body.subeId || ""), profile)

  if (!sube) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 })

  const isTekVardiya = VARDIYASIZ_SUBELER.includes(normalizeSubeName(sube.ad)) || (!isAdmin && (!profile?.vardiya || profile.vardiya === "T"))
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  const editableRows = rows.filter((row: any) => {
    if (!dateInMonth(String(row.tarih || ""), month, year)) return false
    if (!isAdmin && row.tarih !== today) return false
    if (isTekVardiya || isAdmin) return true
    return row.vardiya === profile?.vardiya
  })

  let deleteQuery = admin
    .from("gelir_kayitlari")
    .delete()
    .eq("sube_id", sube.id)
    .eq("ay_yil", ayYil)

  if (!isAdmin) {
    deleteQuery = deleteQuery.eq("user_id", user.id).eq("tarih", today)
  }

  if (!isTekVardiya && profile?.vardiya && !isAdmin) {
    deleteQuery = deleteQuery.eq("vardiya", profile.vardiya)
  }

  const { error: deleteError } = await deleteQuery
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  const { data: giderRows, error: giderError } = await admin
    .from("gider_kayitlari")
    .select("tarih, vardiya, genel_toplam")
    .eq("sube_id", sube.id)
    .eq("ay_yil", ayYil)
  if (giderError) return NextResponse.json({ error: giderError.message }, { status: 500 })

  const giderTotals = new Map<string, number>()
  ;(giderRows || []).forEach((row: any) => {
    const key = getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)
    giderTotals.set(key, (giderTotals.get(key) || 0) + (Number(row.genel_toplam) || 0))
  })

  if (editableRows.length > 0) {
    const insertData = editableRows.map((row: any) => {
      const giderler = giderTotals.get(getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)) || 0
      const customValues = row.custom_values && typeof row.custom_values === "object" ? row.custom_values : {}
      return {
        user_id: row.user_id || user.id,
        sube_id: sube.id,
        ay_yil: ayYil,
        tarih: row.tarih,
        vardiya: row.vardiya || "",
        pamukkale_turizm: Number(row.pamukkale_turizm) || 0,
        anadolu_ulasim: Number(row.anadolu_ulasim) || 0,
        inegol_seyahat: Number(row.inegol_seyahat) || 0,
        alasehir_turizm: Number(row.alasehir_turizm) || 0,
        unlu_1: Number(row.unlu_1) || 0,
        unlu_2: Number(row.unlu_2) || 0,
        pamukkale_kargo: Number(row.pamukkale_kargo) || 0,
        diger_komisyon: Number(row.diger_komisyon) || 0,
        kasa_gelen: Number(row.kasa_gelen) || 0,
        toplam: Number(row.toplam) || 0,
        giderler,
        kalan: (Number(row.toplam) || 0) - giderler,
        durum: String(row.durum || "KONTROL EDİLMEDİ"),
        custom_values: customValues,
      }
    })

    const { error } = await admin.from("gelir_kayitlari").insert(insertData)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, saved: editableRows.length })
}
