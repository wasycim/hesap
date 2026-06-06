const timeZone = "Europe/Istanbul"

const monthNames = [
  "Ocak",
  "Subat",
  "Mart",
  "Nisan",
  "Mayis",
  "Haziran",
  "Temmuz",
  "Agustos",
  "Eylul",
  "Ekim",
  "Kasim",
  "Aralik",
]

type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
}

function zonedDateParts(date: Date): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
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

export function isEveningShift(vardiya: unknown) {
  const normalized = String(vardiya || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")

  return normalized === "a" || normalized === "aksam" || normalized === "akşam" || normalized === "evening"
}

export function getShiftBusinessDate(vardiya: unknown, now = new Date()) {
  const parts = zonedDateParts(now)
  if (isEveningShift(vardiya) && parts.hour < 5) {
    return dateStringFromParts(addDays(parts, -1))
  }

  return dateStringFromParts(parts)
}

export function getShiftBusinessMonthYear(vardiya: unknown, now = new Date()) {
  const businessDate = getShiftBusinessDate(vardiya, now)
  const [, year, month] = businessDate.match(/^(\d{4})-(\d{2})-\d{2}$/) || []
  const yearNumber = Number(businessDate.slice(0, 4))
  const monthNumber = Number(month)

  return {
    date: businessDate,
    month: monthNames[(monthNumber || 1) - 1],
    year: yearNumber || Number(year),
  }
}
