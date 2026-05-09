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
export const START_MONTH_INDEX = 3
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

export function getMonthYearFromDate(dateStr: string) {
  const [year, month] = dateStr.split("-").map(Number)
  return {
    month: MONTHS[(month || 1) - 1],
    year,
  }
}

