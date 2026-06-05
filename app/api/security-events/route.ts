import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

function getClientIp(request: NextRequest) {
  const vercelForwarded = request.headers.get("x-vercel-forwarded-for")
  if (vercelForwarded) return vercelForwarded.split(",")[0]?.trim() || null
  const cfConnecting = request.headers.get("cf-connecting-ip")
  if (cfConnecting) return cfConnecting
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() || null
  return request.headers.get("x-real-ip") || request.headers.get("x-client-ip")
}

function normalizeTrustedIps(value: unknown) {
  const rawItems = Array.isArray(value) ? value : String(value || "").split(/[\n,; ]+/)
  return Array.from(new Set(rawItems.map(item => String(item).trim()).filter(Boolean)))
}

function cleanSearchFilter(value: string | null) {
  return String(value || "").trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").slice(0, 80)
}

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

async function getCurrentUserAndProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null }
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin, is_developer, email")
    .eq("user_id", user.id)
    .single()

  return { user, profile }
}

export async function GET(request: NextRequest) {
  const { profile } = await getCurrentUserAndProfile()
  const searchParams = request.nextUrl.searchParams
  const scope = String(searchParams.get("scope") || "").trim()
  const canReadSecurityScope = scope === "security" && Boolean(profile?.is_admin || profile?.is_developer)

  if (!profile?.is_developer && !canReadSecurityScope) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 25), 250)
  const page = Math.max(Number(searchParams.get("page")) || 1, 1)
  const from = (page - 1) * limit
  const to = from + limit - 1
  const eventType = String(searchParams.get("eventType") || "").trim()
  const search = cleanSearchFilter(searchParams.get("query"))
  const fromDate = searchParams.get("from")
  const toDate = searchParams.get("to")

  const admin = createAdminClient()
  let query = admin
    .from("security_events")
    .select("*", { count: "exact" })

  if (eventType && eventType !== "all") {
    query = query.eq("event_type", eventType)
  }
  if (isIsoDate(fromDate)) {
    query = query.gte("created_at", `${fromDate}T00:00:00.000Z`)
  }
  if (isIsoDate(toDate)) {
    query = query.lte("created_at", `${toDate}T23:59:59.999Z`)
  }
  if (search) {
    query = query.or(`event_type.ilike.%${search}%,user_email.ilike.%${search}%,ip_address.ilike.%${search}%`)
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)

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
  const trustedIpsById = new Map((authData?.users || []).map(user => [
    user.id,
    normalizeTrustedIps(user.user_metadata?.trusted_ips),
  ]))
  const trustedIpsByEmail = new Map((authData?.users || []).map(user => [
    String(user.email || "").toLowerCase(),
    normalizeTrustedIps(user.user_metadata?.trusted_ips),
  ]))
  const trustedIpOwners = new Map<string, Array<{ user_id: string; email: string | null; display_name: string }>>()
  ;(authData?.users || []).forEach(user => {
    const displayName = String(user.user_metadata?.display_name || user.email || "").trim()
    normalizeTrustedIps(user.user_metadata?.trusted_ips).forEach(ip => {
      const owners = trustedIpOwners.get(ip) || []
      owners.push({
        user_id: user.id,
        email: user.email || null,
        display_name: displayName,
      })
      trustedIpOwners.set(ip, owners)
    })
  })
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
    const trustedIps = trustedIpsById.get(event.user_id) || trustedIpsByEmail.get(email) || []
    const matchingOwners = event.ip_address ? trustedIpOwners.get(event.ip_address) || [] : []
    return {
      ...event,
      user_display_name: displayNameById.get(event.user_id) || displayNameByEmail.get(email) || null,
      branch_name: branchById.get(detailBranchId) || details.sube_ad || details.branch_name || branchByUserId.get(event.user_id) || branchByEmail.get(email) || null,
      trusted_ips: trustedIps,
      is_trusted_ip: Boolean(event.ip_address && trustedIps.includes(event.ip_address)),
      trusted_ip_owners: matchingOwners.filter(owner => owner.user_id !== event.user_id && String(owner.email || "").toLowerCase() !== email),
    }
  })

  const total = count || 0
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return NextResponse.json({ events, page, limit, total, totalPages, hasMore: page < totalPages })
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
