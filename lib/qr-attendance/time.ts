import type { Shift } from "@prisma/client"

const timeZone = "Europe/Istanbul"

function zonedParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  }
}

function dateOnly(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function minutesOfDay(date: Date) {
  const parts = zonedParts(date)
  return parts.hour * 60 + parts.minute
}

export function getWorkDate(now: Date, shift?: Pick<Shift, "startMinute" | "endMinute"> | null) {
  const parts = zonedParts(now)
  const today = dateOnly(parts.year, parts.month, parts.day)

  if (!shift) return today

  const currentMinute = parts.hour * 60 + parts.minute
  const crossesMidnight = shift.endMinute <= shift.startMinute

  if (crossesMidnight && currentMinute <= shift.endMinute) {
    return addDays(today, -1)
  }

  return today
}

export function shiftBoundary(workDate: Date, minute: number, addDay = false) {
  const day = addDay ? addDays(workDate, 1) : workDate
  const year = day.getUTCFullYear()
  const month = String(day.getUTCMonth() + 1).padStart(2, "0")
  const date = String(day.getUTCDate()).padStart(2, "0")
  const hour = String(Math.floor(minute / 60)).padStart(2, "0")
  const minutes = String(minute % 60).padStart(2, "0")

  return new Date(`${year}-${month}-${date}T${hour}:${minutes}:00+03:00`)
}

export function calculateLateMinutes(checkInAt: Date, shift?: Pick<Shift, "startMinute" | "endMinute"> | null) {
  if (!shift) return 0
  const workDate = getWorkDate(checkInAt, shift)
  const startsAt = shiftBoundary(workDate, shift.startMinute)
  return Math.max(0, Math.floor((checkInAt.getTime() - startsAt.getTime()) / 60000))
}

export function calculateOvertimeMinutes(
  checkOutAt: Date,
  workDate: Date,
  shift?: Pick<Shift, "startMinute" | "endMinute"> | null,
) {
  if (!shift) return 0
  const crossesMidnight = shift.endMinute <= shift.startMinute
  const endsAt = shiftBoundary(workDate, shift.endMinute, crossesMidnight)
  return Math.max(0, Math.floor((checkOutAt.getTime() - endsAt.getTime()) / 60000))
}

export function formatMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours <= 0) return `${minutes} dk`
  if (minutes === 0) return `${hours} sa`
  return `${hours} sa ${minutes} dk`
}

export function getShiftLabel(shift: Pick<Shift, "startMinute" | "endMinute">) {
  const label = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
  return `${label(shift.startMinute)} - ${label(shift.endMinute)}`
}
