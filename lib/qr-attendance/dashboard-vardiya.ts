import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { prisma } from "@/lib/prisma"

type FixedShiftDefinition = {
  kod: string
  ad: string
  simge: string
  baslangic: string | null
  bitis: string | null
  aktif: boolean
}

type CustomShiftDefinition = {
  id: string
  ad: string
  simge: string | null
  baslangic: string
  bitis: string
  aktif: boolean
}

export type DashboardShift = {
  code: string
  name: string
  symbol: string
  startMinute: number
  endMinute: number
  label: string
}

const defaultFixedShifts: FixedShiftDefinition[] = [
  { kod: "S", ad: "Sabah", simge: "S", baslangic: "06:00", bitis: "16:00", aktif: true },
  { kod: "A", ad: "Akşam", simge: "A", baslangic: "16:00", bitis: "02:00", aktif: true },
  { kod: "R", ad: "Ara", simge: "R", baslangic: "11:00", bitis: "21:00", aktif: true },
  { kod: "I", ad: "İzin", simge: "İ", baslangic: null, bitis: null, aktif: true },
]

function normalizeName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleUpperCase("tr-TR")
}

export function todayInIstanbul() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
}

function timeToMinute(value: string | null | undefined) {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hour, minute] = value.split(":").map(Number)
  return hour * 60 + minute
}

function toDashboardShift(code: string, row: FixedShiftDefinition | CustomShiftDefinition): DashboardShift | null {
  const startMinute = timeToMinute(row.baslangic)
  const endMinute = timeToMinute(row.bitis)
  if (startMinute === null || endMinute === null) return null

  return {
    code,
    name: row.ad,
    symbol: row.simge || code,
    startMinute,
    endMinute,
    label: `${row.baslangic} - ${row.bitis}`,
  }
}

export async function getDashboardShiftCatalog(subeId: string) {
  const admin = createAdminClient()
  const [{ data: fixedRows, error: fixedError }, { data: customRows, error: customError }] = await Promise.all([
    admin
      .from("vardiya_sabit_ayarlari")
      .select("kod, ad, simge, baslangic, bitis, aktif")
      .eq("sube_id", subeId),
    admin
      .from("vardiya_tanimlari")
      .select("id, ad, simge, baslangic, bitis, aktif")
      .eq("sube_id", subeId)
      .eq("aktif", true),
  ])

  if (fixedError) throw new Error(fixedError.message)
  if (customError) throw new Error(customError.message)

  const fixedByCode = new Map((fixedRows || []).map((row) => [row.kod, row as FixedShiftDefinition]))
  const shifts = [
    ...defaultFixedShifts
      .map((row) => ({ ...row, ...(fixedByCode.get(row.kod) || {}) }))
      .filter((row) => row.aktif)
      .map((row) => toDashboardShift(row.kod, row))
      .filter((row): row is DashboardShift => Boolean(row)),
    ...(customRows || [])
      .map((row) => toDashboardShift(row.id, row as CustomShiftDefinition))
      .filter((row): row is DashboardShift => Boolean(row)),
  ]

  return shifts
}

export async function resolvePersonelDashboardShift(options: {
  subeId: string
  personelId: string
  date: string
  fallbackCode?: string | null
}) {
  const admin = createAdminClient()
  const [{ data: plan, error: planError }, catalog] = await Promise.all([
    admin
      .from("vardiya_planlari")
      .select("vardiya")
      .eq("sube_id", options.subeId)
      .eq("personel_id", options.personelId)
      .eq("tarih", options.date)
      .maybeSingle(),
    getDashboardShiftCatalog(options.subeId),
  ])

  if (planError) throw new Error(planError.message)

  const code = String(plan?.vardiya || options.fallbackCode || "")
  if (!code || code === "I") return null
  return catalog.find((shift) => shift.code === code) || null
}

export async function findDashboardPersonelForAttendanceUser(user: { name: string; tcKimlik: string }) {
  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("display_name, sube_id, tc_kimlik")
    .eq("tc_kimlik", user.tcKimlik)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  const subeId = profile?.sube_id
  if (!subeId) return null

  const targetName = normalizeName(profile.display_name || user.name)
  const { data: personeller, error: personelError } = await admin
    .from("personeller")
    .select("id, ad, sube_id, sabit_vardiya")
    .eq("sube_id", subeId)
    .eq("aktif", true)

  if (personelError) throw new Error(personelError.message)

  const personel = (personeller || []).find((row) => normalizeName(row.ad) === targetName)
  if (!personel) return null

  return {
    id: String(personel.id),
    subeId,
    sabitVardiya: personel.sabit_vardiya as string | null,
  }
}

export async function ensurePrismaShift(shift: DashboardShift) {
  const name = `${shift.code} ${shift.name} ${shift.label}`
  return prisma.shift.upsert({
    where: { name },
    create: {
      name,
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
    },
    update: {
      startMinute: shift.startMinute,
      endMinute: shift.endMinute,
    },
  })
}
