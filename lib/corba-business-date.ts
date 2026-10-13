import { isEveningShift } from "@/lib/shift-business-date"

const timeZone = "Europe/Istanbul"
const eveningCutoffHour = 5
const eveningCutoffMinute = 30

type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function zonedDateParts(date: Date): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

function dateStringFromParts(parts: Pick<ZonedDateParts, "year" | "month" | "day">) {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`
}

function addDays(parts: Pick<ZonedDateParts, "year" | "month" | "day">, days: number) {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

export function getCorbaBusinessDate(vardiya: unknown, now = new Date()) {
  const parts = zonedDateParts(now)
  const beforeOrAtEveningCutoff =
    parts.hour < eveningCutoffHour ||
    (parts.hour === eveningCutoffHour && parts.minute <= eveningCutoffMinute)

  if (isEveningShift(vardiya) && beforeOrAtEveningCutoff) {
    return dateStringFromParts(addDays(parts, -1))
  }

  return dateStringFromParts(parts)
}
