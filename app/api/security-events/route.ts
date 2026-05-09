import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || null
  return request.headers.get("x-real-ip")
}

async function getCurrentUserAndProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, email")
    .eq("user_id", user.id)
    .single()

  return { user, profile }
}

export async function GET() {
  const { profile } = await getCurrentUserAndProfile()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const displayNameById = new Map((authData?.users || []).map(user => [
    user.id,
    String(user.user_metadata?.display_name || "").trim(),
  ]))
  const displayNameByEmail = new Map((authData?.users || []).map(user => [
    String(user.email || "").toLowerCase(),
    String(user.user_metadata?.display_name || "").trim(),
  ]))
  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, email, sube_id, subeler:sube_id(ad)")
  const { data: branches } = await admin
    .from("subeler")
    .select("id, ad")

  const branchById = new Map((branches || []).map(branch => [branch.id, branch.ad]))
  const getProfileBranch = (profile: any) => Array.isArray(profile.subeler) ? profile.subeler[0]?.ad : profile.subeler?.ad
  const branchByUserId = new Map((profiles || []).map(profile => [profile.user_id, getProfileBranch(profile)]))
  const branchByEmail = new Map((profiles || []).map(profile => [String(profile.email || "").toLowerCase(), getProfileBranch(profile)]))

  const events = (data || []).map(event => {
    const email = String(event.user_email || "").toLowerCase()
    const details = event.details || {}
    const detailBranchId = details.sube_id || details.branch_id
    return {
      ...event,
      user_display_name: displayNameById.get(event.user_id) || displayNameByEmail.get(email) || null,
      branch_name: branchById.get(detailBranchId) || details.sube_ad || details.branch_name || branchByUserId.get(event.user_id) || branchByEmail.get(email) || null,
    }
  })

  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const { user, profile } = await getCurrentUserAndProfile()
  const body = await request.json().catch(() => ({}))
  const eventType = String(body.eventType || "").trim()

  if (!eventType) {
    return NextResponse.json({ error: "Kayıt tipi gerekli." }, { status: 400 })
  }

  if (!user && eventType !== "failed_login") {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const details = body.details || {}
  const admin = createAdminClient()
  const { error } = await admin.from("security_events").insert({
    user_id: user?.id || null,
    user_email: profile?.email || user?.email || details.email || null,
    event_type: eventType,
    ip_address: getClientIp(request),
    user_agent: request.headers.get("user-agent"),
    details,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
