import { NextRequest, NextResponse } from "next/server"
import { requireAnyMesaiAdmin } from "@/lib/qr-attendance/admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDashboardShiftCatalog } from "@/lib/qr-attendance/dashboard-vardiya"

export async function GET(request: NextRequest) {
  const session = await requireAnyMesaiAdmin()

  if (!session.ok) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const subeId = request.nextUrl.searchParams.get("subeId")
  const admin = createAdminClient()
  const branchIds = subeId && subeId !== "all"
    ? [subeId]
    : (await admin.from("subeler").select("id").eq("aktif", true)).data?.map((branch) => branch.id) || []

  const byCode = new Map<string, { id: string; name: string; symbol: string; label: string }>()
  for (const branchId of branchIds) {
    const catalog = await getDashboardShiftCatalog(branchId)
    for (const shift of catalog) {
      const key = `${shift.code}:${shift.label}`
      if (!byCode.has(key)) {
        byCode.set(key, {
          id: shift.code,
          name: shift.name,
          symbol: shift.symbol,
          label: shift.label,
        })
      }
    }
  }

  return NextResponse.json({ shifts: Array.from(byCode.values()) })
}

