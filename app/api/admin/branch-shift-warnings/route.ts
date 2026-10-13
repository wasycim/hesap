import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return false

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .single()

  return Boolean(profile?.is_admin)
}

export async function GET() {
  const isAdmin = await requireAdmin()

  if (!isAdmin) {
    return NextResponse.json({ error: "Yetkisiz işlem." }, { status: 403 })
  }

  const admin = createAdminClient()
  const [{ data: branches, error: branchError }, { data: profiles, error: profileError }] = await Promise.all([
    admin.from("subeler").select("id, ad").eq("aktif", true),
    admin.from("user_profiles").select("sube_id, vardiya"),
  ])

  if (branchError || profileError) {
    return NextResponse.json({ error: branchError?.message || profileError?.message }, { status: 500 })
  }

  const shiftsByBranch = new Map<string, Set<string>>()
  ;(profiles || []).forEach(profile => {
    if (!profile.sube_id) return
    const shifts = shiftsByBranch.get(profile.sube_id) || new Set<string>()
    if (profile.vardiya === "S" || profile.vardiya === "A") {
      shifts.add(profile.vardiya)
    }
    shiftsByBranch.set(profile.sube_id, shifts)
  })

  const warnings = (branches || []).flatMap(branch => {
    const shifts = shiftsByBranch.get(branch.id) || new Set<string>()
    if (shifts.has("S") && !shifts.has("A")) {
      return [{
        sube_id: branch.id,
        sube_ad: branch.ad,
        missing_shift: "A",
        message: `${branch.ad} şubesi için akşam vardiyası eklemediniz!`,
      }]
    }
    if (shifts.has("A") && !shifts.has("S")) {
      return [{
        sube_id: branch.id,
        sube_ad: branch.ad,
        missing_shift: "S",
        message: `${branch.ad} şubesi için sabah vardiyası eklemediniz!`,
      }]
    }
    return []
  })

  return NextResponse.json({ warnings })
}

