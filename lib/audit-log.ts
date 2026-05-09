export type SecurityEventType =
  | "login"
  | "row_delete"
  | "column_delete"
  | "column_hide"
  | "password_change"
  | "user_create"
  | "branch_create"
  | "branch_delete"
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

