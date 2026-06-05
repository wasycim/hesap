import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const allPermissionKeys = [
  "dashboard",
  "gelir",
  "gider",
  "vardiya",
  "mesai",
  "mesai_takip",
  "corbalar",
  "kargo_cari",
  "on_dort_no",
  "maaslar",
  "bildirim_gonder",
  "sube_ciro_raporlari",
  "sutun_ayarlar",
  "gorunum_ayarlar",
  "ayarlar",
  "guvenlik_ayarlar",
  "gelismis_log",
  "sistem_sagligi",
  "admin_ayarlar",
  "lisanslar",
  "operasyon",
  "log_backup",
  "cay",
  "bildirimler",
  "hesap",
]

function defaultsForRole(role: "developer" | "admin" | "user") {
  const permissions = Object.fromEntries(allPermissionKeys.map((key) => [key, false])) as Record<string, boolean>
  if (role === "developer") {
    for (const key of allPermissionKeys) permissions[key] = true
    return permissions
  }
  if (role === "admin") {
    for (const key of allPermissionKeys) permissions[key] = true
    permissions.gelismis_log = false
    permissions.sistem_sagligi = false
    permissions.lisanslar = false
    permissions.operasyon = false
    permissions.log_backup = false
    return permissions
  }

  permissions.dashboard = true
  permissions.gelir = true
  permissions.gider = true
  permissions.corbalar = true
  permissions.kargo_cari = true
  permissions.vardiya = true
  permissions.mesai = true
  permissions.mesai_takip = true
  permissions.bildirimler = true
  permissions.hesap = true
  return permissions
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ permissions: {}, role: "guest" })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("is_admin, is_developer, dashboard_access")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })

  const role = profile?.is_developer ? "developer" : profile?.is_admin ? "admin" : "user"
  const permissions = defaultsForRole(role)
  if (profile?.dashboard_access === false) {
    return NextResponse.json({ role, permissions: {}, keys: allPermissionKeys })
  }

  const { data: overrides } = await admin
    .from("dashboard_permission_overrides")
    .select("scope_type, role_key, user_id, permission_key, allowed, active, created_at")
    .eq("active", true)
    .or(`scope_type.eq.role,user_id.eq.${user.id}`)
    .order("created_at", { ascending: true })

  for (const override of overrides || []) {
    const key = String(override.permission_key || "")
    if (!key || !(key in permissions)) continue
    if (override.scope_type === "role" && override.role_key === role) {
      permissions[key] = Boolean(override.allowed)
    }
    if (override.scope_type === "user" && override.user_id === user.id) {
      permissions[key] = Boolean(override.allowed)
    }
  }

  const { data: teaSetting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "tea_module")
    .maybeSingle()

  const teaEnabled = Boolean((teaSetting?.value as { enabled?: boolean } | null)?.enabled)
  if (!teaEnabled) permissions.cay = false

  return NextResponse.json({
    role,
    permissions,
    keys: allPermissionKeys,
    features: {
      tea: teaEnabled,
    },
  })
}
