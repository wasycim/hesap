export function roundOvertimeToPaidMinutes(actualMinutes: number) {
  const minutes = Math.max(0, Math.floor(actualMinutes))
  if (minutes <= 0) return 0

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  const paidHours = Math.max(1, hours + (remainder >= 45 ? 1 : 0))
  return paidHours * 60
}

export function paidOvertimeHours(actualMinutes: number) {
  return roundOvertimeToPaidMinutes(actualMinutes) / 60
}
