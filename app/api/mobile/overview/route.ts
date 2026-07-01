import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getLocalDateString } from "@/lib/date-navigation"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("sube_id, display_name, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile || profile.dashboard_access === false) return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })

  let subeId = profile.sube_id as string | null
  if (!subeId) {
    const { data: firstBranch } = await admin.from("subeler").select("id").eq("aktif", true).order("ad").limit(1).maybeSingle()
    subeId = firstBranch?.id || null
  }
  if (!subeId) return NextResponse.json({ error: "Şube bulunamadı." }, { status: 404 })

  const today = getLocalDateString()
  const [{ data: branch }, { data: gelir, error: gelirError }, { data: gider, error: giderError }] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("id", subeId).maybeSingle(),
    admin.from("gelir_kayitlari").select("toplam").eq("sube_id", subeId).eq("tarih", today),
    admin.from("gider_kayitlari").select("genel_toplam").eq("sube_id", subeId).eq("tarih", today),
  ])

  if (gelirError || giderError) {
    return NextResponse.json({ error: gelirError?.message || giderError?.message }, { status: 500 })
  }

  const toplamGelir = (gelir || []).reduce((sum, row) => sum + Number(row.toplam || 0), 0)
  const toplamGider = (gider || []).reduce((sum, row) => sum + Number(row.genel_toplam || 0), 0)
  return NextResponse.json({
    date: today,
    branch,
    displayName: profile.display_name || user.email || "Kullanıcı",
    toplamGelir,
    toplamGider,
    kalan: toplamGelir - toplamGider,
  }, { headers: { "Cache-Control": "no-store" } })
}

