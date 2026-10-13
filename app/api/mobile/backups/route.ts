import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Yedekleme ve logları sadece yöneticiler görebilir." }, { status: 403 })
  }

  const [{ data: logs }, { data: backups }] = await Promise.all([
    admin.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(30),
    admin.from("backup_logs").select("*").order("created_at", { ascending: false }).limit(20),
  ])

  return NextResponse.json({
    logs: logs || [],
    backups: backups || [],
  })
}

export async function POST(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, is_admin, is_developer")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile || (!profile.is_admin && !profile.is_developer)) {
    return NextResponse.json({ error: "Yedek alma yetkiniz bulunmuyor." }, { status: 403 })
  }

  const subeId = profile.sube_id

  const [
    { data: sube },
    { data: personeller },
    { data: giderRows },
    { data: gelirRows },
    { data: corbaRows }
  ] = await Promise.all([
    admin.from("subeler").select("*").eq("id", subeId).maybeSingle(),
    admin.from("personeller").select("*").eq("sube_id", subeId),
    admin.from("gider_kayitlari").select("*").eq("sube_id", subeId),
    admin.from("gelir_kayitlari").select("*").eq("sube_id", subeId),
    admin.from("corbalar").select("*").eq("sube_id", subeId),
  ])

  const backupData = {
    version: "4.0.0",
    createdAt: new Date().toISOString(),
    createdBy: user.id,
    branch: sube,
    tables: {
      personeller: personeller || [],
      gider_kayitlari: giderRows || [],
      gelir_kayitlari: gelirRows || [],
      corbalar: corbaRows || [],
    },
  }

  // Log backup event
  await admin.from("audit_logs").insert({
    user_id: user.id,
    action: "mobile_backup_create",
    details: { branch_id: subeId, timestamp: new Date().toISOString() },
  })

  return NextResponse.json({
    filename: `hesap_backup_${sube?.kod || "sube"}_${new Date().toISOString().slice(0, 10)}.json`,
    backup: backupData,
  })
}
