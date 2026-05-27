import "server-only"

import bcrypt from "bcryptjs"
import { Role } from "@prisma/client"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"
import { createQrToken } from "@/lib/qr-attendance/qr"
import { normalizeTcKimlik } from "@/lib/tc-kimlik"

type RealUserProfile = {
  user_id: string
  email: string | null
  tc_kimlik: string | null
  is_admin: boolean | null
  vardiya: string | null
}

function getAnonSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase URL veya anon anahtari eksik.")
  }

  return createSupabaseClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function ensureDefaultShifts() {
  const shifts = [
    { name: "Sabah Vardiyasi", startMinute: 6 * 60, endMinute: 16 * 60 },
    { name: "Aksam Vardiyasi", startMinute: 16 * 60, endMinute: 2 * 60 },
    { name: "Ara Vardiya", startMinute: 11 * 60, endMinute: 21 * 60 },
  ]

  for (const shift of shifts) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      create: shift,
      update: shift,
    })
  }
}

async function shiftIdForCode(code?: string | null) {
  await ensureDefaultShifts()
  const normalized = String(code || "").toUpperCase()
  const name = normalized === "A" ? "Aksam Vardiyasi" : normalized === "R" ? "Ara Vardiya" : normalized === "S" ? "Sabah Vardiyasi" : null
  if (!name) return null

  const shift = await prisma.shift.findUnique({ where: { name } })
  return shift?.id ?? null
}

function displayNameForProfile(profile: RealUserProfile, authUser?: { user_metadata?: Record<string, unknown>; email?: string }) {
  const metadataName = String(authUser?.user_metadata?.display_name || "").trim()
  if (metadataName) return metadataName
  if (authUser?.email) return authUser.email.split("@")[0] || authUser.email
  if (profile.email) return profile.email.split("@")[0] || profile.email
  return profile.tc_kimlik || "Personel"
}

export async function getRealProfileByTc(tcKimlik: string) {
  const admin = createAdminClient()
  const normalizedTc = normalizeTcKimlik(tcKimlik)

  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("user_id, email, tc_kimlik, is_admin, vardiya")
    .eq("tc_kimlik", normalizedTc)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!profile?.user_id) return null

  const { data: authUser } = await admin.auth.admin.getUserById(profile.user_id)
  return { profile: profile as RealUserProfile, authUser: authUser.user || null }
}

export async function verifyRealUserPassword(email: string, password: string) {
  const supabase = getAnonSupabaseClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

export async function syncRealProfileToAttendanceUser(profile: RealUserProfile, authUser?: { user_metadata?: Record<string, unknown>; email?: string } | null) {
  const tcKimlik = normalizeTcKimlik(profile.tc_kimlik)
  if (!tcKimlik) return null

  const passwordHash = await bcrypt.hash("supabase-auth-managed", 12)
  const shiftId = await shiftIdForCode(profile.vardiya)
  const role = profile.is_admin ? Role.ADMIN : Role.PERSONNEL
  const name = displayNameForProfile(profile, authUser || undefined)

  return prisma.user.upsert({
    where: { tcKimlik },
    create: {
      tcKimlik,
      name,
      role,
      shiftId,
      passwordHash,
      qrToken: createQrToken(),
      isActive: true,
    },
    update: {
      name,
      role,
      shiftId,
      isActive: true,
    },
  })
}

export async function syncAllRealUsersToAttendance() {
  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from("user_profiles")
    .select("user_id, email, tc_kimlik, is_admin, vardiya")
    .not("tc_kimlik", "is", null)

  if (error) throw new Error(error.message)

  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const authById = new Map((authData?.users || []).map((user) => [user.id, user]))
  const activeTcKimliks: string[] = []

  for (const profile of (profiles || []) as RealUserProfile[]) {
    const tcKimlik = normalizeTcKimlik(profile.tc_kimlik)
    if (!tcKimlik) continue
    activeTcKimliks.push(tcKimlik)
    await syncRealProfileToAttendanceUser(profile, authById.get(profile.user_id))
  }

  await prisma.user.updateMany({
    where: {
      tcKimlik: { notIn: activeTcKimliks.length ? activeTcKimliks : ["__none__"] },
    },
    data: { isActive: false },
  })
}
