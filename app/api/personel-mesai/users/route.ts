import { NextRequest, NextResponse } from "next/server"
import { requireAnyMesaiAdmin } from "@/lib/qr-attendance/admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolvePersonelDashboardShift, todayInIstanbul } from "@/lib/qr-attendance/dashboard-vardiya"

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR")
}

export async function GET(request: NextRequest) {
  const session = await requireAnyMesaiAdmin()

  if (!session.ok) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const subeId = request.nextUrl.searchParams.get("subeId")
  const date = request.nextUrl.searchParams.get("date") || todayInIstanbul()
  const admin = createAdminClient()

  let personelQuery = admin
    .from("personeller")
    .select("id, ad, aktif, sube_id, sira, sabit_vardiya")
    .eq("aktif", true)
    .order("sira", { ascending: true })
    .order("ad", { ascending: true })

  if (subeId && subeId !== "all") {
    personelQuery = personelQuery.eq("sube_id", subeId)
  }

  const [{ data: personeller, error: personelError }, { data: branches, error: branchError }, { data: profiles, error: profileError }] = await Promise.all([
    personelQuery,
    admin.from("subeler").select("id, ad, kod").eq("aktif", true),
    admin.from("user_profiles").select("display_name, tc_kimlik, sube_id, is_admin"),
  ])

  if (personelError) {
    return NextResponse.json({ error: personelError.message }, { status: 500 })
  }
  if (branchError) {
    return NextResponse.json({ error: branchError.message }, { status: 500 })
  }
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const branchById = new Map((branches || []).map((branch) => [branch.id, branch]))
  const profileByBranchAndName = new Map(
    (profiles || []).map((profile) => [
      `${profile.sube_id || ""}:${normalizeName(profile.display_name)}`,
      profile,
    ]),
  )

  const users = await Promise.all((personeller || []).map(async (personel) => {
    const branch = branchById.get(personel.sube_id)
    const profile = profileByBranchAndName.get(`${personel.sube_id || ""}:${normalizeName(personel.ad)}`)
    const shift = await resolvePersonelDashboardShift({
      subeId: personel.sube_id,
      personelId: personel.id,
      date,
      fallbackCode: personel.sabit_vardiya,
    }).catch(() => null)

    return {
      id: String(personel.id),
      tcKimlik: profile?.tc_kimlik || "-",
      name: personel.ad,
      role: profile?.is_admin ? "ADMIN" : "PERSONNEL",
      branch: branch ? { id: branch.id, ad: branch.ad, kod: branch.kod } : null,
      shift: shift ? {
        id: shift.code,
        name: shift.name,
        symbol: shift.symbol,
        label: shift.label,
      } : null,
    }
  }))

  return NextResponse.json({ users })
}

