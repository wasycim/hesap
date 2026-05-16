import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidTcKimlik, normalizeTcKimlik } from "@/lib/tc-kimlik"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarasi hatali." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("email")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data?.email) {
    return NextResponse.json({ error: "Bu TC ile kayitli kullanici bulunamadi." }, { status: 404 })
  }

  return NextResponse.json({ email: data.email })
}
