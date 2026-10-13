export type GirisCikisDonemi = {
  ise_giris_tarihi: string
  isten_cikis_tarihi?: string | null
  not?: string | null
}

export function parseGirisCikisGecmisi(
  raw: any,
  fallbackGiris?: string | null,
  fallbackCikis?: string | null
): GirisCikisDonemi[] {
  let list: GirisCikisDonemi[] = []
  if (Array.isArray(raw)) {
    list = raw
      .filter((item) => item && typeof item === "object" && item.ise_giris_tarihi)
      .map((item) => ({
        ise_giris_tarihi: String(item.ise_giris_tarihi).trim(),
        isten_cikis_tarihi: item.isten_cikis_tarihi ? String(item.isten_cikis_tarihi).trim() : null,
        not: item.not ? String(item.not).trim() : null,
      }))
  }

  if (list.length === 0 && (fallbackGiris || fallbackCikis)) {
    list.push({
      ise_giris_tarihi: fallbackGiris ? String(fallbackGiris).trim() : "",
      isten_cikis_tarihi: fallbackCikis ? String(fallbackCikis).trim() : null,
      not: fallbackCikis ? "İşten Ayrıldı" : "İlk İşe Giriş",
    })
  }

  return list
}

export function isPersonelWorkingOnDate(
  personel: {
    aktif?: boolean
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  },
  dateStr: string // YYYY-MM-DD
): { isWorking: boolean; status: "working" | "resigned" | "not_started" } {
  const history = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )

  if (history.length > 0) {
    // Check all periods
    for (const period of history) {
      const start = period.ise_giris_tarihi
      const end = period.isten_cikis_tarihi
      if ((!start || dateStr >= start) && (!end || dateStr <= end)) {
        return { isWorking: true, status: "working" }
      }
    }

    const last = history[history.length - 1]
    if (last.ise_giris_tarihi && dateStr < last.ise_giris_tarihi) {
      return { isWorking: false, status: "not_started" }
    }
    return { isWorking: false, status: "resigned" }
  }

  // Fallback to single dates
  if (personel.isten_cikis_tarihi && dateStr > personel.isten_cikis_tarihi) {
    return { isWorking: false, status: "resigned" }
  }
  if (personel.ise_giris_tarihi && dateStr < personel.ise_giris_tarihi) {
    return { isWorking: false, status: "not_started" }
  }

  return {
    isWorking: Boolean(personel.aktif),
    status: personel.aktif ? "working" : "resigned",
  }
}

export function createRehirePayload(
  personel: {
    id: string
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  },
  rehireDate: string // YYYY-MM-DD
) {
  const currentHistory = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )

  // Ensure last period has exit date recorded
  if (currentHistory.length > 0) {
    const last = currentHistory[currentHistory.length - 1]
    if (!last.isten_cikis_tarihi && personel.isten_cikis_tarihi) {
      last.isten_cikis_tarihi = personel.isten_cikis_tarihi
      last.not = "İşten Ayrıldı"
    }
  }

  // Add the new rehire period
  currentHistory.push({
    ise_giris_tarihi: rehireDate,
    isten_cikis_tarihi: null,
    not: "Yeniden İşe Başladı",
  })

  return {
    aktif: true,
    ise_giris_tarihi: rehireDate,
    isten_cikis_tarihi: null,
    giris_cikis_gecmisi: currentHistory,
  }
}

export function createResignationPayload(
  personel: {
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  },
  exitDate: string, // YYYY-MM-DD
  todayStr?: string
) {
  const today = todayStr || new Date().toISOString().split("T")[0]
  const currentHistory = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )

  const isFutureExit = exitDate > today

  if (currentHistory.length > 0) {
    const last = currentHistory[currentHistory.length - 1]
    last.isten_cikis_tarihi = exitDate
    last.not = isFutureExit ? "İşten Ayrılacak" : "İşten Ayrıldı"
  } else {
    currentHistory.push({
      ise_giris_tarihi: personel.ise_giris_tarihi || "",
      isten_cikis_tarihi: exitDate,
      not: isFutureExit ? "İşten Ayrılacak" : "İşten Ayrıldı",
    })
  }

  return {
    aktif: isFutureExit ? true : false,
    isten_cikis_tarihi: exitDate,
    giris_cikis_gecmisi: currentHistory,
  }
}

export function getPersonelStatusBadge(
  personel: {
    aktif?: boolean
    ise_giris_tarihi?: string | null
    isten_cikis_tarihi?: string | null
    giris_cikis_gecmisi?: any
  },
  todayStr?: string
): {
  label: string
  isResigned: boolean
  isRehired: boolean
  isFutureStart: boolean
  isFutureExit: boolean
  colorClass: string
} {
  const today = todayStr || new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  const history = parseGirisCikisGecmisi(
    personel.giris_cikis_gecmisi,
    personel.ise_giris_tarihi,
    personel.isten_cikis_tarihi
  )
  const isRehired = history.length > 1
  const lastPeriod = history.length > 0 ? history[history.length - 1] : null

  const effectiveGiris = lastPeriod?.ise_giris_tarihi || personel.ise_giris_tarihi || null
  const effectiveCikis = lastPeriod?.isten_cikis_tarihi !== undefined ? lastPeriod.isten_cikis_tarihi : (personel.isten_cikis_tarihi || null)

  // 1. GELECEKTE İŞE BAŞLAYACAK (Başlama tarihine daha varsa)
  if (effectiveGiris && effectiveGiris > today) {
    return {
      label: isRehired
        ? `Yeniden Başlayacak (${effectiveGiris})`
        : `İşe Başlayacak (${effectiveGiris})`,
      isResigned: true,
      isRehired,
      isFutureStart: true,
      isFutureExit: false,
      colorClass:
        "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-300 dark:border-sky-700",
    }
  }

  // 2. GELECEKTE İŞTEN AYRILACAK (Çıkış tarihi henüz gelmemiş)
  if (effectiveCikis && effectiveCikis > today) {
    return {
      label: `İşten Ayrılacak (${effectiveCikis})`,
      isResigned: false,
      isRehired,
      isFutureStart: false,
      isFutureExit: true,
      colorClass:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700",
    }
  }

  // 3. İŞTEN AYRILDI (Çıkış tarihi gelmiş veya geçmiş)
  if (effectiveCikis && effectiveCikis <= today) {
    return {
      label: `İşten Ayrıldı (${effectiveCikis})`,
      isResigned: true,
      isRehired: false,
      isFutureStart: false,
      isFutureExit: false,
      colorClass:
        "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    }
  }

  // 4. AKTİF ÇALIŞIYOR
  if (personel.aktif !== false) {
    if (isRehired && effectiveGiris) {
      return {
        label: `Yeniden İşe Başladı (${effectiveGiris})`,
        isResigned: false,
        isRehired: true,
        isFutureStart: false,
        isFutureExit: false,
        colorClass:
          "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
      }
    }
    return {
      label: effectiveGiris ? `İşe Giriş: ${effectiveGiris}` : "Aktif",
      isResigned: false,
      isRehired: false,
      isFutureStart: false,
      isFutureExit: false,
      colorClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    }
  }

  // 5. PASİF / SİLİNDİ
  return {
    label: "Pasif / Silindi",
    isResigned: true,
    isRehired: false,
    isFutureStart: false,
    isFutureExit: false,
    colorClass: "bg-muted text-muted-foreground",
  }
}
