export type SecurityEventType =
  | "login"
  | "failed_login"
  | "row_delete"
  | "column_delete"
  | "column_hide"
  | "person_delete"
  | "kargo_cari_delete"
  | "gelir_firma_delete"
  | "ortak_delete"
  | "password_change"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "branch_create"
  | "branch_delete"
  | "branch_delete_failed"
  | "visibility_update"

export async function logSecurityEvent(eventType: SecurityEventType, details: Record<string, unknown> = {}) {
  try {
    const deviceId = getDeviceId()
    await fetch("/api/security-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        details: {
          ...details,
          device_id: deviceId,
          client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }),
    })
  } catch (error) {
    console.warn("Güvenlik kaydı oluşturulamadı", error)
  }
}

function getDeviceId() {
  if (typeof window === "undefined") return null

  const storageKey = "hesap_device_id"
  const existing = window.localStorage.getItem(storageKey)
  if (existing) return existing

  const next = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(storageKey, next)
  return next
}
