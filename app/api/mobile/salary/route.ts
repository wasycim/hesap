import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getRequestAuthUser } from "@/lib/mobile-auth"
import { isTestPersonnel } from "@/lib/utils/test-personnel"
import { isPersonelWorkingOnDate } from "@/lib/personel-employment"

type Detail = { date: string; amount: number; description: string }
type OvertimeDetail = Detail & { minutes: number; rate: number; source: "attendance" | "manual" }

export async function GET(request: NextRequest) {
  const user = await getRequestAuthUser(request)
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })

  const now = new Date()
  const month = clampInt(request.nextUrl.searchParams.get("month"), 1, 12, now.getMonth() + 1)
  const year = clampInt(request.nextUrl.searchParams.get("year"), 2020, 2100, now.getFullYear())
  const requestedPersonelId = request.nextUrl.searchParams.get("personelId")?.trim()

  const start = `${year}-${String(month).padStart(2, "0")}-01`
  const end = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("user_id, sube_id, display_name, dashboard_access, is_admin, is_developer, tc_kimlik")
    .eq("user_id", user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile) {
    return NextResponse.json({ error: "Personel profili bulunamadı." }, { status: 404 })
  }

  let subeId = profile.sube_id as string | null

  // 1. Eğer şube henüz seçilmemişse, personeller tablosunda bu kullanıcıya ait kaydı tüm şubelerde ara
  if (!subeId) {
    const uName = profile.display_name?.trim() || ""
    const { data: globalMatch } = await admin
      .from("personeller")
      .select("sube_id")
      .or(`id.eq.${profile.tc_kimlik},ad.ilike.%${uName}%`)
      .limit(1)
      .maybeSingle()

    if (globalMatch?.sube_id) {
      subeId = globalMatch.sube_id
    } else {
      const { data: firstBranch } = await admin.from("subeler").select("id").eq("aktif", true).order("ad").limit(1).maybeSingle()
      subeId = firstBranch?.id || null
    }

    if (subeId) {
      await admin.from("user_profiles").update({ sube_id: subeId }).eq("user_id", user.id)
    }
  }

  if (!subeId) {
    return NextResponse.json({ error: "Sistemde aktif şube bulunamadı." }, { status: 404 })
  }

  const isManager = Boolean(profile.is_admin || profile.is_developer)

  let { data: candidates, error: personelError } = await admin
    .from("personeller")
    .select("id, ad, aylik_maas, banka_maas, nakit_maas, saatlik_mesai_ucreti, aktif, ise_giris_tarihi, isten_cikis_tarihi, giris_cikis_gecmisi, sube_id")
    .eq("sube_id", subeId)

  if (personelError) return NextResponse.json({ error: personelError.message }, { status: 500 })

  let personel: NonNullable<typeof candidates>[number] | undefined

  // 1. If manager requested specific personelId
  if (isManager && requestedPersonelId) {
    personel = (candidates || []).find((item) => item.id === requestedPersonelId)
  }

  // 2. Multi-level matching for current user within designated branch
  if (!personel) {
    personel = (candidates || []).find((item) => item.id === profile.tc_kimlik)
  }
  if (!personel) {
    personel = (candidates || []).find((item) => normalizeName(item.ad) === normalizeName(profile.display_name))
  }
  if (!personel) {
    personel = (candidates || []).find((item) => {
      const pName = normalizeName(item.ad)
      const uName = normalizeName(profile.display_name)
      return pName.includes(uName) || uName.includes(pName)
    })
  }

  // 2b. Global search across all branches if still not found (handles transferred personnel like Ömer Kahriman)
  if (!personel && !isManager) {
    const { data: allBranchCandidates } = await admin
      .from("personeller")
      .select("id, ad, aylik_maas, banka_maas, nakit_maas, saatlik_mesai_ucreti, aktif, ise_giris_tarihi, isten_cikis_tarihi, giris_cikis_gecmisi, sube_id")

    const globalMatch = (allBranchCandidates || []).find((item) => {
      const pName = normalizeName(item.ad)
      const uName = normalizeName(profile.display_name)
      return (
        item.id === profile.tc_kimlik ||
        pName === uName ||
        pName.includes(uName) ||
        uName.includes(pName)
      )
    })

    if (globalMatch) {
      personel = globalMatch
      subeId = globalMatch.sube_id
      const isOmer =
        globalMatch.id === "78a15f68-edfd-493c-b8bd-5604acf599dd" ||
        normalizeName(globalMatch.ad).includes("ÖMER KAHRİMAN") ||
        normalizeName(globalMatch.ad).includes("OMER KAHRIMAN")

      if (profile.sube_id !== globalMatch.sube_id && !isOmer) {
        await admin.from("user_profiles").update({ sube_id: globalMatch.sube_id }).eq("user_id", user.id)
      }
    }
  }

  if (!personel && isManager && candidates?.length) {
    personel = candidates[0]
  }

  // 3. Eğer personel kaydı hiç bulunamazsa, kullanıcı adı ile otomatik personel kaydı oluştur
  if (!personel) {
    const newPersonelName = profile.display_name?.trim() || "Yeni Personel"
    const { data: createdPersonel } = await admin.from("personeller").insert({
      ad: newPersonelName,
      sube_id: subeId,
      aylik_maas: 0,
      banka_maas: 0,
      nakit_maas: 0,
      saatlik_mesai_ucreti: 0,
      aktif: true,
    }).select().maybeSingle()

    if (createdPersonel) {
      personel = createdPersonel
      candidates = [...(candidates || []), createdPersonel]
    }
  }

  if (!personel) {
    return NextResponse.json({
      error: "Kullanıcı hesabı bir personel kaydıyla eşleşmiyor. Yönetici, hesap adı ile personel adını eşleştirmelidir.",
    }, { status: 404 })
  }

  const effectiveSubeId = personel.sube_id || subeId
  const { data: branch } = await admin.from("subeler").select("id, ad, kod").eq("id", effectiveSubeId).maybeSingle()

  const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
  const monthName = MONTHS_TR[month - 1] || ""
  const ayYil = `${monthName}-${year}`

  // Ömer Kahriman 5A Şubesinde maaş alırken avans ve çorba kayıtları 14 No Şubesi'nden (172cc1f6-3012-47d3-a707-36e6f77e97cf) okunur
  const branch14Id = "172cc1f6-3012-47d3-a707-36e6f77e97cf"
  const isOmerKahriman =
    personel.id === "78a15f68-edfd-493c-b8bd-5604acf599dd" ||
    normalizeName(personel.ad).includes("ÖMER KAHRİMAN") ||
    normalizeName(personel.ad).includes("OMER KAHRIMAN")

  const expenseBranchIds = isOmerKahriman
    ? Array.from(new Set([effectiveSubeId, branch14Id]))
    : [effectiveSubeId]

  const [
    { data: rows, error: rowsError },
    { data: approvals, error: approvalsError },
    { data: kargoPrimData },
    { data: corbaData },
    { data: approvedAvansData },
    { data: maasOnayiData },
    { data: maasKesintileriData },
    { data: maasIlaveleriData },
    { data: maasZamlariData }
  ] = await Promise.all([
    admin
      .from("gider_kayitlari")
      .select("tarih, personel_paylari, personel_mesai_detaylari")
      .in("sube_id", expenseBranchIds)
      .gte("tarih", start)
      .lte("tarih", end)
      .order("tarih"),
    admin
      .from("overtime_approvals")
      .select("attendance_log_id, personel_id, personel_name, work_date, raw_minutes, payable_minutes, manual_minutes, note, status")
      .eq("status", "approved")
      .gte("work_date", start)
      .lte("work_date", end)
      .or(`personel_id.eq.${personel.id},user_profile_id.eq.${user.id}`)
      .order("work_date"),
    admin
      .from("kargo_prim_kayitlari")
      .select("personel_hakedis, secili_personeller")
      .eq("sube_id", effectiveSubeId)
      .eq("ay_yil", ayYil)
      .maybeSingle(),
    admin
      .from("corbalar")
      .select("tarih, miktar")
      .in("sube_id", expenseBranchIds)
      .eq("ay_yil", ayYil)
      .eq("personel_id", personel.id)
      .order("tarih"),
    admin
      .from("avans_talepleri")
      .select("id, tutar, user_id, user_name, tc_kimlik, odeme_tarihi, created_at, durum")
      .in("sube_id", expenseBranchIds)
      .eq("durum", "onaylandi"),
    admin
      .from("maas_onaylari")
      .select("bankaya_gonderilen, kalan_nakit, nakit_odeme_tarihi")
      .eq("sube_id", effectiveSubeId)
      .eq("ay_yil", ayYil)
      .eq("personel_id", personel.id)
      .maybeSingle(),
    admin
      .from("maas_kesintileri")
      .select("id, personel_id, tutar, aciklama, tarih")
      .in("sube_id", expenseBranchIds)
      .eq("ay_yil", ayYil),
    admin
      .from("maas_ilaveleri")
      .select("id, personel_id, tutar, aciklama, tarih")
      .in("sube_id", expenseBranchIds)
      .eq("ay_yil", ayYil),
    admin
      .from("maas_zamlari")
      .select("id, personel_id, yeni_maas, yururluk_tarihi")
      .eq("personel_id", personel.id),
  ])

  let finalMaasOnayiData = maasOnayiData
  if (!finalMaasOnayiData && isOmerKahriman) {
    const { data: fallbackMaasOnayi } = await admin
      .from("maas_onaylari")
      .select("bankaya_gonderilen, kalan_nakit, nakit_odeme_tarihi")
      .eq("sube_id", branch14Id)
      .eq("ay_yil", ayYil)
      .eq("personel_id", personel.id)
      .maybeSingle()
    if (fallbackMaasOnayi) finalMaasOnayiData = fallbackMaasOnayi
  }

  // Active zam control
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`
  const activeZam = (maasZamlariData || []).find(
    (z: any) => z.personel_id === personel.id && z.yururluk_tarihi && z.yururluk_tarihi.startsWith(monthPrefix)
  )

  const bankaMaas = Number(personel.banka_maas || 0)
  const nakitMaas = Number(personel.nakit_maas !== undefined && personel.nakit_maas !== null ? personel.nakit_maas : (personel.aylik_maas || 0))
  const rawBaseSalary = activeZam ? Number(activeZam.yeni_maas) : Number(personel.aylik_maas || (bankaMaas + nakitMaas))

  // Pro-rata (kıst) calculation exactly matching website
  const totalDaysInMonth = new Date(year, month, 0).getDate()
  const monthStartDate = `${year}-${String(month).padStart(2, "0")}-01`
  const monthEndDate = `${year}-${String(month).padStart(2, "0")}-${String(totalDaysInMonth).padStart(2, "0")}`

  let prorationRatio = 1
  if (personel.ise_giris_tarihi && personel.ise_giris_tarihi > monthEndDate) {
    prorationRatio = 0
  } else if (personel.isten_cikis_tarihi && personel.isten_cikis_tarihi < monthStartDate) {
    prorationRatio = 0
  } else {
    const entryInMonth = Boolean(personel.ise_giris_tarihi && personel.ise_giris_tarihi >= monthStartDate && personel.ise_giris_tarihi <= monthEndDate)
    const exitInMonth = Boolean(personel.isten_cikis_tarihi && personel.isten_cikis_tarihi >= monthStartDate && personel.isten_cikis_tarihi <= monthEndDate)

    if (entryInMonth || exitInMonth) {
      const startDay = entryInMonth ? new Date(personel.ise_giris_tarihi!).getDate() : 1
      const endDay = exitInMonth ? new Date(personel.isten_cikis_tarihi!).getDate() : totalDaysInMonth
      const workedDays = Math.max(1, endDay - startDay + 1)
      prorationRatio = Math.min(1, Math.max(0, workedDays / totalDaysInMonth))
    }
  }

  const baseSalary = rawBaseSalary * prorationRatio
  const hourlyRate = Number(personel.saatlik_mesai_ucreti || 0) || (baseSalary > 0 ? baseSalary / 30 / 8 : 0)
  const advances: Detail[] = []
  const overtime: (OvertimeDetail & { excludedFromTotal?: boolean })[] = []

  // Check approved advance requests for "Özel Avans"
  for (const req of approvedAvansData || []) {
    const tutar = Number(req.tutar || 0)
    const targetDate = req.odeme_tarihi || (req.created_at ? req.created_at.slice(0, 10) : "")
    const reqName = normalizeName(req.user_name || "")
    const pName = normalizeName(personel.ad || "")

    const isMatch =
      req.user_id === user.id ||
      (req.tc_kimlik && req.tc_kimlik === personel.id) ||
      (reqName && pName && (reqName === pName || reqName.includes(pName) || pName.includes(reqName)))

    if (tutar > 0 && targetDate && targetDate >= start && targetDate <= end && isMatch) {
      advances.push({
        date: targetDate,
        amount: tutar,
        description: "Özel Avans (Onaylı Avans Talebi)",
      })
    }
  }

  // Check Kargo Prim for personnel with pro-rata
  if (kargoPrimData) {
    const secili = kargoPrimData.secili_personeller as string[] | null
    const isSelected = !secili || secili.includes(personel.id)
    let kargoAmount = isSelected ? Number(kargoPrimData.personel_hakedis || 0) * prorationRatio : 0
    if (kargoAmount > 0) {
      overtime.push({
        date: start,
        amount: kargoAmount,
        description: `${monthName} Ayı Kargo Hakediş`,
        minutes: 0,
        rate: 0,
        source: "manual",
      })
    }
  }

  // Corba details
  const corbaDetails = (corbaData || [])
    .filter(c => Number(c.miktar) > 0)
    .map(c => ({
      date: c.tarih,
      amount: Number(c.miktar),
      description: `Çorba kazanılan kaydı (${Number(c.miktar).toLocaleString("tr-TR")} TL)`,
    }))
  const corbaTotal = corbaDetails.reduce((sum, item) => sum + item.amount, 0)

  for (const row of rows || []) {
    const payments = (row.personel_paylari || {}) as Record<string, unknown>
    const manualOvertime = (row.personel_mesai_detaylari || {}) as Record<string, unknown>
    const advanceAmount = Number(payments[personel.id] || 0)
    const rowDateStr = typeof row.tarih === "string" ? row.tarih.slice(0, 10) : new Date(row.tarih).toISOString().slice(0, 10)
    if (advanceAmount > 0) advances.push({ date: rowDateStr, amount: advanceAmount, description: "Alınan avans" })
    const manualAmount = Number(manualOvertime[personel.id] || 0)
    if (manualAmount > 0) overtime.push({
      date: rowDateStr,
      amount: manualAmount,
      description: "Gider kaydındaki manuel mesai tutarı (Maaşa eklenmez)",
      minutes: 0,
      rate: 0,
      source: "manual",
      excludedFromTotal: true,
    })
  }

  for (const approval of approvals || []) {
    if (approval.personel_id && approval.personel_id !== personel.id && normalizeName(approval.personel_name) !== normalizeName(personel.ad)) continue
    const minutes = Number(approval.payable_minutes || approval.manual_minutes || 0)
    if (minutes <= 0) continue
    overtime.push({
      date: approval.work_date || start,
      amount: (minutes / 60) * hourlyRate,
      description: approval.attendance_log_id ? "Onaylı mesai takip kaydı" : `Yönetici onaylı manuel mesai${approval.note ? ` — ${approval.note}` : ""}`,
      minutes,
      rate: hourlyRate,
      source: approval.attendance_log_id ? "attendance" : "manual",
    })
  }

  // İlave ve Kesintiler
  const ilaveDetails = (maasIlaveleriData || [])
    .filter((ilave: any) => ilave.personel_id === personel.id)
    .map((ilave: any) => ({
      id: ilave.id,
      date: ilave.tarih || start,
      amount: Number(ilave.tutar || 0),
      description: ilave.aciklama || "Maaş İlave Ücret / Ödül",
    }))
  const ilaveTotal = ilaveDetails.reduce((sum: number, item: any) => sum + item.amount, 0)

  const kesintiDetails = (maasKesintileriData || [])
    .filter((k: any) => k.personel_id === personel.id)
    .map((k: any) => ({
      id: k.id,
      date: k.tarih || start,
      amount: Number(k.tutar || 0),
      description: k.aciklama || "Maaş Kesintisi",
    }))
  const kesintiTotal = kesintiDetails.reduce((sum: number, item: any) => sum + item.amount, 0)

  const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0)
  const rawOvertimeTotal = overtime.filter(item => !item.excludedFromTotal).reduce((sum, item) => sum + item.amount, 0)
  const overtimeTotal = rawOvertimeTotal + ilaveTotal

  // Web sitesindeki birebir formül:
  // totalHakedis = baseSalary + overtimeTotal
  // kalanNakit = totalHakedis - advanceTotal - bankayaGonderilen - kesintiTotal
  const totalHakedis = baseSalary + overtimeTotal
  const bankayaGonderilen = finalMaasOnayiData ? Number(finalMaasOnayiData.bankaya_gonderilen || 0) : 0
  const remaining = totalHakedis - advanceTotal - bankayaGonderilen - kesintiTotal

  const activeCandidates = (candidates || []).filter((p) => {
    if (isTestPersonnel(p)) return false
    if (p.isten_cikis_tarihi && p.isten_cikis_tarihi < start) return false
    if (p.aktif === false && (!p.isten_cikis_tarihi || p.isten_cikis_tarihi < start)) return false
    return true
  })

  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(new Date())
  const employmentStatus = isPersonelWorkingOnDate(personel, todayStr)
  const isNotStarted = employmentStatus.status === "not_started" || Boolean(personel.ise_giris_tarihi && todayStr < String(personel.ise_giris_tarihi).trim())
  const isPersonelExited = employmentStatus.status === "resigned" || Boolean(
    personel && (
      personel.aktif === false ||
      (personel.isten_cikis_tarihi && String(personel.isten_cikis_tarihi).trim() <= todayStr)
    )
  )
  const isDeveloperUser = Boolean(profile.is_developer)

  // Henüz işe başlamamış kişi (Yiğit Kaçaran vb.) developer değilse maaş ve avans erişimine kapalıdır!
  if (isNotStarted && !isDeveloperUser) {
    return NextResponse.json(
      {
        period: { month, year, monthName, start, end },
        branch,
        personel: { id: personel.id, name: personel.ad, isExited: false, isNotStarted: true, iseGirisTarihi: personel.ise_giris_tarihi },
        isManager,
        isDeveloper: false,
        isExited: false,
        isNotStarted: true,
        personelList: isManager ? activeCandidates.map((p) => ({ id: p.id, name: p.ad })) : [],
        baseSalary: 0,
        bankaMaas: 0,
        nakitMaas: 0,
        hourlyRate: 0,
        corbaTotal: 0,
        corbaDetails: [],
        advanceTotal: 0,
        overtimeTotal: 0,
        kesintiTotal: 0,
        kesintiler: [],
        ilaveTotal: 0,
        ilaveler: [],
        remaining: 0,
        maasOnayi: null,
        advances: [],
        overtime: [],
        avansRequests: [],
        message: `Henüz işe başlama tarihi (${personel.ise_giris_tarihi || "Belirlenen tarih"}) gelmediği için maaş bilgileri ve avans talebi erişime kapalıdır.`,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    )
  }

  // İşten çıkan kişi kullanıcı developer değil ise maaşı, avansı vs. GÖZÜKMEMELİ!
  if (isPersonelExited && !isDeveloperUser) {
    return NextResponse.json(
      {
        period: { month, year, monthName, start, end },
        branch,
        personel: { id: personel.id, name: personel.ad, isExited: true, isNotStarted: false },
        isManager,
        isDeveloper: false,
        isExited: true,
        isNotStarted: false,
        personelList: isManager ? activeCandidates.map((p) => ({ id: p.id, name: p.ad })) : [],
        baseSalary: 0,
        bankaMaas: 0,
        nakitMaas: 0,
        hourlyRate: 0,
        corbaTotal: 0,
        corbaDetails: [],
        advanceTotal: 0,
        overtimeTotal: 0,
        kesintiTotal: 0,
        kesintiler: [],
        ilaveTotal: 0,
        ilaveler: [],
        remaining: 0,
        maasOnayi: null,
        advances: [],
        overtime: [],
        avansRequests: [],
        message: "İşten çıkış işlemi yapıldığı için maaş bilgileri ve avans talebi erişime kapalıdır.",
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    )
  }

  return NextResponse.json(
    {
      period: { month, year, monthName, start, end },
      branch,
      personel: {
        id: personel.id,
        name: personel.ad,
        isExited: isPersonelExited,
        isNotStarted,
        iseGirisTarihi: personel.ise_giris_tarihi || null,
        istenCikisTarihi: personel.isten_cikis_tarihi || null,
      },
      isManager,
      isDeveloper: isDeveloperUser,
      isExited: isPersonelExited,
      isNotStarted,
      personelList: isManager ? activeCandidates.map((p) => ({ id: p.id, name: p.ad })) : [],
      baseSalary,
      bankaMaas,
      nakitMaas,
      hourlyRate,
      corbaTotal,
      corbaDetails,
      advanceTotal,
      overtimeTotal,
      kesintiTotal,
      kesintiler: kesintiDetails,
      ilaveTotal,
      ilaveler: ilaveDetails,
      totalHakedis,
      remaining,
      maasOnayi: finalMaasOnayiData ? {
        bankayaGonderilen: Number(finalMaasOnayiData.bankaya_gonderilen || 0),
        kalanNakit: Number(finalMaasOnayiData.kalan_nakit || 0),
        nakitOdemeTarihi: finalMaasOnayiData.nakit_odeme_tarihi || null,
      } : null,
      advances: advances.sort((a, b) => a.date.localeCompare(b.date)),
      overtime: overtime.sort((a, b) => a.date.localeCompare(b.date)),
    },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    }
  )
}

function normalizeName(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
}

function clampInt(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}
