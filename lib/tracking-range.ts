export const TRACKING_UNLU_1_KEY = "__tracking_unlu_1"

function formatTrackingNumberPart(value: string) {
  const digits = value.replace(/[^\d]/g, "")
  if (!digits) return ""

  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(Number(digits))
}

export function formatTrackingRangeValue(value: unknown) {
  const rawValue = String(value ?? "").trim()
  if (!rawValue) return ""

  const parts = rawValue
    .split(/\s*[-–—]\s*/)
    .map(formatTrackingNumberPart)
    .filter(Boolean)

  if (parts.length === 0) return ""
  return parts.join(" - ")
}
