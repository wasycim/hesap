import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Borç özetini sadece yöneticiler görebilir." }, { status: 403 })
  }

  const [
    { data: branch },
    { data: personeller },
    { data: ortaklar },
    { data: giderRows }
  ] = await Promise.all([
    admin.from("subeler").select("id, ad, kod").eq("id", profile.sube_id).maybeSingle(),
    admin.from("personeller").select("id, ad").eq("sube_id", profile.sube_id),
    admin.from("ortaklar").select("id, ad").eq("sube_id", profile.sube_id),
    admin.from("gider_kayitlari").select("tarih, personel_paylari, ortak_pilarim").eq("sube_id", profile.sube_id),
  ])

  const personelDebtMap = new Map<string, number>()
  const ortakDebtMap = new Map<string, number>()

  for (const row of giderRows || []) {
    if (row.personel_paylari) {
      Object.entries(row.personel_paylari as Record<string, unknown>).forEach(([pId, amt]) => {
        personelDebtMap.set(pId, (personelDebtMap.get(pId) || 0) + (Number(amt) || 0))
      })
    }
    if (row.ortak_pilarim) {
      Object.entries(row.ortak_pilarim as Record<string, unknown>).forEach(([oId, amt]) => {
        ortakDebtMap.set(oId, (ortakDebtMap.get(oId) || 0) + (Number(amt) || 0))
      })
    }
  }

  const personelDebts = (personeller || [])
    .map((p) => ({ id: p.id, name: p.ad, totalAdvance: personelDebtMap.get(p.id) || 0 }))
    .filter((p) => p.totalAdvance > 0)
    .sort((a, b) => b.totalAdvance - a.totalAdvance)

  const ortakDebts = (ortaklar || [])
    .map((o) => ({ id: o.id, name: o.ad, totalWithdrawal: ortakDebtMap.get(o.id) || 0 }))
    .filter((o) => o.totalWithdrawal > 0)
    .sort((a, b) => b.totalWithdrawal - a.totalWithdrawal)

  const totalPersonelAdvances = personelDebts.reduce((sum, p) => sum + p.totalAdvance, 0)
  const totalOrtakWithdrawals = ortakDebts.reduce((sum, o) => sum + o.totalWithdrawal, 0)

  return NextResponse.json({
    branch,
    totals: {
      totalPersonelAdvances,
      totalOrtakWithdrawals,
      grandTotal: totalPersonelAdvances + totalOrtakWithdrawals,
    },
    personelDebts,
    ortakDebts,
  })
}
