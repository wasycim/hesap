import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidTcKimlik, normalizeTcKimlik } from "@/lib/tc-kimlik"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const tcKimlik = normalizeTcKimlik(body.tcKimlik)

  if (!isValidTcKimlik(tcKimlik)) {
    return NextResponse.json({ error: "TC kimlik numarası hatalı." }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("user_profiles")
    .select("user_id, email")
    .eq("tc_kimlik", tcKimlik)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data?.user_id) {
    const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const matchedUser = (authData?.users || []).find(user => normalizeTcKimlik(user.user_metadata?.tc_kimlik) === tcKimlik)
    const matchedEmail = matchedUser?.email

    if (!matchedEmail) {
      return NextResponse.json({ error: "Bu TC ile kayıtlı kullanıcı bulunamadı." }, { status: 404 })
    }

    return NextResponse.json({ email: matchedEmail })
  }

  if (data.email) {
    return NextResponse.json({ email: data.email })
  }

  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(data.user_id)

  if (authError || !authUser.user?.email) {
    return NextResponse.json({ error: "Bu TC ile kayıtlı kullanıcı e-postası bulunamadı." }, { status: 404 })
  }

  return NextResponse.json({ email: authUser.user.email })
}
