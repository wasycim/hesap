export interface SubeLike {
  ad?: string | null
  kod?: string | null
}

export function normalizeSubeKey(value: string | null | undefined) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0131/g, "i")
    .replace(/\s+/g, "")
}

export function isCarsiSube(sube: SubeLike | null | undefined) {
  if (!sube) return false
  const ad = normalizeSubeKey(sube.ad)
  const kod = normalizeSubeKey(sube.kod)
  return ad === "carsi" || kod === "carsi"
}

export function isDaricaSube(sube: SubeLike | null | undefined) {
  if (!sube) return false
  const ad = normalizeSubeKey(sube.ad)
  const kod = normalizeSubeKey(sube.kod)
  return ad === "darica" || kod === "darica"
}
