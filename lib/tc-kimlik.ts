export function normalizeTcKimlik(value: unknown) {
  return String(value || "").replace(/\D/g, "")
}

export function isValidTcKimlik(value: unknown) {
  const tc = normalizeTcKimlik(value)
  if (!/^[1-9]\d{10}$/.test(tc)) return false
  if (/^(\d)\1{10}$/.test(tc)) return false

  const digits = tc.split("").map(Number)
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const tenth = ((oddSum * 7) - evenSum) % 10
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10

  return digits[9] === (tenth + 10) % 10 && digits[10] === eleventh
}
