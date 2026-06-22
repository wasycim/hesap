import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getLocalDateString, getMonthEndDate, getMonthStartDate } from "@/lib/date-navigation"
import { getFreshAuthUser } from "@/lib/qr-attendance/auth"

async function getAccess() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("user_id, sube_id, is_admin, is_developer, dashboard_access")
      .eq("user_id", user.id)
      .maybeSingle()

    return { user, profile }
  }

  const mesaiUser = await getFreshAuthUser()
  if (!mesaiUser) return { user: null, profile: null }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer, dashboard_access")
    .eq("tc_kimlik", mesaiUser.tcKimlik)
    .maybeSingle()

  return { user: { id: profile?.user_id || String(mesaiUser.id) }, profile }
}

async function resolveSubeId(requestedSubeId: string | null, profile: any) {
  const isAdmin = Boolean(profile?.is_admin || profile?.is_developer)
  const subeId = isAdmin ? requestedSubeId || profile?.sube_id : profile?.sube_id
  return { subeId, isAdmin }
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
  const scope = searchParams.get("scope") === "daily" ? "daily" : "monthly"
  const today = searchParams.get("today") || getLocalDateString()
  const monthStart = getMonthStartDate(month, year)
  const monthEnd = getMonthEndDate(month, year)

  const { subeId, isAdmin } = await resolveSubeId(requestedSubeId, profile)
  if (!subeId) return NextResponse.json({ error: "Sube bulunamadi." }, { status: 404 })

  const admin = createAdminClient()
  let gelirQuery = admin
    .from("gelir_kayitlari")
    .select("toplam")
    .eq("sube_id", subeId)
    .gte("tarih", monthStart)
    .lte("tarih", monthEnd)

  let giderQuery = admin
    .from("gider_kayitlari")
    .select("genel_toplam")
    .eq("sube_id", subeId)
    .gte("tarih", monthStart)
    .lte("tarih", monthEnd)

  if (!isAdmin || scope === "daily") {
    gelirQuery = gelirQuery.eq("tarih", today)
    giderQuery = giderQuery.eq("tarih", today)
  }

  const [{ data: gelirData, error: gelirError }, { data: giderData, error: giderError }] = await Promise.all([
    gelirQuery,
    giderQuery,
  ])

  if (gelirError || giderError) {
    return NextResponse.json(
      { error: gelirError?.message || giderError?.message || "Genel bakis yuklenemedi." },
      { status: 500 },
    )
  }

  const toplamGelir = (gelirData || []).reduce((sum: number, row: any) => sum + (Number(row.toplam) || 0), 0)
  const toplamGider = (giderData || []).reduce((sum: number, row: any) => sum + (Number(row.genel_toplam) || 0), 0)

  return NextResponse.json({
    toplamGelir,
    toplamGider,
    kalan: toplamGelir - toplamGider,
    ayYil,
    scope: !isAdmin || scope === "daily" ? "daily" : "monthly",
  }, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  })
}
