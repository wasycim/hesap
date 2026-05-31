import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

type AssignmentInput = {
  personel_id: string
  tarih: string
  vardiya: string
  notlar?: string | null
}


const defaultFixedShifts = [
  { kod: "S", ad: "Sabah", simge: "S", baslangic: "06:00", bitis: "16:00", aktif: true },
  { kod: "A", ad: "Akşam", simge: "A", baslangic: "16:00", bitis: "02:00", aktif: true },
  { kod: "R", ad: "Ara", simge: "R", baslangic: "11:00", bitis: "21:00", aktif: true },
  { kod: "I", ad: "İzin", simge: "İ", baslangic: null, bitis: null, aktif: true },
]

async function requireDashboardAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { user: null, isAdmin: false }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, sube_id")
    .eq("user_id", user.id)
    .single()

  return { user, isAdmin: Boolean(profile?.is_admin), profile }
}

function monthRange(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const first = new Date(Date.UTC(year, monthIndex, 1))
  const last = new Date(Date.UTC(year, monthIndex + 1, 0))

  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  }
}

function dateRange(from: string | null, to: string | null) {
  if (!from || !to) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null
  if (from > to) return null

  return { from, to }
}

export async function GET(request: NextRequest) {
  const { isAdmin } = await requireDashboardAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const subeId = request.nextUrl.searchParams.get("subeId")
  const month = request.nextUrl.searchParams.get("month")
  const range = dateRange(
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  ) || (month ? monthRange(month) : null)

  if (!subeId || !range) {
    return NextResponse.json({ error: "Şube ve ay zorunlu." }, { status: 400 })
  }

  const admin = createAdminClient()
  const [personelRes, planRes, shiftRes, fixedShiftRes] = await Promise.all([
    admin
      .from("personeller")
      .select("*")
      .eq("sube_id", subeId)
      .eq("aktif", true)
      .order("sira", { ascending: true }),
    admin
      .from("vardiya_planlari")
      .select("id, personel_id, tarih, vardiya, notlar")
      .eq("sube_id", subeId)
      .gte("tarih", range.from)
      .lte("tarih", range.to)
      .order("tarih", { ascending: true }),
    admin
      .from("vardiya_tanimlari")
      .select("id, ad, simge, baslangic, bitis, aktif, sira")
      .eq("sube_id", subeId)
      .eq("aktif", true)
      .order("sira", { ascending: true }),
    admin
      .from("vardiya_sabit_ayarlari")
      .select("kod, ad, simge, baslangic, bitis, aktif")
      .eq("sube_id", subeId),
  ])

  if (personelRes.error) {
    return NextResponse.json({ error: personelRes.error.message }, { status: 500 })
  }

  if (planRes.error) {
    return NextResponse.json({ error: planRes.error.message }, { status: 500 })
  }

  if (shiftRes.error) {
    return NextResponse.json({ error: shiftRes.error.message }, { status: 500 })
  }

  if (fixedShiftRes.error) {
    return NextResponse.json({ error: fixedShiftRes.error.message }, { status: 500 })
  }

  const fixedByCode = new Map((fixedShiftRes.data || []).map((row) => [row.kod, row]))
  const fixedShiftDefinitions = defaultFixedShifts
    .map((row) => ({ ...row, ...(fixedByCode.get(row.kod) || {}) }))
    .filter((row) => row.aktif)

  return NextResponse.json({
    personeller: (personelRes.data || []).map((personel) => ({
      id: personel.id,
      ad: personel.ad,
      aktif: personel.aktif,
      sira: personel.sira,
      sabit_vardiya: personel.sabit_vardiya || null,
    })),
    assignments: planRes.data || [],
    fixedShiftDefinitions,
    shiftDefinitions: shiftRes.data || [],
  })
}

export async function POST(request: NextRequest) {
  const { user, isAdmin } = await requireDashboardAdmin()

  if (!user || !isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const subeId = String(body.subeId || "")
  const assignments = Array.isArray(body.assignments) ? body.assignments as AssignmentInput[] : []
  const fixedShifts = Array.isArray(body.fixedShifts) ? body.fixedShifts as FixedShiftInput[] : []

  if (!subeId) {
    return NextResponse.json({ error: "Şube zorunlu." }, { status: 400 })
  }

  const validAssignments = assignments.filter((assignment) => (
    assignment.personel_id &&
    /^\d{4}-\d{2}-\d{2}$/.test(assignment.tarih) &&
    typeof assignment.vardiya === "string" &&
    assignment.vardiya.length <= 80
  ))

  const assignmentKeys = new Map<string, string>()
  for (const assignment of validAssignments) {
    const key = `${assignment.personel_id}__${assignment.tarih}`
    const vardiya = assignment.vardiya.trim()
    const existing = assignmentKeys.get(key)
    if (existing !== undefined && (existing || vardiya)) {
      return NextResponse.json(
        { error: "Aynı personele aynı gün ikinci vardiya atanamaz. Lütfen çakışan günü temizleyip tekrar kaydedin." },
        { status: 409 },
      )
    }
    assignmentKeys.set(key, vardiya)
  }

  const validFixedShifts = fixedShifts.filter((item) => (
    item.personel_id &&
    typeof item.sabit_vardiya === "string" &&
    item.sabit_vardiya.length <= 80
  ))

  const admin = createAdminClient()
  const rowsToUpsert = validAssignments
    .filter((assignment) => assignment.vardiya.trim())
    .map((assignment) => ({
      user_id: user.id,
      sube_id: subeId,
      personel_id: assignment.personel_id,
      tarih: assignment.tarih,
      vardiya: assignment.vardiya.trim(),
      notlar: assignment.notlar || null,
      updated_at: new Date().toISOString(),
    }))

  const rowsToDelete = validAssignments.filter((assignment) => !assignment.vardiya)

  if (rowsToUpsert.length) {
    const { error } = await admin
      .from("vardiya_planlari")
      .upsert(rowsToUpsert, { onConflict: "sube_id,personel_id,tarih" })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  for (const assignment of rowsToDelete) {
    const { error } = await admin
      .from("vardiya_planlari")
      .delete()
      .eq("sube_id", subeId)
      .eq("personel_id", assignment.personel_id)
      .eq("tarih", assignment.tarih)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  for (const item of validFixedShifts) {
    const { error } = await admin
      .from("personeller")
      .update({ sabit_vardiya: item.sabit_vardiya || null })
      .eq("sube_id", subeId)
      .eq("id", item.personel_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
type FixedShiftInput = {
  personel_id: string
  sabit_vardiya: string
}
