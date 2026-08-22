export function isTestPersonnel(personel: { ad?: string | null; name?: string | null; display_name?: string | null } | null | undefined): boolean {
  if (!personel) return false
  const raw = String(personel.ad || personel.name || personel.display_name || "").toLowerCase().trim()
  return raw === "test app" || raw === "testapp" || raw.includes("test app")
}
