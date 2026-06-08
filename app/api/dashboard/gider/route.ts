import { NextRequest, NextResponse } from "next/server"
import { isDateInSelectedMonth } from "@/lib/date-navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getShiftBusinessDate } from "@/lib/shift-business-date"

const VARDIYASIZ_SUBELER = ["carsi", "darica"]

function normalizeSubeName(name: string): string {
  return name.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\u0131/g, "i")
}

function getGiderTotalKey(tarih: string, vardiya: string, isTekVardiya: boolean) {
  return isTekVardiya ? tarih : `${tarih}__${vardiya || "S"}`
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

function isSingleShiftBranch(subeName: string, isAdmin: boolean, userVardiya: string | null | undefined) {
  return VARDIYASIZ_SUBELER.includes(normalizeSubeName(subeName)) || (!isAdmin && (!userVardiya || userVardiya === "T"))
}

export async function GET(request: NextRequest) {
  const { user, profile } = await getAccess()
  if (!user || profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const searchParams = request.nextUrl.searchParams
  const month = searchParams.get("month") || ""
  const year = Number(searchParams.get("year")) || new Date().getFullYear()
  const ayYil = searchParams.get("ayYil") || `${month}-${year}`
  const requestedSubeId = searchParams.get("subeId")
  const admin = createAdminClient()

  const { sube, isAdmin } = await resolveSube(admin, requestedSubeId, profile)
  if (!sube) return NextResponse.json({ error: "Sube bulunamadi." }, { status: 404 })

  const isTekVardiya = isSingleShiftBranch(sube.ad, isAdmin, profile?.vardiya)

  const [settingsRes, ortakRes, personelRes, giderRes] = await Promise.all([
    admin
      .from("kolon_ayarlari")
      .select("*")
      .eq("sube_id", sube.id)
      .eq("table_type", "gider")
      .order("sort_order", { ascending: true }),
    admin
      .from("ortaklar")
      .select("id, ad")
      .eq("sube_id", sube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true }),
    admin
      .from("personeller")
      .select("id, ad")
      .eq("sube_id", sube.id)
      .eq("aktif", true)
      .order("sira", { ascending: true }),
    admin
      .from("gider_kayitlari")
      .select("*")
      .eq("sube_id", sube.id)
      .eq("ay_yil", ayYil)
      .order("tarih", { ascending: true })
      .order("vardiya", { ascending: true }),
  ])

  for (const result of [settingsRes, ortakRes, personelRes, giderRes]) {
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  }

  const rows = (giderRes.data || [])
    .filter((row: any) => isDateInSelectedMonth(row.tarih, month, year))
    .map((row: any) => {
      const mesaiDetails = (row.personel_mesai_detaylari || {}) as Record<string, unknown>
      const mesaiTotal = Object.values(mesaiDetails).reduce<number>((sum, amount) => sum + (Number(amount) || 0), 0)

      return {
        id: row.id,
        user_id: row.user_id,
        sube_id: row.sube_id,
        tarih: row.tarih,
        vardiya: isTekVardiya ? "" : (row.vardiya || "S"),
        el_fisi_odeme: Number(row.el_fisi_odeme) || 0,
        ortak_paylari: row.ortak_pilarim || {},
        personel_paylari: row.personel_paylari || {},
        personel_mesai: mesaiTotal || Number(row.personel_mesai) || 0,
        personel_mesai_detaylari: mesaiDetails,
        bil_iade: Number(row.bil_iade) || 0,
        inegol_donus: Number(row.inegol_donus) || 0,
        pk_kredi_karti: Number(row.pk_kredi_karti) || 0,
        yemek: Number(row.yemek) || 0,
        yanmaz_bilet: Number(row.yanmaz_bilet) || 0,
        diger: Number(row.diger) || 0,
        ziraat_bankasi: Number(row.ziraat_bankasi) || 0,
        is_bankasi: Number(row.is_bankasi) || 0,
        kuveyt_turk: Number(row.kuveyt_turk) || 0,
        bakiye_bilet: Number(row.bakiye_bilet) || 0,
        kargo_cari: Number(row.kargo_cari) || 0,
        hesaba_gelen: Number(row.hesaba_gelen) || 0,
        on_dort_noya_giden: Number(row.on_dort_noya_giden) || 0,
        carsi_bilet: Number(row.carsi_bilet) || 0,
        darica_bilet: Number(row.darica_bilet) || 0,
        kredi_karti_bakiye: Number(row.kredi_karti_bakiye) || 0,
        bankaya_yatan: Number(row.bankaya_yatan) || 0,
        genel_toplam: Number(row.genel_toplam) || 0,
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
    ortaklar: ortakRes.data || [],
    personeller: personelRes.data || [],
    rows,
  })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getAccess()
  if (!user || profile?.dashboard_access === false) {
    return NextResponse.json({ error: "Yetkisiz islem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const month = String(body.month || "")
  const year = Number(body.year) || new Date().getFullYear()
  const ayYil = String(body.ayYil || `${month}-${year}`)
  const rows = Array.isArray(body.rows) ? body.rows : []
  const admin = createAdminClient()
  const { sube, isAdmin } = await resolveSube(admin, String(body.subeId || ""), profile)

  if (!sube) return NextResponse.json({ error: "Sube bulunamadi." }, { status: 404 })

  const isTekVardiya = isSingleShiftBranch(sube.ad, isAdmin, profile?.vardiya)
  const today = getShiftBusinessDate(profile?.vardiya)
  const editableRows = rows.filter((row: any) => {
    if (!isDateInSelectedMonth(String(row.tarih || ""), month, year)) return false
    if (!isAdmin && row.tarih !== today) return false
    if (isTekVardiya || isAdmin) return true
    return row.vardiya === profile?.vardiya
  })

  let deleteQuery = admin
    .from("gider_kayitlari")
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

  if (editableRows.length > 0) {
    const insertData = editableRows.map((row: any) => ({
      user_id: row.user_id || user.id,
      sube_id: sube.id,
      ay_yil: ayYil,
      tarih: row.tarih,
      vardiya: row.vardiya || "",
      el_fisi_odeme: Number(row.el_fisi_odeme) || 0,
      ortak_pilarim: row.ortak_paylari || {},
      personel_paylari: row.personel_paylari || {},
      personel_mesai: Number(row.personel_mesai) || 0,
      personel_mesai_detaylari: row.personel_mesai_detaylari || {},
      bil_iade: Number(row.bil_iade) || 0,
      inegol_donus: Number(row.inegol_donus) || 0,
      pk_kredi_karti: Number(row.pk_kredi_karti) || 0,
      yemek: Number(row.yemek) || 0,
      yanmaz_bilet: Number(row.yanmaz_bilet) || 0,
      diger: Number(row.diger) || 0,
      ziraat_bankasi: Number(row.ziraat_bankasi) || 0,
      is_bankasi: Number(row.is_bankasi) || 0,
      kuveyt_turk: Number(row.kuveyt_turk) || 0,
      bakiye_bilet: Number(row.bakiye_bilet) || 0,
      kargo_cari: Number(row.kargo_cari) || 0,
      hesaba_gelen: Number(row.hesaba_gelen) || 0,
      on_dort_noya_giden: Number(row.on_dort_noya_giden) || 0,
      carsi_bilet: Number(row.carsi_bilet) || 0,
      darica_bilet: Number(row.darica_bilet) || 0,
      kredi_karti_bakiye: Number(row.kredi_karti_bakiye) || 0,
      bankaya_yatan: Number(row.bankaya_yatan) || 0,
      genel_toplam: Number(row.genel_toplam) || 0,
      custom_values: row.custom_values || {},
    }))

    const { error } = await admin.from("gider_kayitlari").insert(insertData)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await syncGelirGiderTotals(admin, sube.id, ayYil, isTekVardiya)

  return NextResponse.json({ ok: true, saved: editableRows.length })
}

async function syncGelirGiderTotals(admin: ReturnType<typeof createAdminClient>, subeId: string, ayYil: string, isTekVardiya: boolean) {
  const { data: giderRows, error: giderError } = await admin
    .from("gider_kayitlari")
    .select("tarih, vardiya, genel_toplam")
    .eq("sube_id", subeId)
    .eq("ay_yil", ayYil)

  if (giderError) throw new Error(giderError.message)

  const totalsByDate = new Map<string, number>()
  ;(giderRows || []).forEach((row: any) => {
    const key = getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)
    totalsByDate.set(key, (totalsByDate.get(key) || 0) + (Number(row.genel_toplam) || 0))
  })

  const { data: gelirRows, error: gelirError } = await admin
    .from("gelir_kayitlari")
    .select("id, tarih, vardiya, toplam")
    .eq("sube_id", subeId)
    .eq("ay_yil", ayYil)

  if (gelirError) throw new Error(gelirError.message)

  for (const row of gelirRows || []) {
    const giderler = totalsByDate.get(getGiderTotalKey(row.tarih, row.vardiya || "S", isTekVardiya)) || 0
    const { error } = await admin
      .from("gelir_kayitlari")
      .update({
        giderler,
        kalan: (Number(row.toplam) || 0) - giderler,
      })
      .eq("id", row.id)

    if (error) throw new Error(error.message)
  }
}
