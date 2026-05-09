export type SecurityEventType =
  | "login"
  | "row_delete"
  | "column_delete"
  | "column_hide"
  | "person_delete"
  | "kargo_cari_delete"
  | "ortak_delete"
  | "password_change"
  | "user_create"
  | "user_update"
  | "branch_create"
  | "branch_delete"
  | "branch_delete_failed"
  | "visibility_update"

export async function logSecurityEvent(eventType: SecurityEventType, details: Record<string, unknown> = {}) {
  try {
    await fetch("/api/security-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType, details }),
    })
  } catch (error) {
    console.warn("Güvenlik kaydı oluşturulamadı", error)
  }
}
