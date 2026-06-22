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
    .replace(/[^a-z0-9]/g, "")
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

export function isOnDortSube(sube: SubeLike | null | undefined) {
  if (!sube) return false
  const ad = normalizeSubeKey(sube.ad)
  const kod = normalizeSubeKey(sube.kod)
  return kod === "14" || ad === "14" || ad.includes("14no") || ad.includes("14numara")
}

export function isBesASube(sube: SubeLike | null | undefined) {
  if (!sube) return false
  const ad = normalizeSubeKey(sube.ad)
  const kod = normalizeSubeKey(sube.kod)
  return kod === "5a" || ad === "5a" || ad.includes("5a")
}

export const SUBE_HESAP_INFO = {
  carsi: { key: "carsi", title: "Çarşı Hesap", href: "/dashboard/carsi-hesap" },
  darica: { key: "darica", title: "Darıca Hesap", href: "/dashboard/darica-hesap" },
  onDort: { key: "onDort", title: "14 Hesap", href: "/dashboard/14-hesap" },
  besA: { key: "besA", title: "5A Hesap", href: "/dashboard/5a-hesap" },
} as const

export type SubeHesapKey = keyof typeof SUBE_HESAP_INFO

export function getSubeHesapInfo(sube: SubeLike | null | undefined) {
  if (isCarsiSube(sube)) return SUBE_HESAP_INFO.carsi
  if (isDaricaSube(sube)) return SUBE_HESAP_INFO.darica
  if (isOnDortSube(sube)) return SUBE_HESAP_INFO.onDort
  if (isBesASube(sube)) return SUBE_HESAP_INFO.besA
  return null
}
