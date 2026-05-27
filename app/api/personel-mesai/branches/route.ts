import { NextResponse } from "next/server"
import { requireAnyMesaiAdmin } from "@/lib/qr-attendance/admin"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET() {
  const session = await requireAnyMesaiAdmin()

  if (!session.ok) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("subeler")
    .select("id, ad, kod")
    .eq("aktif", true)
    .order("ad")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ branches: data || [] })
}

