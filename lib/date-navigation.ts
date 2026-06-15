export const MONTHS = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
]

export const START_YEAR = 2026
export const START_MONTH_INDEX = 0
export const INITIAL_END_YEAR = 2030

export function getInitialMonth() {
  const now = new Date()
  if (now.getFullYear() === START_YEAR && now.getMonth() < START_MONTH_INDEX) {
    return MONTHS[START_MONTH_INDEX]
  }
  return MONTHS[now.getMonth()]
}

export function getInitialYear() {
  return Math.max(new Date().getFullYear(), START_YEAR)
}

export function makeYears(endYear: number) {
  return Array.from({ length: endYear - START_YEAR + 1 }, (_, index) => START_YEAR + index)
}

export function makeYearWindow(selectedYear: number) {
  const startYear = Math.max(START_YEAR, selectedYear - 2)
  return Array.from({ length: 5 }, (_, index) => startYear + index)
}

export function getInitialEndYear() {
  return Math.max(INITIAL_END_YEAR, getInitialYear())
}

export function isBeforeSystemStart(month: string, year: number) {
  return year === START_YEAR && MONTHS.indexOf(month) < START_MONTH_INDEX
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getMonthIndex(month: string) {
  return MONTHS.indexOf(month)
}

function parseDateParts(dateStr: string) {
  const [dateYear, dateMonth, dateDay] = dateStr.split("-").map(Number)
  if (!dateYear || !dateMonth || !dateDay) return null
  return { dateYear, dateMonth, dateDay }
}

export function getMonthStartDate(month: string, year: number) {
  const monthIndex = getMonthIndex(month)
  const safeMonthIndex = monthIndex >= 0 ? monthIndex : 0
  return `${year}-${String(safeMonthIndex + 1).padStart(2, "0")}-01`
}

export function getMonthEndDate(month: string, year: number) {
  const monthIndex = getMonthIndex(month)
  const safeMonthIndex = monthIndex >= 0 ? monthIndex : 0
  const lastDay = new Date(year, safeMonthIndex + 1, 0).getDate()
  return `${year}-${String(safeMonthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`
}

export function isDateInSelectedMonth(dateStr: string, month: string, year: number) {
  const parts = parseDateParts(dateStr)
  const monthIndex = getMonthIndex(month)
  if (!parts || monthIndex < 0) return false
  return parts.dateYear === year && parts.dateMonth === monthIndex + 1
}

export function getNextDateWithinMonth(existingDates: string[], month: string, year: number) {
  const datesInMonth = existingDates
    .filter(date => isDateInSelectedMonth(date, month, year))
    .sort()

  if (datesInMonth.length === 0) {
    return getMonthStartDate(month, year)
  }

  const lastDate = datesInMonth[datesInMonth.length - 1]
  const parts = parseDateParts(lastDate)
  if (!parts) return getMonthStartDate(month, year)

  const nextDate = new Date(parts.dateYear, parts.dateMonth - 1, parts.dateDay)
  nextDate.setDate(nextDate.getDate() + 1)
  const nextDateString = getLocalDateString(nextDate)

  return isDateInSelectedMonth(nextDateString, month, year) ? nextDateString : null
}

export function getFirstMissingDateWithinMonth(existingDates: string[], month: string, year: number) {
  const monthIndex = getMonthIndex(month)
  if (monthIndex < 0) return null

  const existing = new Set(existingDates.filter(date => isDateInSelectedMonth(date, month, year)))
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()

  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    if (!existing.has(date)) return date
  }

  return null
}

export function getMonthYearFromDate(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number)
  return {
    month: MONTHS[(month || 1) - 1],
    year,
  }
}
