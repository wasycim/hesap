"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar as CalendarIcon, CalendarDays, Calculator, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, CreditCard, Edit3, FileText, HandCoins, Plus, Scissors, ShieldCheck, Sparkles, Trash2, TrendingUp, Wallet, XCircle, Building2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { isTestPersonnel } from "@/lib/utils/test-personnel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useSube } from "@/contexts/sube-context"
import {
  MONTHS,
  START_MONTH_INDEX,
  START_YEAR,
  getInitialMonth,
  getInitialYear,
  getMonthEndDate,
  getMonthStartDate,
  makeYearWindow,
} from "@/lib/date-navigation"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"
import { openPdfReport } from "@/lib/pdf-report"

interface Personel {
  id: string
  ad: string
  aylik_maas?: number
  banka_maas?: number
  nakit_maas?: number
  saatlik_mesai_ucreti?: number
  ise_giris_tarihi?: string | null
  isten_cikis_tarihi?: string | null
}

interface Ortak {
  id: string
  ad: string
}

interface GiderRow {
  tarih: string
  personel_paylari?: Record<string, number>
  personel_mesai_detaylari?: Record<string, number>
  ortak_pilarim?: Record<string, number>
}

interface MaasOnayi {
  id?: string
  sube_id: string
  ay_yil: string
  personel_id: string
  bankaya_gonderilen: number
  kalan_nakit: number
  nakit_odeme_tarihi: string | null
}

type Detail = { tarih: string; amount: number; description: string }
type OvertimeDetail = Detail & { hours: number; rate: number; minutes: number; source: "attendance" | "manual"; excludedFromTotal?: boolean }

type AttendanceDetail = {
  id: number
  personelId: string | null
  workDate: string
  overtimeMinutes: number
  payableOvertimeMinutes?: number
}

type OvertimeApproval = {
  id: string
  attendance_log_id: number | null
  personel_id: string | null
  personel_name: string | null
  work_date: string | null
  raw_minutes: number
  payable_minutes: number
  manual_minutes: number
  note: string | null
  status: "pending" | "approved" | "rejected"
}

type AttendancePayload = {
  details: AttendanceDetail[]
}

function formatMoney(value: number) {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDurationFromMinutes(totalMinutes: number) {
  const total = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (!hours) return `${minutes} dk`
  return minutes ? `${hours} sa ${minutes} dk` : `${hours} sa`
}

function normalizeName(value: string | null | undefined) {
  const str = String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
  if (str.includes("FATMAGÜL KARAKAYA") || str.includes("FATMA GÜL KARAKAYA") || str.includes("FATMA GÜL DURANAY")) {
    return "FATMA GÜL DURANAY"
  }
  return str
}

interface AvansTalebi {
  id: string
  user_id: string
  user_name: string
  tc_kimlik?: string
  tutar: number
  aciklama?: string
  durum: "beklemede" | "onaylandi" | "reddedildi"
  red_sebebi?: string
  odeme_tarihi?: string
  created_at: string
}

export default function MaaslarPage() {
  const [month, setMonth] = useState(getInitialMonth())
  const [year, setYear] = useState(getInitialYear())
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [ortaklar, setOrtaklar] = useState<Ortak[]>([])
  const [rows, setRows] = useState<GiderRow[]>([])
  const [attendanceOvertime, setAttendanceOvertime] = useState<AttendanceDetail[]>([])
  const [overtimeApprovals, setOvertimeApprovals] = useState<OvertimeApproval[]>([])
  const [avansTalepleri, setAvansTalepleri] = useState<AvansTalebi[]>([])
  const [kargoPrimAmount, setKargoPrimAmount] = useState<number>(0)
  const [kargoSeciliPersoneller, setKargoSeciliPersoneller] = useState<string[] | null>(null)
  const [corbaData, setCorbaData] = useState<{ tarih: string; personel_id: string; miktar: number }[]>([])
  const [selectedPersonelId, setSelectedPersonelId] = useState<string | null>(null)
  const [selectedOrtakId, setSelectedOrtakId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserProfile, setCurrentUserProfile] = useState<{ displayName: string; isManager: boolean } | null>(null)
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [requestTutar, setRequestTutar] = useState("")
  const [requestAciklama, setRequestAciklama] = useState("")
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [avansSearchName, setAvansSearchName] = useState("")
  const [avansFilterStatus, setAvansFilterStatus] = useState<"all" | "beklemede" | "onaylandi" | "reddedildi">("all")
  const [avansStartDate, setAvansStartDate] = useState("")
  const [avansEndDate, setAvansEndDate] = useState("")
  const [actionModal, setActionModal] = useState<{ open: boolean; request: AvansTalebi | null; type: "approve" | "reject" }>({ open: false, request: null, type: "approve" })
  const [modalInput, setModalInput] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const [maasOnaylari, setMaasOnaylari] = useState<Record<string, MaasOnayi>>({})
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [approveTargetPersonelId, setApproveTargetPersonelId] = useState<string | null>(null)
  const [approveBankaInput, setApproveBankaInput] = useState("")
  const [approveNakitTarihi, setApproveNakitTarihi] = useState("")
  const [savingApproval, setSavingApproval] = useState(false)

  const [kesintilerList, setKesintilerList] = useState<any[]>([])
  const [kesintiTargetPersonelId, setKesintiTargetPersonelId] = useState("")
  const [kesintiTutarInput, setKesintiTutarInput] = useState("")
  const [kesintiAciklamaInput, setKesintiAciklamaInput] = useState("")
  const [kesintiTarihInput, setKesintiTarihInput] = useState(new Date().toISOString().split("T")[0])
  const [kesintiSubmitting, setKesintiSubmitting] = useState(false)

  // İlave Ücret / Prim State
  const [ilavelerList, setIlavelerList] = useState<any[]>([])
  const [ilaveTutarInput, setIlaveTutarInput] = useState("")
  const [ilaveAciklamaInput, setIlaveAciklamaInput] = useState("")
  const [ilaveTarihInput, setIlaveTarihInput] = useState(new Date().toISOString().split("T")[0])
  const [ilaveSubmitting, setIlaveSubmitting] = useState(false)

  // Maaş Ayarları (Maaş Belirleme) Modal State
  const [maasAyarlariModalOpen, setMaasAyarlariModalOpen] = useState(false)
  const [maasAyariType, setMaasAyariType] = useState<"personel" | "ortak">("personel")
  const [maasAyariTargetId, setMaasAyariTargetId] = useState("")
  const [maasAyariTutarInput, setMaasAyariTutarInput] = useState("")
  const [maasAyariSaving, setMaasAyariSaving] = useState(false)

  // All Branch Gider Rows for Ortak Avans details
  const [allBranchGiderRows, setAllBranchGiderRows] = useState<any[]>([])

  // Zam (Maaş Zammı) State
  const [zamModalOpen, setZamModalOpen] = useState(false)
  const [zamTargetType, setZamTargetType] = useState<"personel" | "ortak">("personel")
  const [zamTargetId, setZamTargetId] = useState("")
  const [zamOraniInput, setZamOraniInput] = useState("")
  const [zamYuvarlamaInput, setZamYuvarlamaInput] = useState("")
  const [zamTarihInput, setZamTarihInput] = useState(new Date().toISOString().split("T")[0])
  const [zamAciklamaInput, setZamAciklamaInput] = useState("")
  const [zamSubmitting, setZamSubmitting] = useState(false)
  const [maasZamlariList, setMaasZamlariList] = useState<any[]>([])

  // Borç Taksitlendirme State
  const [taksitModalOpen, setTaksitModalOpen] = useState(false)
  const [taksitPersonelId, setTaksitPersonelId] = useState("")
  const [taksitToplamBorcInput, setTaksitToplamBorcInput] = useState("")
  const [taksitSayisiInput, setTaksitSayisiInput] = useState("5")
  const [taksitAciklamaInput, setTaksitAciklamaInput] = useState("Telefon Borcu")
  const [taksitBaslangicTarihiInput, setTaksitBaslangicTarihiInput] = useState(new Date().toISOString().split("T")[0])
  const [taksitSubmitting, setTaksitSubmitting] = useState(false)
  const [borcTaksitleriList, setBorcTaksitleriList] = useState<any[]>([])

  // Ömer Kahriman (14 No Şubesi -> 5A Şubesi Kart Taşıma İstisnası)
  const [omer14GiderRows, setOmer14GiderRows] = useState<GiderRow[]>([])
  const [omerPersonelRecord, setOmerPersonelRecord] = useState<Personel | null>(null)

  // Ortak Avans Filtreleme State
  const [ortakSubeFilter, setOrtakSubeFilter] = useState<string>("all")
  const [ortakSearchText, setOrtakSearchText] = useState<string>("")

  const supabase = createClient()
  const { currentSube, subeler, isAdmin, loading: subeLoading } = useSube()
  const years = makeYearWindow(year)
  const ayYil = `${month}-${year}`

  useEffect(() => {
    if (currentSube) loadData()
  }, [currentSube?.id, ayYil])

  async function loadData() {
    if (!currentSube) return
    setLoading(true)

    const userRes = await supabase.auth.getUser()
    const authUser = userRes?.data?.user
    let isManager = isAdmin
    let displayName = ""
    if (authUser) {
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("is_admin, is_developer, display_name")
        .eq("user_id", authUser.id)
        .maybeSingle()
      if (prof) {
        isManager = Boolean(prof.is_admin || prof.is_developer)
        displayName = prof.display_name || ""
      }
    }
    setCurrentUserProfile({ displayName, isManager })

    const from = getMonthStartDate(month, year)
    const to = getMonthEndDate(month, year)

    const [personelRes, allBranchPersonelRes, ortakRes, giderRes, attendanceRes, approvalsRes, kargoPrimRes, corbaRes, avansRes, maasOnayRes, kesintiRes, maasZamRes, borcTaksitRes, ilaveRes, allGiderRes] = await Promise.all([
      supabase
        .from("personeller")
        .select("id, ad, aylik_maas, banka_maas, nakit_maas, saatlik_mesai_ucreti, aktif, ise_giris_tarihi, isten_cikis_tarihi")
        .eq("sube_id", currentSube.id)
        .order("sira", { ascending: true }),
      supabase
        .from("personeller")
        .select("id, ad, aylik_maas, sube_id"),
      supabase
        .from("ortaklar")
        .select("id, ad, aylik_maas, sube_id")
        .eq("aktif", true)
        .order("sira", { ascending: true }),
      supabase
        .from("gider_kayitlari")
        .select("tarih, personel_paylari, personel_mesai_detaylari, ortak_pilarim")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true }),
      fetch(`/api/dashboard/mesai-takip?${new URLSearchParams({ from, to, subeId: currentSube.id }).toString()}`),
      fetch("/api/admin/operations?table=overtime_approvals", { cache: "no-store" }),
      supabase
        .from("kargo_prim_kayitlari")
        .select("personel_hakedis, secili_personeller")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .maybeSingle(),
      supabase
        .from("corbalar")
        .select("tarih, personel_id, miktar")
        .eq("sube_id", currentSube.id)
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true }),
      fetch("/api/admin/avans", { cache: "no-store" }),
      fetch(`/api/admin/maas-onay?${new URLSearchParams({ subeId: currentSube.id, ayYil }).toString()}`, { cache: "no-store" }),
      fetch(`/api/admin/maas-kesinti?${new URLSearchParams({ subeId: currentSube.id, ayYil }).toString()}`, { cache: "no-store" }),
      fetch(`/api/admin/maas-zam?${new URLSearchParams({ subeId: currentSube.id }).toString()}`, { cache: "no-store" }),
      fetch(`/api/admin/borc-taksit?${new URLSearchParams({ subeId: currentSube.id }).toString()}`, { cache: "no-store" }),
      fetch(`/api/admin/maas-ilave?${new URLSearchParams({ subeId: currentSube.id, ayYil }).toString()}`, { cache: "no-store" }),
      supabase
        .from("gider_kayitlari")
        .select("tarih, sube_id, ortak_pilarim, personel_paylari")
        .or(`ay_yil.eq.${ayYil},and(tarih.gte.${from},tarih.lte.${to})`)
        .order("tarih", { ascending: true }),
    ])

    const attendancePayload = await attendanceRes.json().catch(() => null) as AttendancePayload | null
    const approvalsPayload = await approvalsRes.json().catch(() => null)
    const avansPayload = await avansRes.json().catch(() => null)
    const maasOnayPayload = await maasOnayRes?.json().catch(() => null)
    const kesintiPayload = await kesintiRes?.json().catch(() => null)
    const maasZamPayload = await maasZamRes?.json().catch(() => null)
    const borcTaksitPayload = await borcTaksitRes?.json().catch(() => null)
    const ilavePayload = await ilaveRes?.json().catch(() => null)

    if (ilavePayload?.items) {
      setIlavelerList(ilavePayload.items)
    } else {
      setIlavelerList([])
    }

    if (allGiderRes?.data) {
      setAllBranchGiderRows(allGiderRes.data)
    } else {
      setAllBranchGiderRows([])
    }

    if (avansPayload?.requests) {
      setAvansTalepleri(avansPayload.requests)
    }

    if (kesintiPayload?.items) {
      setKesintilerList(kesintiPayload.items)
    } else {
      setKesintilerList([])
    }

    if (maasZamPayload?.items) {
      setMaasZamlariList(maasZamPayload.items)
    } else {
      setMaasZamlariList([])
    }

    if (borcTaksitPayload?.items) {
      setBorcTaksitleriList(borcTaksitPayload.items)
    } else {
      setBorcTaksitleriList([])
    }

    if (maasOnayPayload?.items) {
      const map: Record<string, MaasOnayi> = {}
      for (const item of maasOnayPayload.items) {
        map[item.personel_id] = item
      }
      setMaasOnaylari(map)
    } else {
      setMaasOnaylari({})
    }
    
    let allPersoneller = (personelRes.data || []).filter((p) => !isTestPersonnel(p))

    const is5ABranch = Boolean(
      currentSube.ad?.trim().toUpperCase().includes("5A") ||
      currentSube.id === "b63cce3d-2d0a-4d99-a9ec-25e2de4a6981"
    )

    // ÖMER KAHRİMAN 5A Şubesinde görünecek, 14 No Şubesi avans, mesai ve çorbaları Branch 14'ten okunacak
    let combinedCorbaData = corbaRes.data || []
    if (is5ABranch) {
      const { data: omerGider } = await supabase
        .from("gider_kayitlari")
        .select("tarih, personel_paylari, personel_mesai_detaylari, ortak_pilarim")
        .eq("sube_id", "172cc1f6-3012-47d3-a707-36e6f77e97cf") // Branch 14 ID
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true })

      if (omerGider) {
        setOmer14GiderRows(omerGider)
      }

      const { data: omer14Corba } = await supabase
        .from("corbalar")
        .select("tarih, personel_id, miktar")
        .eq("sube_id", "172cc1f6-3012-47d3-a707-36e6f77e97cf") // Branch 14 ID
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true })

      if (omer14Corba && omer14Corba.length > 0) {
        combinedCorbaData = [...combinedCorbaData, ...omer14Corba]
      }
    }
    const usedPersonelIds = new Set<string>()

    ;(giderRes.data || []).forEach(row => {
      if (row.personel_paylari) {
        Object.entries(row.personel_paylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
      }
      if (row.personel_mesai_detaylari) {
        Object.entries(row.personel_mesai_detaylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
      }
    })

    if (is5ABranch) {
      const { data: omerGider } = await supabase
        .from("gider_kayitlari")
        .select("tarih, personel_paylari, personel_mesai_detaylari, ortak_pilarim")
        .eq("sube_id", "172cc1f6-3012-47d3-a707-36e6f77e97cf") // Branch 14 ID
        .eq("ay_yil", ayYil)
        .order("tarih", { ascending: true })

      if (omerGider) {
        omerGider.forEach(row => {
          if (row.personel_paylari) {
            Object.entries(row.personel_paylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
          }
          if (row.personel_mesai_detaylari) {
            Object.entries(row.personel_mesai_detaylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
          }
        })
      }
    }

    ;(corbaRes.data || []).forEach(c => {
      if (Number(c.miktar) > 0) usedPersonelIds.add(c.personel_id)
    })

    if (kargoPrimRes.data?.secili_personeller && Array.isArray(kargoPrimRes.data.secili_personeller)) {
      (kargoPrimRes.data.secili_personeller as string[]).forEach(id => usedPersonelIds.add(id))
    }

    const monthIndex = MONTHS.indexOf(month) + 1
    const monthStartDate = `${year}-${String(monthIndex).padStart(2, "0")}-01`

    setPersoneller(allPersoneller.filter(p => {
      const exitedBeforeMonth = Boolean(p.isten_cikis_tarihi && p.isten_cikis_tarihi < monthStartDate)
      if (exitedBeforeMonth && !usedPersonelIds.has(p.id)) {
        return false
      }
      const isExitedThisMonthOrLater = Boolean(p.isten_cikis_tarihi && p.isten_cikis_tarihi >= monthStartDate)
      return p.aktif || isExitedThisMonthOrLater || usedPersonelIds.has(p.id)
    }))
    const rawOrtaklar = ortakRes.data || []
    const allBranchPersonelList = allBranchPersonelRes?.data || []

    const ortakMap = new Map<string, {
      ids: string[]
      ad: string
      aylik_maas: number
      sube_ids: string[]
      primaryId: string
    }>()

    rawOrtaklar.forEach(o => {
      const norm = normalizeName(o.ad)
      if (!ortakMap.has(norm)) {
        ortakMap.set(norm, {
          ids: [o.id],
          ad: o.ad,
          aylik_maas: Number(o.aylik_maas || 0),
          sube_ids: o.sube_id ? [o.sube_id] : [],
          primaryId: o.id,
        })
      } else {
        const existing = ortakMap.get(norm)!
        existing.ids.push(o.id)
        if (o.sube_id) existing.sube_ids.push(o.sube_id)
        if (Number(o.aylik_maas || 0) > existing.aylik_maas) {
          existing.aylik_maas = Number(o.aylik_maas || 0)
        }
      }
    })

    const uniqueOrtaklar: (Ortak & { aylik_maas: number; allMatchingIds: string[] })[] = []

    ortakMap.forEach((val, norm) => {
      const matchingPersoneller = allBranchPersonelList.filter(p => normalizeName(p.ad) === norm)
      const matchingPersonelIds = matchingPersoneller.map(p => p.id)

      let finalSalary = val.aylik_maas
      if (finalSalary <= 0) {
        const personSalary = Math.max(0, ...matchingPersoneller.map(p => Number(p.aylik_maas || 0)))
        if (personSalary > 0) finalSalary = personSalary
      }

      uniqueOrtaklar.push({
        id: val.primaryId,
        ad: val.ad,
        aylik_maas: finalSalary,
        allMatchingIds: Array.from(new Set([...val.ids, ...matchingPersonelIds])),
      } as any)
    })

    setOrtaklar(uniqueOrtaklar)
    setRows(giderRes.data || [])
    setAttendanceOvertime(attendanceRes.ok ? (attendancePayload?.details || []) : [])
    setOvertimeApprovals(approvalsRes.ok ? (approvalsPayload?.items || []) : [])
    setKargoPrimAmount(kargoPrimRes.data ? Number(kargoPrimRes.data.personel_hakedis || 0) : 0)
    setKargoSeciliPersoneller(kargoPrimRes.data?.secili_personeller ? (kargoPrimRes.data.secili_personeller as string[]) : null)
    setCorbaData(combinedCorbaData)
    setLoading(false)
  }

function formatSeniority(iseGirisTarihi?: string | null, istenCikisTarihi?: string | null): string | null {
  if (!iseGirisTarihi) return null
  const start = new Date(iseGirisTarihi)
  if (isNaN(start.getTime())) return null
  const end = istenCikisTarihi ? new Date(istenCikisTarihi) : new Date()

  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  let days = end.getDate() - start.getDate()

  if (days < 0) {
    months -= 1
    const prevMonthEnd = new Date(end.getFullYear(), end.getMonth(), 0).getDate()
    days += prevMonthEnd
  }
  if (months < 0) {
    years -= 1
    months += 12
  }

  const parts = []
  if (years > 0) parts.push(`${years} yıl`)
  if (months > 0) parts.push(`${months} ay`)
  if (days > 0 || parts.length === 0) parts.push(`${days} gün`)

  return istenCikisTarihi ? `${parts.join(" ")} çalıştı` : `${parts.join(" ")}dür çalışıyor`
}

  const personelSummaries = useMemo(() => personeller.map(personel => {
    const monthIndex = MONTHS.indexOf(month) + 1
    const monthPrefix = `${year}-${String(monthIndex).padStart(2, "0")}`

    // Check raise log for this personnel in selected month
    const activeZam = maasZamlariList.find(z => z.personel_id === personel.id && z.yururluk_tarihi && z.yururluk_tarihi.startsWith(monthPrefix)) || null

    const bankaMaas = Number(personel.banka_maas || 0)
    const nakitMaas = Number(personel.nakit_maas !== undefined && personel.nakit_maas !== null ? personel.nakit_maas : (personel.aylik_maas || 0))
    const rawBaseSalary = activeZam ? Number(activeZam.yeni_maas) : Number(personel.aylik_maas || (bankaMaas + nakitMaas))

    // Pro-rata Calculation for Entry and Exit Dates
    const totalDaysInMonth = new Date(year, monthIndex, 0).getDate()
    const monthStartDate = `${year}-${String(monthIndex).padStart(2, "0")}-01`
    const monthEndDate = `${year}-${String(monthIndex).padStart(2, "0")}-${String(totalDaysInMonth).padStart(2, "0")}`

    let prorationRatio = 1
    const entryInMonth = Boolean(personel.ise_giris_tarihi && personel.ise_giris_tarihi >= monthStartDate && personel.ise_giris_tarihi <= monthEndDate)
    const exitInMonth = Boolean(personel.isten_cikis_tarihi && personel.isten_cikis_tarihi >= monthStartDate && personel.isten_cikis_tarihi <= monthEndDate)

    if (entryInMonth || exitInMonth) {
      const startDay = entryInMonth ? new Date(personel.ise_giris_tarihi!).getDate() : 1
      const endDay = exitInMonth ? new Date(personel.isten_cikis_tarihi!).getDate() : totalDaysInMonth
      const workedDays = Math.max(1, endDay - startDay + 1)
      prorationRatio = Math.min(1, Math.max(0, workedDays / totalDaysInMonth))
    }

    const baseSalary = rawBaseSalary * prorationRatio

    const isSelectedForKargo = !kargoSeciliPersoneller || kargoSeciliPersoneller.includes(personel.id)
    let kargoHakedisAmount = 0
    if (isSelectedForKargo && kargoPrimAmount > 0) {
      kargoHakedisAmount = kargoPrimAmount * prorationRatio
    }

    const seniorityText = formatSeniority(personel.ise_giris_tarihi, personel.isten_cikis_tarihi)
    const hourlyRate = Number(personel.saatlik_mesai_ucreti) || (baseSalary > 0 ? baseSalary / 30 / 8 : 0)
    const advances: Detail[] = []
    const overtime: OvertimeDetail[] = []
    const approvalByLogId = new Map(
      overtimeApprovals
        .filter((item) => item.attendance_log_id && item.status === "approved")
        .map((item) => [Number(item.attendance_log_id), item]),
    )

    const corbaDetails: Detail[] = corbaData
      .filter(c => c.personel_id === personel.id && Number(c.miktar) > 0)
      .map(c => ({
        tarih: c.tarih,
        amount: Number(c.miktar),
        description: `Çorba kazanılan kaydı (${formatMoney(Number(c.miktar))} TL)`,
      }))
      .sort((a, b) => a.tarih.localeCompare(b.tarih))

    const corbaTotal = corbaDetails.reduce((sum, item) => sum + item.amount, 0)

    if (kargoHakedisAmount > 0) {
      overtime.push({
        tarih: getMonthStartDate(month, year),
        amount: kargoHakedisAmount,
        description: `${month} Ayı Kargo Hakediş`,
        hours: 0,
        rate: 0,
        minutes: 0,
        source: "manual",
      })
    }

    avansTalepleri
      .filter(req => req.durum === "onaylandi")
      .forEach(req => {
        const targetDate = req.odeme_tarihi || (req.created_at ? req.created_at.split("T")[0] : "")
        if (targetDate && targetDate.startsWith(monthPrefix)) {
          const reqName = normalizeName(req.user_name || "")
          const pName = normalizeName(personel.ad || "")
          
          const isMatch =
            (req.tc_kimlik && req.tc_kimlik === personel.id) ||
            (reqName && pName && (reqName === pName || reqName.includes(pName) || pName.includes(reqName))) ||
            (reqName && pName && reqName.split(" ").every(part => pName.includes(part)))

          if (isMatch) {
            const tutar = Number(req.tutar || 0)
            if (tutar > 0) {
              advances.push({
                tarih: targetDate,
                amount: tutar,
                description: "Özel Avans (Onaylı Avans Talebi)",
              })
            }
          }
        }
      })

    const is5ABranch = Boolean(
      currentSube?.ad?.trim().toUpperCase().includes("5A") ||
      currentSube?.id === "b63cce3d-2d0a-4d99-a9ec-25e2de4a6981"
    )
    const isOmerIn5A = is5ABranch && (
      personel.ad.toUpperCase().includes("ÖMER KAHRİMAN") ||
      personel.ad.toUpperCase().includes("OMER KAHRIMAN") ||
      personel.id === "78a15f68-edfd-493c-b8bd-5604acf599dd"
    )
    const targetGiderRows = isOmerIn5A ? omer14GiderRows : rows

    targetGiderRows.forEach(row => {
      const advanceAmount = Number(row.personel_paylari?.[personel.id]) || 0
      if (advanceAmount > 0) {
        advances.push({ tarih: row.tarih, amount: advanceAmount, description: "Alınan avans" })
      }

      const manualAmount = Number(row.personel_mesai_detaylari?.[personel.id]) || 0
      if (manualAmount > 0) {
        overtime.push({
          tarih: row.tarih,
          amount: manualAmount,
          description: `Gider kaydındaki manuel mesai tutarı`,
          hours: 0,
          rate: 0,
          minutes: 0,
          source: "manual",
          excludedFromTotal: true,
        })
      }
    })

    attendanceOvertime
      .filter(detail => detail.personelId === personel.id && (detail.payableOvertimeMinutes ?? detail.overtimeMinutes) > 0)
      .forEach(detail => {
        const approval = approvalByLogId.get(Number(detail.id))
        if (approval && approval.status === "rejected") return
        const payableMinutes = Number(approval?.payable_minutes) || detail.payableOvertimeMinutes || detail.overtimeMinutes
        const hours = payableMinutes / 60
        overtime.push({
          tarih: detail.workDate,
          amount: hours * hourlyRate,
          description: `Mesai takip: ${formatDurationFromMinutes(detail.overtimeMinutes)} (${formatDurationFromMinutes(payableMinutes)} x ${formatMoney(hourlyRate)} TL)`,
          hours,
          rate: hourlyRate,
          minutes: payableMinutes,
          source: "attendance",
        })
      })

    overtimeApprovals
      .filter((approval) => approval.status === "approved" && !approval.attendance_log_id)
      .filter((approval) => approval.personel_id === personel.id || normalizeName(approval.personel_name) === normalizeName(personel.ad))
      .forEach((approval) => {
        const payableMinutes = Number(approval.payable_minutes || approval.manual_minutes || 0)
        if (payableMinutes <= 0) return
        const hours = payableMinutes / 60
        overtime.push({
          tarih: approval.work_date || getMonthStartDate(month, year),
          amount: hours * hourlyRate,
          description: `Yonetici onayli manuel mesai: ${formatDurationFromMinutes(payableMinutes)} x ${formatMoney(hourlyRate)} TL${approval.note ? ` - ${approval.note}` : ""}`,
          hours,
          rate: hourlyRate,
          minutes: payableMinutes,
          source: "manual",
        })
      })

    const ilaveDetails = ilavelerList
      .filter(ilave => ilave.personel_id === personel.id)
      .map(ilave => ({
        id: ilave.id,
        tarih: ilave.tarih,
        amount: Number(ilave.tutar || 0),
        aciklama: ilave.aciklama || "Maaş İlave Ücret / Ödül",
      }))

    const ilaveTotal = ilaveDetails.reduce((sum, item) => sum + item.amount, 0)

    const kesintiDetails = kesintilerList.filter(k => k.personel_id === personel.id)
    const kesintiTotal = kesintiDetails.reduce((sum, item) => sum + Number(item.tutar || 0), 0)

    overtime.sort((a, b) => a.tarih.localeCompare(b.tarih) || a.source.localeCompare(b.source))
    const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0)
    const overtimeTotal = overtime.filter(item => !item.excludedFromTotal).reduce((sum, item) => sum + item.amount, 0) + ilaveTotal
    const mesaiKazanc = overtime
      .filter((item) => !item.description.includes("Kargo Hakediş"))
      .reduce((sum, item) => sum + item.amount, 0)
    const toplamKazanc = baseSalary + overtimeTotal + kargoHakedisAmount + corbaTotal
    const totalHakedis = baseSalary + overtimeTotal
    const remainingBeforeBank = Math.max(0, totalHakedis - advanceTotal - kesintiTotal)

    const onay = maasOnaylari[personel.id] || null
    const bankayaGonderilen = onay ? Number(onay.bankaya_gonderilen || 0) : 0

    // Dynamic kalanNakit formula using totalHakedis (Maaş + Mesailer - Avans - Banka - Kesintiler)
    const kalanNakit = Math.max(0, totalHakedis - advanceTotal - bankayaGonderilen - kesintiTotal)
    const nakitOdemeTarihi = onay ? onay.nakit_odeme_tarihi : null

    return {
      personel,
      baseSalary,
      bankaMaas,
      nakitMaas,
      bankayaGonderilen,
      kalanNakit,
      nakitOdemeTarihi,
      isApproved: Boolean(onay),
      nakitAlinacak: kalanNakit,
      kargoHakedisAmount,
      corbaTotal,
      corbaDetails,
      mesaiKazanc,
      toplamKazanc,
      hourlyRate,
      advances,
      overtime,
      advanceTotal,
      overtimeTotal,
      totalHakedis,
      remainingBeforeBank,
      remaining: kalanNakit,
      kesintiler: kesintiDetails,
      kesintiTotal,
      ilaveler: ilaveDetails,
      ilaveTotal,
      activeZam,
      seniorityText,
    }
  }), [attendanceOvertime, corbaData, kargoPrimAmount, kargoSeciliPersoneller, month, maasOnaylari, overtimeApprovals, personeller, rows, year, kesintilerList, ilavelerList, maasZamlariList])

  const ortakSummaries = useMemo(() => ortaklar.map(ortak => {
    const advances: (Detail & { subeAd: string; subeId: string })[] = []
    const subeMap = new Map(subeler.map(s => [s.id, s.ad]))
    const oNameNorm = normalizeName(ortak.ad)

    // Build strict set of matching IDs for this specific partner
    const allMatchingIds = new Set((ortak as any).allMatchingIds || [ortak.id])

    // Initialize all branches with 0 so EVERY SINGLE branch in the system is always visible!
    const branchTotals: Record<string, number> = {}
    subeler.forEach(s => {
      branchTotals[s.ad] = 0
    })

    allBranchGiderRows.forEach(row => {
      const subeAd = subeMap.get(row.sube_id) || "Bilinmeyen"

      // 1. Check ortak_pilarim
      if (row.ortak_pilarim) {
        Object.entries(row.ortak_pilarim).forEach(([k, v]) => {
          const amount = Number(v) || 0
          if (amount > 0) {
            const kNorm = normalizeName(k)
            if (allMatchingIds.has(k) || kNorm === oNameNorm) {
              branchTotals[subeAd] = (branchTotals[subeAd] || 0) + amount
              advances.push({
                tarih: row.tarih,
                amount,
                subeAd,
                subeId: row.sube_id,
                description: `${subeAd} Ortak Avansı`,
              })
            }
          }
        })
      }

      // 2. Check personel_paylari (for partners who also have personnel entries like Adem Yılmaz)
      if (row.personel_paylari) {
        Object.entries(row.personel_paylari).forEach(([k, v]) => {
          const amount = Number(v) || 0
          if (amount > 0) {
            const kNorm = normalizeName(k)
            if (allMatchingIds.has(k) || kNorm === oNameNorm) {
              branchTotals[subeAd] = (branchTotals[subeAd] || 0) + amount
              advances.push({
                tarih: row.tarih,
                amount,
                subeAd,
                subeId: row.sube_id,
                description: `${subeAd} Avansı (Personel Kaydı)`,
              })
            }
          }
        })
      }
    })

    advances.sort((a, b) => a.tarih.localeCompare(b.tarih))
    const total = advances.reduce((sum, item) => sum + item.amount, 0)
    const baseSalary = Number((ortak as any).aylik_maas || 0)
    const kalanNakit = baseSalary - total

    return { ortak, baseSalary, advances, total, kalanNakit, branchTotals }
  }), [ortaklar, allBranchGiderRows, subeler])

  const isManager = currentUserProfile?.isManager ?? isAdmin

  const visiblePersonelSummaries = useMemo(() => {
    if (isManager) return personelSummaries
    const rawDisplayName = currentUserProfile?.displayName || ""
    const myName = normalizeName(rawDisplayName)
    if (!myName) return personelSummaries.slice(0, 1)

    let matched = personelSummaries.filter(item => normalizeName(item.personel.ad) === myName)

    if (matched.length === 0) {
      matched = personelSummaries.filter(item => {
        const pName = normalizeName(item.personel.ad)
        return pName.includes(myName) || myName.includes(pName)
      })
    }

    if (matched.length === 0 && myName.includes(" ")) {
      const parts = myName.split(" ").filter(Boolean)
      matched = personelSummaries.filter(item => {
        const pName = normalizeName(item.personel.ad)
        return parts.every(part => pName.includes(part))
      })
    }

    return matched.length > 0 ? matched : (personelSummaries[0] ? [personelSummaries[0]] : [])
  }, [isManager, currentUserProfile?.displayName, personelSummaries])

  const visibleOrtakSummaries = useMemo(() => {
    if (!isManager) return []
    return ortakSummaries
  }, [isManager, ortakSummaries])

  const selectedPersonel = visiblePersonelSummaries.find(item => item.personel.id === selectedPersonelId) || visiblePersonelSummaries[0] || null
  const selectedOrtak = visibleOrtakSummaries.find(item => item.ortak.id === selectedOrtakId) || null
  const salaryTotals = useMemo(() => visiblePersonelSummaries.reduce((acc, item) => ({
    baseSalary: acc.baseSalary + item.baseSalary,
    advances: acc.advances + item.advanceTotal,
    overtime: acc.overtime + item.overtimeTotal,
    remaining: acc.remaining + item.remaining,
  }), { baseSalary: 0, advances: 0, overtime: 0, remaining: 0 }), [visiblePersonelSummaries])
  const ortakTotals = useMemo(() => visibleOrtakSummaries.reduce((acc, item) => ({
    baseSalary: acc.baseSalary + item.baseSalary,
    total: acc.total + item.total,
    kalanNakit: acc.kalanNakit + item.kalanNakit,
  }), { baseSalary: 0, total: 0, kalanNakit: 0 }), [visibleOrtakSummaries])

  async function handleAddKesintiForPersonel(personelId: string) {
    if (!currentSube || !personelId || !kesintiTutarInput) {
      toast.error("Lütfen kesinti tutarını giriniz.")
      return
    }
    const val = Number(kesintiTutarInput)
    if (isNaN(val) || val <= 0) {
      toast.error("Geçerli bir kesinti tutarı girin.")
      return
    }

    setKesintiSubmitting(true)
    try {
      const res = await fetch("/api/admin/maas-kesinti", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sube_id: currentSube.id,
          ay_yil: ayYil,
          personel_id: personelId,
          tutar: val,
          aciklama: kesintiAciklamaInput || "Maaş Kesintisi",
          tarih: kesintiTarihInput || new Date().toISOString().split("T")[0],
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Kesinti kaydedilemedi.")

      toast.success("Kesinti başarıyla kaydedildi.")
      setKesintiTutarInput("")
      setKesintiAciklamaInput("")
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Hata oluştu.")
    } finally {
      setKesintiSubmitting(false)
    }
  }

  const [deleteModalState, setDeleteModalState] = useState<{
    open: boolean
    id: string
    title: string
    description: string
  }>({
    open: false,
    id: "",
    title: "Kesintiyi Sil",
    description: "Bu kesintiyi silmek istediğinize emin misiniz?",
  })

  function handleDeleteKesinti(id: string) {
    setDeleteModalState({
      open: true,
      id,
      title: "Kesintiyi Sil",
      description: "Bu kesinti kaydını silmek istediğinize emin misiniz? Yapılan işlem veritabanından silinecek ve kalan nakit tutarı güncellenecektir.",
    })
  }

  async function executeDeleteKesinti() {
    const id = deleteModalState.id
    setDeleteModalState(prev => ({ ...prev, open: false }))
    if (!id) return
    try {
      const res = await fetch(`/api/admin/maas-kesinti?id=${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Silinemedi.")
      toast.success("Kesinti silindi ve kalan nakit güncellendi.")
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Hata oluştu.")
    }
  }

  async function handleSaveMaasZam() {
    if (!currentSube || !zamTargetId || !zamYuvarlamaInput) {
      toast.error("Lütfen hedef ve yeni maaş tutarını girin.")
      return
    }

    const newSalary = Number(zamYuvarlamaInput)
    if (isNaN(newSalary) || newSalary <= 0) {
      toast.error("Geçerli bir yeni maaş tutarı giriniz.")
      return
    }

    const currentTarget = zamTargetType === "personel" 
      ? personeller.find(p => p.id === zamTargetId)
      : ortaklar.find(o => o.id === zamTargetId)

    const eskiMaas = currentTarget ? Number((currentTarget as any).aylik_maas || 0) : 0
    const zamOrani = Number(zamOraniInput || 0)

    setZamSubmitting(true)
    try {
      const res = await fetch("/api/admin/maas-zam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: zamTargetType,
          target_id: zamTargetId,
          sube_id: currentSube.id,
          eski_maas: eskiMaas,
          zam_orani: zamOrani,
          yeni_maas: newSalary,
          yururluk_tarihi: zamTarihInput,
          aciklama: zamAciklamaInput || "Maaş Zammı",
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Maaş zammı kaydedilemedi.")

      toast.success("Maaş zammı başarıyla uygulandı ve kaydedildi.")
      setZamModalOpen(false)
      setZamTargetId("")
      setZamOraniInput("")
      setZamYuvarlamaInput("")
      setZamAciklamaInput("")
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Hata oluştu.")
    } finally {
      setZamSubmitting(false)
    }
  }

  function openTaksitModal(personelId: string) {
    setTaksitPersonelId(personelId)
    setTaksitToplamBorcInput("")
    setTaksitSayisiInput("")
    setTaksitAciklamaInput("")
    setTaksitBaslangicTarihiInput(new Date().toISOString().split("T")[0])
    setTaksitModalOpen(true)
  }

  async function handleSaveBorcTaksit() {
    if (!currentSube || !taksitPersonelId || !taksitToplamBorcInput || !taksitSayisiInput) {
      toast.error("Lütfen toplam borç ve taksit sayısını girin.")
      return
    }

    const totalBorc = Number(taksitToplamBorcInput)
    const count = Number(taksitSayisiInput)

    if (isNaN(totalBorc) || totalBorc <= 0 || isNaN(count) || count < 1) {
      toast.error("Geçerli borç tutarı ve taksit sayısı girin.")
      return
    }

    setTaksitSubmitting(true)
    try {
      const res = await fetch("/api/admin/borc-taksit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personel_id: taksitPersonelId,
          sube_id: currentSube.id,
          toplam_borc: totalBorc,
          taksit_sayisi: count,
          aciklama: taksitAciklamaInput || "Taksitli Borç",
          baslangic_tarihi: taksitBaslangicTarihiInput,
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || "Taksitlendirme kaydedilemedi.")

      toast.success("Borç taksitlendirmesi başlatıldı ve aylık kesintiler eklendi.")
      setTaksitModalOpen(false)
      setTaksitToplamBorcInput("")
      setTaksitSayisiInput("")
      setTaksitAciklamaInput("")
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Hata oluştu.")
    } finally {
      setTaksitSubmitting(false)
    }
  }

  function exportGeneralPdf() {
    openPdfReport({
      title: "Maaşlar Genel Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [],
      tables: [
        {
          title: "Personel Maaşları",
          headers: ["Personel", "Net Maaş", "Ekstra/Prim", "Toplam Maliyet", "Avans", "Bankaya Gönderilen", "Kalan Nakit"],
          firstColumnWidth: "18%",
          rows: personelSummaries.map(item => [
            item.personel.ad,
            `${formatMoney(item.baseSalary)} TL`,
            `+${formatMoney(item.overtimeTotal)} TL`,
            `${formatMoney(item.baseSalary + item.overtimeTotal)} TL`,
            `-${formatMoney(item.advanceTotal + item.kesintiTotal)} TL`,
            `${formatMoney(item.bankayaGonderilen)} TL`,
            `${formatMoney(item.kalanNakit)} TL`,
          ]),
        },
        {
          title: "Ortaklar Pay",
          headers: ["Ortak", "Net Maaş", "Alınan Avans", "Kalan Nakit"],
          firstColumnWidth: "25%",
          rows: ortakSummaries.map(item => [
            item.ortak.ad,
            `${formatMoney(item.baseSalary)} TL`,
            `-${formatMoney(item.total)} TL`,
            `${formatMoney(item.kalanNakit)} TL`,
          ]),
        },
      ],
    })
  }

  function exportPersonelPdf(item = selectedPersonel) {
    if (!item) return
    openPdfReport({
      title: `${item.personel.ad} Maaş Hakediş Raporu`,
      subtitle: `${currentSube?.ad || ""} · ${month} ${year}`,
      orientation: "portrait",
      metrics: [
        // SOL TARAF — GELİR KUTUCUKLARI (YEŞİL RAKAMLAR)
        ...(item.personel.ise_giris_tarihi ? [{ label: "İşe Giriş Tarihi", value: formatDate(item.personel.ise_giris_tarihi), side: "left" as const, color: "green" as const }] : []),
        { label: "Net Maaş (Taban)", value: `+${formatMoney(item.baseSalary)} TL`, side: "left" as const, color: "green" as const },
        ...(item.kargoHakedisAmount > 0 ? [{ label: "Kargo Prim", value: `+${formatMoney(item.kargoHakedisAmount)} TL`, side: "left" as const, color: "green" as const }] : []),
        ...(item.corbaTotal > 0 ? [{ label: "Çorba Kazanç", value: `+${formatMoney(item.corbaTotal)} TL`, side: "left" as const, color: "green" as const }] : []),
        { label: "Mesai Ücreti", value: `+${formatMoney(item.mesaiKazanc)} TL`, side: "left" as const, color: "green" as const },
        { label: "Toplam Kazanç", value: `+${formatMoney(item.toplamKazanc)} TL`, side: "left" as const, color: "green" as const },

        // SAĞ TARAF — GİDER KUTUCUKLARI (KIRMIZI / SİYAH RAKAMLAR)
        { label: "Alınan Avans", value: `-${formatMoney(item.advanceTotal)} TL`, side: "right" as const, color: "red" as const },
        ...(item.kesintiTotal > 0 ? [{ label: "Yapılan Kesintiler", value: `-${formatMoney(item.kesintiTotal)} TL`, side: "right" as const, color: "red" as const }] : []),
        { label: "Bankaya Gönderilen", value: `-${formatMoney(item.bankayaGonderilen)} TL`, side: "right" as const, color: "red" as const },
        { label: item.nakitOdemeTarihi ? `${formatDate(item.nakitOdemeTarihi)} Nakit Alınacak` : "Nakit Alınacak Net", value: `${formatMoney(item.kalanNakit)} TL`, side: "right" as const, color: "black" as const },
      ],
      tables: [
        {
          title: "ALINAN AVANS DETAYI",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
        },
        ...(item.ilaveler && item.ilaveler.length > 0 ? [{
          title: "İLAVE ÜCRETLER & PRİM / ÖDÜLLER",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.ilaveler.map((detail: any) => [
            formatDate(detail.tarih),
            detail.aciklama,
            `+${formatMoney(Number(detail.amount))} TL`,
          ]),
        }] : []),
        ...(item.kesintiler && item.kesintiler.length > 0 ? [{
          title: "KESİNTİLER DETAYI",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.kesintiler.map((detail: any) => [
            formatDate(detail.tarih),
            detail.aciklama,
            `-${formatMoney(Number(detail.tutar))} TL`,
          ]),
        }] : []),
        {
          title: "MESAİLER",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.overtime
            .filter(detail => !detail.description.includes("Kargo Hakediş"))
            .map(detail => [
              formatDate(detail.tarih),
              detail.description + (detail.excludedFromTotal ? " (Maaşa eklenmez)" : ""),
              `+${formatMoney(detail.amount)} TL`,
            ]),
        },
        ...(item.activeZam ? [{
          title: "MAAŞ ZAM BİLGİSİ",
          headers: ["Geçerlilik Tarihi", "Açıklama", "Eski Maaş ➔ Yeni Maaş"],
          firstColumnWidth: "28%",
          rows: [[
            formatDate(item.activeZam.yururluk_tarihi),
            item.activeZam.aciklama || "Maaş Zammı Uygulandı",
            `${formatMoney(item.activeZam.eski_maas)} TL ➔ ${formatMoney(item.activeZam.yeni_maas)} TL (+%${item.activeZam.zam_orani} Zam)`,
          ]],
        }] : []),
      ],
    })
  }

  function exportOrtakPdf(item = selectedOrtak) {
    if (!item) return
    const branchRows = subeler.map(s => [
      `${s.ad} Şubesi`,
      `-${formatMoney(item.branchTotals?.[s.ad] || 0)} TL`,
    ])

    openPdfReport({
      title: `${item.ortak.ad} Ortak Pay Detayı`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "portrait",
      metrics: [
        { label: "Net Maaş", value: `${formatMoney(item.baseSalary)} TL`, side: "left" as const, color: "green" as const },
        { label: "Toplam Alınan Avans", value: `-${formatMoney(item.total)} TL`, side: "right" as const, color: "red" as const },
        { label: "Kalan Nakit", value: `${formatMoney(item.kalanNakit)} TL`, side: "right" as const, color: item.kalanNakit >= 0 ? "black" as const : "red" as const },
      ],
      tables: [
        {
          title: "ŞUBE BAZLI AVANS DAĞILIMI ÖZETİ (TÜM ŞUBELER)",
          headers: ["Şube Adı", "Şube Avans Toplamı"],
          firstColumnWidth: "50%",
          rows: branchRows,
        },
        {
          title: "ORTAK AVANS DETAYLARI (ŞUBE BAZLI KRONOLOJİK)",
          headers: ["Tarih", "Açıklama / Şube", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
        },
      ],
    })
  }

  async function handleAddIlaveForPersonel(personelId: string) {
    if (!currentSube) return
    const tutar = Number(ilaveTutarInput)
    if (!tutar || isNaN(tutar) || tutar <= 0) {
      toast.error("Lütfen geçerli bir ilave ücret tutarı girin.")
      return
    }
    if (!ilaveAciklamaInput.trim()) {
      toast.error("Lütfen ilave ücret açıklamasını yazın.")
      return
    }

    setIlaveSubmitting(true)
    try {
      const res = await fetch("/api/admin/maas-ilave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sube_id: currentSube.id,
          ay_yil: ayYil,
          personel_id: personelId,
          tutar,
          aciklama: ilaveAciklamaInput.trim(),
          tarih: ilaveTarihInput,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "İlave ücret kaydedilemedi.")

      toast.success("Maaş ilave ücreti / prim başarıyla eklendi.")
      setIlaveTutarInput("")
      setIlaveAciklamaInput("")
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Hata oluştu.")
    } finally {
      setIlaveSubmitting(false)
    }
  }

  async function handleDeleteIlave(id: string) {
    try {
      const res = await fetch(`/api/admin/maas-ilave?id=${id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "İlave ücret silinemedi.")
        return
      }
      toast.success("İlave ücret kaydı silindi.")
      loadData()
    } catch {
      toast.error("İşlem yapılırken hata oluştu.")
    }
  }

  async function handleSaveMaasAyari() {
    const tutar = Number(maasAyariTutarInput)
    if (isNaN(tutar) || tutar < 0) {
      toast.error("Lütfen geçerli bir maaş tutarı girin.")
      return
    }
    if (!maasAyariTargetId) {
      toast.error("Lütfen bir kişi seçin.")
      return
    }

    setMaasAyariSaving(true)
    try {
      if (maasAyariType === "personel") {
        const { error } = await supabase
          .from("personeller")
          .update({ aylik_maas: tutar })
          .eq("id", maasAyariTargetId)
        if (error) throw error
      } else {
        const targetOrtak = ortaklar.find(o => o.id === maasAyariTargetId)
        if (targetOrtak) {
          const matchingIds = (targetOrtak as any).allMatchingIds || [targetOrtak.id]
          const { error } = await supabase
            .from("ortaklar")
            .update({ aylik_maas: tutar })
            .in("id", matchingIds)
          if (error) throw error
          await supabase
            .from("personeller")
            .update({ aylik_maas: tutar })
            .in("id", matchingIds)
        } else {
          const { error } = await supabase
            .from("ortaklar")
            .update({ aylik_maas: tutar })
            .eq("id", maasAyariTargetId)
          if (error) throw error
        }
      }
      toast.success("Net taban maaş tutarı başarıyla güncellendi.")
      setMaasAyarlariModalOpen(false)
      loadData()
    } catch (err: any) {
      toast.error(err.message || "Maaş güncellenirken hata oluştu.")
    } finally {
      setMaasAyariSaving(false)
    }
  }

  const prevMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 0) {
      if (year > START_YEAR) {
        setMonth(MONTHS[11])
        setYear(year - 1)
      }
    } else {
      setMonth(MONTHS[currentIndex - 1])
    }
  }

  const nextMonth = () => {
    const currentIndex = MONTHS.indexOf(month)
    if (currentIndex === 11) {
      setMonth(MONTHS[0])
      setYear(year + 1)
    } else {
      setMonth(MONTHS[currentIndex + 1])
    }
  }

  async function handleAvansAction() {
    if (!actionModal.request) return
    if (actionModal.type === "approve" && !modalInput) {
      toast.error("Ödeme tarihi seçilmesi zorunludur.")
      return
    }
    if (actionModal.type === "reject" && !modalInput.trim()) {
      toast.error("Red sebebi yazılması zorunludur.")
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch("/api/admin/avans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionModal.type,
          id: actionModal.request.id,
          odeme_tarihi: actionModal.type === "approve" ? modalInput : undefined,
          red_sebebi: actionModal.type === "reject" ? modalInput : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "İşlem gerçekleştirilemedi.")
        return
      }

      toast.success(actionModal.type === "approve" ? "Avans talebi onaylandı ve personele bildirim gönderildi." : "Avans talebi reddedildi.")
      setActionModal({ open: false, request: null, type: "approve" })
      setModalInput("")
      loadData()
    } catch {
      toast.error("Bir hata oluştu.")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleSendAvansRequest() {
    const tutar = Number(requestTutar)
    if (!tutar || isNaN(tutar) || tutar <= 0) {
      toast.error("Lütfen geçerli bir avans tutarı girin.")
      return
    }

    setSubmittingRequest(true)
    try {
      const res = await fetch("/api/mobile/avans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tutar, aciklama: requestAciklama }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Avans talebi iletilemedi.")
        return
      }

      toast.success("Avans talebiniz yöneticilere iletildi.")
      setRequestModalOpen(false)
      setRequestTutar("")
      setRequestAciklama("")
      loadData()
    } catch {
      toast.error("Bir hata oluştu.")
    } finally {
      setSubmittingRequest(false)
    }
  }

  function openApproveModal(personelId: string) {
    const item = visiblePersonelSummaries.find(p => p.personel.id === personelId)
    if (!item) return
    setApproveTargetPersonelId(personelId)
    setApproveBankaInput(item.bankayaGonderilen ? String(item.bankayaGonderilen) : "15000")
    const defaultDate = item.nakitOdemeTarihi || `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, "0")}-15`
    setApproveNakitTarihi(defaultDate)
    setApproveModalOpen(true)
  }

  async function handleSaveMaasApproval() {
    const targetItem = visiblePersonelSummaries.find(p => p.personel.id === approveTargetPersonelId)
    if (!targetItem || !currentSube) return

    const bankaAmt = Number(approveBankaInput)
    if (isNaN(bankaAmt) || bankaAmt < 0) {
      toast.error("Lütfen geçerli bir bankaya gönderilen tutar girin.")
      return
    }

    const kalanAmt = Math.max(0, targetItem.remainingBeforeBank - bankaAmt)
    if (!approveNakitTarihi) {
      toast.error("Lütfen kalan nakit ödeme tarihini seçin.")
      return
    }

    setSavingApproval(true)
    try {
      const res = await fetch("/api/admin/maas-onay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sube_id: currentSube.id,
          ay_yil: ayYil,
          personel_id: targetItem.personel.id,
          bankaya_gonderilen: bankaAmt,
          kalan_nakit: kalanAmt,
          nakit_odeme_tarihi: approveNakitTarihi,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Maaş onayı kaydedilemedi.")
        return
      }

      toast.success(`${targetItem.personel.ad} maaş onayı kaydedildi.`)
      setApproveModalOpen(false)
      loadData()
    } catch {
      toast.error("Maaş onayı kaydedilirken bir hata oluştu.")
    } finally {
      setSavingApproval(false)
    }
  }

  const pendingAvansList = useMemo(() => avansTalepleri.filter(item => item.durum === "beklemede"), [avansTalepleri])

  const myAvansTalepleri = useMemo(() => {
    if (isManager) {
      const myName = normalizeName(currentUserProfile?.displayName)
      if (!myName) return avansTalepleri
      return avansTalepleri.filter(req => {
        const rName = normalizeName(req.user_name)
        return rName === myName || rName.includes(myName) || myName.includes(rName)
      })
    }
    return avansTalepleri
  }, [avansTalepleri, currentUserProfile?.displayName, isManager])

  const filteredAvansTalepleri = useMemo(() => {
    return avansTalepleri.filter(item => {
      if (avansFilterStatus !== "all" && item.durum !== avansFilterStatus) return false
      
      if (avansSearchName.trim()) {
        const search = normalizeName(avansSearchName)
        const name = normalizeName(item.user_name)
        if (!name.includes(search)) return false
      }

      const reqDate = item.created_at ? item.created_at.split("T")[0] : ""
      if (avansStartDate && reqDate < avansStartDate) return false
      if (avansEndDate && reqDate > avansEndDate) return false

      return true
    })
  }, [avansTalepleri, avansFilterStatus, avansSearchName, avansStartDate, avansEndDate])

  if (subeLoading || loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Yükleniyor...</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-3 bg-emerald-700 p-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6" />
          <h1 className="text-xl font-bold">{isManager ? "Maaşlar" : "Maaşım"}</h1>
          {isManager && pendingAvansList.length > 0 && (
            <Badge className="bg-amber-400 text-amber-950 font-bold px-2.5 py-1 text-xs animate-pulse">
              <HandCoins className="h-3.5 w-3.5 mr-1" />
              {pendingAvansList.length} Avans Talebi
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-[auto_1fr_0.8fr_auto] items-center gap-2 sm:flex">
          {isManager && (
            <>
              <Button
                onClick={() => {
                  setMaasAyariTargetId(personeller[0]?.id || "")
                  setMaasAyariTutarInput(String(personeller[0]?.aylik_maas || ""))
                  setMaasAyarlariModalOpen(true)
                }}
                className="col-span-full gap-2 border-emerald-400 bg-emerald-900 hover:bg-emerald-950 text-white font-bold shadow-sm sm:col-span-1"
              >
                <Calculator className="h-4 w-4" />
                Maaş Ayarları
              </Button>
              <Button
                onClick={() => {
                  setZamTargetId("")
                  setZamOraniInput("")
                  setZamYuvarlamaInput("")
                  setZamModalOpen(true)
                }}
                className="col-span-full gap-2 border-emerald-400 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm sm:col-span-1"
              >
                <TrendingUp className="h-4 w-4" />
                Maaş Zammı Yap
              </Button>
            </>
          )}
          <Button
            onClick={() => setRequestModalOpen(true)}
            className="col-span-full gap-2 border-amber-400 bg-amber-400 text-amber-950 hover:bg-amber-300 font-bold shadow-sm sm:col-span-1"
          >
            <HandCoins className="h-4 w-4" />
            Avans İste
          </Button>
          <Button
            variant="outline"
            onClick={isManager ? exportGeneralPdf : () => visiblePersonelSummaries[0] && exportPersonelPdf(visiblePersonelSummaries[0])}
            className="col-span-full gap-2 border-emerald-500 bg-white/10 text-white hover:bg-emerald-800 sm:col-span-1"
          >
            <FileText className="h-4 w-4" />
            {isManager ? "Genel PDF" : "Maaşım PDF"}
          </Button>
          <Button variant="ghost" size="icon" onClick={prevMonth} className="text-white hover:bg-emerald-800">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.filter((_, index) => year !== START_YEAR || index >= START_MONTH_INDEX).map(item => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-full min-w-0 border-emerald-500 bg-emerald-800 text-white sm:w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((item: number) => (
                <SelectItem key={item} value={item.toString()}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={nextMonth} className="text-white hover:bg-emerald-800">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-4">
        {/* Urgent Top Pending Avans Requests Banner (Only when pending requests exist) */}
        {isManager && pendingAvansList.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-500/10 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-200">
                  <HandCoins className="h-5 w-5 text-amber-600 animate-bounce" />
                  ⚠️ Bekleyen Avans Talepleri ({pendingAvansList.length})
                </CardTitle>
                <Badge className="bg-amber-500 text-white font-bold">
                  Onay Bekliyor
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pendingAvansList.map(req => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-amber-300 bg-white dark:border-amber-500/40 dark:bg-slate-900 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm truncate">{req.user_name}</span>
                      <Badge className="bg-amber-500 text-white">Beklemede</Badge>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                        {Number(req.tutar).toLocaleString("tr-TR")} ₺
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                    {req.aciklama ? (
                      <p className="mt-2 text-xs italic text-muted-foreground bg-muted/50 p-2 rounded">
                        "{req.aciklama}"
                      </p>
                    ) : null}
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-dashed">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                        onClick={() => {
                          setActionModal({ open: true, request: req, type: "approve" })
                          setModalInput(new Date().toISOString().split("T")[0])
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs gap-1"
                        onClick={() => {
                          setActionModal({ open: true, request: req, type: "reject" })
                          setModalInput("")
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reddet
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Personnel Summary Cards */}
        <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
          {visiblePersonelSummaries.map(item => (
            <Card
              key={item.personel.id}
              className={`cursor-pointer shadow-sm transition hover:shadow ${
                item.remaining < 0
                  ? "border-red-200 bg-red-50 hover:border-red-400 dark:border-red-500/30 dark:bg-red-500/15"
                  : "border-emerald-200 bg-emerald-50 hover:border-emerald-400 dark:border-emerald-500/30 dark:bg-emerald-500/15"
              }`}
              onClick={() => setSelectedPersonelId(item.personel.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <p className="truncate text-xs font-bold uppercase text-foreground">{item.personel.ad}</p>
                  {item.isApproved ? (
                    <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5">Onaylandı</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">Bekliyor</Badge>
                  )}
                </div>
                <p className={`text-xl font-extrabold ${item.remaining < 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>
                  {formatMoney(item.remaining)} TL
                </p>
                <div className="mt-2 space-y-1 text-xs border-t pt-2 border-emerald-200/60 dark:border-emerald-500/20">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Net Maaş:</span>
                    <span className="font-semibold text-foreground">{formatMoney(item.baseSalary)} TL</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Bankaya Gönderilen:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">{formatMoney(item.bankayaGonderilen)} TL</span>
                  </div>
                  {item.overtimeTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Ekstra / Prim:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(item.overtimeTotal)} TL</span>
                    </div>
                  )}
                  {item.advanceTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Alınan Avans:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">-{formatMoney(item.advanceTotal)} TL</span>
                    </div>
                  )}
                  {item.kesintiTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Yapılan Kesinti:</span>
                      <span className="font-bold text-red-600 dark:text-red-400">-{formatMoney(item.kesintiTotal)} TL</span>
                    </div>
                  )}
                  {item.nakitOdemeTarihi && (
                    <div className="mt-2 pt-1.5 border-t border-dashed text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                      <span>Nakit Tarihi:</span>
                      <span>{formatDate(item.nakitOdemeTarihi)}</span>
                    </div>
                  )}
                </div>
                {isManager && (
                  <Button
                    size="sm"
                    className={`w-full mt-3 h-8 text-xs font-bold gap-1.5 transition-all shadow-sm rounded-lg border ${
                      item.isApproved
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 dark:hover:bg-emerald-500/30 border-emerald-600/30"
                        : "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 border-blue-500/30"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      openApproveModal(item.personel.id)
                    }}
                  >
                    {item.isApproved ? <Edit3 className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {item.isApproved ? "Onayı Düzenle" : "Maaş Onayla"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Personnel Detail */}
        {selectedPersonel && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg font-bold">{selectedPersonel.personel.ad} Maaş Detayı</CardTitle>
                    {selectedPersonel.personel.ise_giris_tarihi && (
                      <Badge className="bg-sky-700 text-white font-bold text-xs px-2.5 py-1 flex items-center gap-1 shadow-sm">
                        <CalendarDays className="w-3.5 h-3.5" />
                        İşe Giriş: {formatDate(selectedPersonel.personel.ise_giris_tarihi)}
                        {selectedPersonel.seniorityText ? ` · ${selectedPersonel.seniorityText}` : ""}
                      </Badge>
                    )}
                    {selectedPersonel.isApproved && selectedPersonel.nakitOdemeTarihi && (
                      <Badge className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-1">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        {formatDate(selectedPersonel.nakitOdemeTarihi)} Nakit: {formatMoney(selectedPersonel.kalanNakit)} TL
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span>Maaş (Taban): <strong className="text-foreground">{formatMoney(selectedPersonel.baseSalary)} TL</strong></span>
                    {selectedPersonel.kargoHakedisAmount > 0 && (
                      <span>Kargo Prim: <strong className="text-emerald-600 dark:text-emerald-400">+{formatMoney(selectedPersonel.kargoHakedisAmount)} TL</strong></span>
                    )}
                    {selectedPersonel.mesaiKazanc > 0 && (
                      <span>Mesai Kazanç: <strong className="text-emerald-600 dark:text-emerald-400">+{formatMoney(selectedPersonel.mesaiKazanc)} TL</strong></span>
                    )}
                    {selectedPersonel.corbaTotal > 0 && (
                      <span>Çorba Kazanç: <strong className="text-amber-600 dark:text-amber-400">+{formatMoney(selectedPersonel.corbaTotal)} TL</strong></span>
                    )}
                    <span>Toplam Kazanç: <strong className="text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">{formatMoney(selectedPersonel.toplamKazanc)} TL</strong></span>
                    <span>Alınan Avans: <strong className="text-red-600">-{formatMoney(selectedPersonel.advanceTotal)} TL</strong></span>
                    {selectedPersonel.kesintiTotal > 0 && (
                      <span>Yapılan Kesinti: <strong className="text-red-600 dark:text-red-400">-{formatMoney(selectedPersonel.kesintiTotal)} TL</strong></span>
                    )}
                    <span>Bankaya Gönderilen: <strong className="text-blue-600 dark:text-blue-400">{formatMoney(selectedPersonel.bankayaGonderilen)} TL</strong></span>
                    <span>Kalan Nakit: <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold">{formatMoney(selectedPersonel.kalanNakit)} TL</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isManager && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openTaksitModal(selectedPersonel.personel.id)}
                        className="gap-1.5 border-purple-300 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 font-bold"
                      >
                        <CreditCard className="h-4 w-4" />
                        Taksitlendir
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openApproveModal(selectedPersonel.personel.id)}
                        className={`gap-2 font-bold shadow-sm rounded-lg border transition-all ${
                          selectedPersonel.isApproved
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 dark:hover:bg-emerald-500/30 border-emerald-600/30"
                            : "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 border-blue-500/30"
                        }`}
                      >
                        <ShieldCheck className="h-4 w-4" />
                        {selectedPersonel.isApproved ? "Maaş Onayını Düzenle" : "Maaş Onayla"}
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => exportPersonelPdf(selectedPersonel)} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Personel PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <DetailList
                title="Alınan Avanslar"
                items={selectedPersonel.advances}
                empty="Bu ay alınan avans yok."
                totalLabel="Toplam Alınan Avans"
                variant="expense"
              />
              <DetailList
                title={`Mesailer ve Hakedişler (${formatMoney(selectedPersonel.hourlyRate)} TL/saat)`}
                items={selectedPersonel.overtime}
                empty="Mesai veya prim hakedişi yok."
                totalLabel="Toplam Ekstra / Hakediş"
                variant="income"
              />
              <DetailList
                title="Çorba Kazanılan Detayı"
                items={selectedPersonel.corbaDetails}
                empty="Bu ay çorba kaydı bulunmuyor."
                totalLabel="Toplam Çorba Kazanılan"
                variant="info"
              />

              {/* Kesintiler & Kesinti Ekleme Modülü (Seçili Personel İçin) */}
              <div className="col-span-full border-t pt-4 mt-2">
                <div className="rounded-xl border bg-slate-50/50 dark:bg-slate-900/30 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
                      <Scissors className="h-4 w-4" />
                      {selectedPersonel.personel.ad} — Maaş Kesintileri ({selectedPersonel.kesintiler.length})
                    </h4>
                    {selectedPersonel.kesintiTotal > 0 && (
                      <Badge variant="destructive" className="font-extrabold text-xs">
                        Toplam Kesinti: -{formatMoney(selectedPersonel.kesintiTotal)} TL
                      </Badge>
                    )}
                  </div>

                  {/* Manager Add Kesinti Form */}
                  {isManager && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end border-t pt-3 border-dashed">
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">Kesinti Tutarı (₺) *</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Örn: 100"
                          value={kesintiTutarInput}
                          onChange={(e) => setKesintiTutarInput(e.target.value)}
                          className="w-full h-10 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">Kesinti Açıklaması *</label>
                        <Input
                          placeholder="Örn: Ekipman hasar bedeli"
                          value={kesintiAciklamaInput}
                          onChange={(e) => setKesintiAciklamaInput(e.target.value)}
                          className="w-full h-10 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">Kesinti Tarihi</label>
                        <ModernDatePicker
                          label=""
                          value={kesintiTarihInput}
                          onChange={(val) => setKesintiTarihInput(val)}
                          buttonClassName="w-full h-10 text-xs bg-background border-input rounded-md px-3"
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white text-xs gap-1.5 font-bold"
                          onClick={() => handleAddKesintiForPersonel(selectedPersonel.personel.id)}
                          disabled={kesintiSubmitting || !kesintiTutarInput}
                        >
                          <Plus className="h-4 w-4" />
                          {kesintiSubmitting ? "Kaydediliyor..." : `${selectedPersonel.personel.ad} İçin Kesintiyi Kaydet`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Kesintiler Listesi Tablosu */}
                  <div className="rounded-lg border overflow-hidden bg-background">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-2">Tarih</th>
                          <th className="px-4 py-2">Açıklama</th>
                          <th className="px-4 py-2 text-right">Kesinti Tutarı</th>
                          {isManager && <th className="px-4 py-2 text-right">İşlem</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPersonel.kesintiler.length === 0 ? (
                          <tr>
                            <td colSpan={isManager ? 4 : 3} className="px-4 py-4 text-center text-muted-foreground italic">
                              Bu ay için {selectedPersonel.personel.ad} adına kaydedilmiş kesinti bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          selectedPersonel.kesintiler.map((k: any) => (
                            <tr key={k.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(k.tarih)}</td>
                              <td className="px-4 py-2.5 font-medium">{k.aciklama}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-red-600 dark:text-red-400">
                                -{Number(k.tutar).toLocaleString("tr-TR")} ₺
                              </td>
                              {isManager && (
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                    onClick={() => handleDeleteKesinti(k.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* İlave Ücretler & Ödüller Modülü (Seçili Personel İçin) */}
              <div className="col-span-full border-t pt-4 mt-2">
                <div className="rounded-xl border bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      {selectedPersonel.personel.ad} — Maaş İlave Ücretleri & Prim / Ödüller ({selectedPersonel.ilaveler.length})
                    </h4>
                    {selectedPersonel.ilaveTotal > 0 && (
                      <Badge className="bg-emerald-600 text-white font-extrabold text-xs">
                        Toplam İlave: +{formatMoney(selectedPersonel.ilaveTotal)} TL
                      </Badge>
                    )}
                  </div>

                  {/* Manager Add İlave Form */}
                  {isManager && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end border-t pt-3 border-dashed">
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">İlave / Ödül Tutarı (₺) *</label>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Örn: 1000"
                          value={ilaveTutarInput}
                          onChange={(e) => setIlaveTutarInput(e.target.value)}
                          className="w-full h-10 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">İlave Açıklaması *</label>
                        <Input
                          placeholder="Örn: Pamukkale ödül"
                          value={ilaveAciklamaInput}
                          onChange={(e) => setIlaveAciklamaInput(e.target.value)}
                          className="w-full h-10 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">İlave Tarihi</label>
                        <ModernDatePicker
                          label=""
                          value={ilaveTarihInput}
                          onChange={(val) => setIlaveTarihInput(val)}
                          buttonClassName="w-full h-10 text-xs bg-background border-input rounded-md px-3"
                        />
                      </div>
                      <div className="sm:col-span-3 flex justify-end pt-1">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-bold"
                          onClick={() => handleAddIlaveForPersonel(selectedPersonel.personel.id)}
                          disabled={ilaveSubmitting || !ilaveTutarInput}
                        >
                          <Plus className="h-4 w-4" />
                          {ilaveSubmitting ? "Kaydediliyor..." : `${selectedPersonel.personel.ad} İçin İlave Ücret / Ödül Kaydet`}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* İlave Ücretler Listesi Tablosu */}
                  <div className="rounded-lg border overflow-hidden bg-background">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-2">Tarih</th>
                          <th className="px-4 py-2">Açıklama</th>
                          <th className="px-4 py-2 text-right">İlave Tutar</th>
                          {isManager && <th className="px-4 py-2 text-right">İşlem</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedPersonel.ilaveler.length === 0 ? (
                          <tr>
                            <td colSpan={isManager ? 4 : 3} className="px-4 py-4 text-center text-muted-foreground italic">
                              Bu ay için {selectedPersonel.personel.ad} adına eklenmiş ilave ücret / ödül bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          selectedPersonel.ilaveler.map((item: any) => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                              <td className="px-4 py-2.5 text-muted-foreground">{formatDate(item.tarih)}</td>
                              <td className="px-4 py-2.5 font-medium">{item.aciklama}</td>
                              <td className="px-4 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                +{Number(item.tutar || item.amount).toLocaleString("tr-TR")} ₺
                              </td>
                              {isManager && (
                                <td className="px-4 py-2.5 text-right">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50"
                                    onClick={() => handleDeleteIlave(item.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Non-manager personnel personal advance requests status section */}
              {!isManager && myAvansTalepleri.length > 0 && (
                <div className="col-span-full mt-2 border-t pt-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <HandCoins className="h-4 w-4 text-amber-600" />
                    Avans Taleplerim ve Durumları ({myAvansTalepleri.length})
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {myAvansTalepleri.map((req) => {
                      const isPending = req.durum === "beklemede"
                      const isApproved = req.durum === "onaylandi"
                      return (
                        <div
                          key={req.id}
                          className={`rounded-xl border p-3.5 shadow-sm bg-card ${
                            isPending
                              ? "border-amber-300 dark:border-amber-500/40"
                              : isApproved
                              ? "border-emerald-300 dark:border-emerald-500/40"
                              : "border-red-300 dark:border-red-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-extrabold text-base text-foreground">
                              {Number(req.tutar).toLocaleString("tr-TR")} ₺
                            </span>
                            <Badge className={isPending ? "bg-amber-500 text-white" : isApproved ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}>
                              {isPending ? "⏳ Beklemede" : isApproved ? "✅ Onaylandı" : "❌ Reddedildi"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Talep Tarihi: {new Date(req.created_at).toLocaleDateString("tr-TR")}
                          </p>
                          {req.aciklama ? (
                            <p className="mt-1.5 text-xs italic text-muted-foreground bg-muted/40 p-1.5 rounded">
                              "{req.aciklama}"
                            </p>
                          ) : null}
                          {isApproved && req.odeme_tarihi ? (
                            <p className="mt-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              📅 Ödeme Tarihi: {new Date(req.odeme_tarihi).toLocaleDateString("tr-TR")}
                            </p>
                          ) : null}
                          {!isPending && req.red_sebebi ? (
                            <p className="mt-1.5 text-xs font-semibold text-red-700 dark:text-red-300">
                              ⚠️ Red Sebebi: {req.red_sebebi}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Partners Section */}
        {isManager && visibleOrtakSummaries.length > 0 && (
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Building2 className="h-5 w-5 text-emerald-600" />
                  <div>
                    <CardTitle className="text-base font-bold text-foreground">Ortaklar Pay & Maaş Takibi</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground">
                      Tüm şubelerden çekilen ortak avansları ortak taban maaşından otomatik düşülerek net kalan hesaplanır.
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold text-muted-foreground ml-1">
                    {visibleOrtakSummaries.length} Ortak
                  </Badge>
                </div>

                {/* KPI Overview Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px]">
                    <span className="text-muted-foreground">Toplam Maaş: </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(ortakTotals.baseSalary)} TL</span>
                  </div>
                  <div className="px-2.5 py-1 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px]">
                    <span className="text-muted-foreground">Toplam Avans: </span>
                    <span className="font-bold text-rose-700 dark:text-rose-300">-{formatMoney(ortakTotals.total)} TL</span>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md border text-[11px] ${
                    ortakTotals.kalanNakit >= 0
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold"
                      : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 font-bold"
                  }`}>
                    <span>Toplam Kalan: </span>
                    <span>{formatMoney(ortakTotals.kalanNakit)} TL</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMaasAyariType("ortak")
                      if (ortaklar.length > 0) {
                        setMaasAyariTargetId(ortaklar[0].id)
                        setMaasAyariTutarInput(String((ortaklar[0] as any).aylik_maas || ""))
                      }
                      setMaasAyarlariModalOpen(true)
                    }}
                    className="h-8 text-xs font-semibold gap-1.5 border-emerald-500/50 hover:bg-emerald-50 text-emerald-700 dark:text-emerald-300"
                  >
                    <Calculator className="h-3.5 w-3.5 text-emerald-600" />
                    Ortak Maaşı Ayarla
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {/* Partner Cards Grid */}
              <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
                {visibleOrtakSummaries.map(item => {
                  const isSelected = selectedOrtak?.ortak.id === item.ortak.id
                  const hasRemaining = item.kalanNakit >= 0
                  return (
                    <div
                      key={item.ortak.id}
                      onClick={() => setSelectedOrtakId(item.ortak.id)}
                      className={`cursor-pointer rounded-xl border p-4 text-left transition-all duration-200 shadow-sm ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500/40 dark:border-emerald-500 dark:bg-emerald-950/40"
                          : hasRemaining
                          ? "border-slate-200 bg-card hover:border-emerald-300 hover:shadow-md dark:border-slate-800"
                          : "border-rose-200 bg-rose-50/50 hover:border-rose-400 hover:shadow-md dark:border-rose-900/40 dark:bg-rose-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <p className="truncate text-xs font-black uppercase tracking-wide text-foreground">{item.ortak.ad}</p>
                        <Badge className={`text-[10px] px-1.5 py-0 font-bold ${
                          hasRemaining
                            ? "bg-emerald-600 text-white"
                            : "bg-rose-600 text-white"
                        }`}>
                          {hasRemaining ? "Kalan Var" : "Avans Aşıldı"}
                        </Badge>
                      </div>

                      {/* Main Big Remaining Amount */}
                      <div className="mb-3">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Kalan Net Maaş:
                        </span>
                        <p className={`text-2xl font-black ${
                          hasRemaining
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        }`}>
                          {formatMoney(item.kalanNakit)} TL
                        </p>
                      </div>

                      {/* Details breakdown */}
                      <div className="space-y-1.5 text-xs border-t pt-2.5 border-border">
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span className="font-medium">Net Taban Maaş:</span>
                          <span className="font-bold text-foreground">{formatMoney(item.baseSalary)} TL</span>
                        </div>
                        <div className="flex justify-between items-center text-muted-foreground">
                          <span className="font-medium">Çekilen Avans (Tüm Şubeler):</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">-{formatMoney(item.total)} TL</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selectedOrtak && (
                <div className="space-y-4 border-t pt-5">
                  {/* Selected Partner Banner */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border">
                    <div>
                      <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                        {selectedOrtak.ortak.ad} — Şube Bazlı Maaş ve Avans Detayı
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ortak taban maaşından tüm şubelerden çekilen avanslar kronolojik olarak düşülmüş ve aşağıda şube bazında listelenmiştir.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg border shadow-xs">
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Net Maaş</span>
                          <span className="text-sm font-extrabold text-foreground">{formatMoney(selectedOrtak.baseSalary)} TL</span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Toplam Avans</span>
                          <span className="text-sm font-extrabold text-rose-600">-{formatMoney(selectedOrtak.total)} TL</span>
                        </div>
                        <div className="h-6 w-px bg-border" />
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">Kalan Nakit</span>
                          <span className={`text-sm font-black ${selectedOrtak.kalanNakit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatMoney(selectedOrtak.kalanNakit)} TL
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportOrtakPdf(selectedOrtak)}
                        className="gap-1.5 font-bold text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50 h-9"
                      >
                        <FileText className="h-4 w-4" />
                        Ortak PDF Raporu
                      </Button>
                    </div>
                  </div>

                  {/* Şube Bazlı Avans Özeti Rozetleri / Kartları - TÜM ŞUBELER EKSİKSİZ */}
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                      Şube Dağılımı (Tüm Şubeler)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {/* Tüm Şubeler Toplamı */}
                      <div
                        onClick={() => setOrtakSubeFilter("all")}
                        className={`p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                          ortakSubeFilter === "all"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm ring-1 ring-emerald-500"
                            : "bg-card hover:bg-slate-50 dark:hover:bg-slate-900"
                        }`}
                      >
                        <span className="text-muted-foreground block font-semibold">Tüm Şubeler Toplamı</span>
                        <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                          -{formatMoney(selectedOrtak.total)} TL
                        </span>
                      </div>

                      {/* Sistemdeki Her Bir Şube (Çarşı, Darıca, 14, 5A vb.) */}
                      {subeler.map((sube) => {
                        const total = selectedOrtak.branchTotals?.[sube.ad] || 0
                        const isFiltered = ortakSubeFilter === sube.ad
                        return (
                          <div
                            key={sube.id}
                            onClick={() => setOrtakSubeFilter(sube.ad)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all text-xs ${
                              isFiltered
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 shadow-sm ring-1 ring-emerald-500"
                                : "bg-card hover:bg-slate-50 dark:hover:bg-slate-900"
                            }`}
                          >
                            <span className="text-muted-foreground block font-semibold">{sube.ad} Şubesi</span>
                            <span className={`text-sm font-extrabold ${total > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                              {total > 0 ? `-${formatMoney(total)} TL` : "0,00 TL"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Interaktif Filtreleme ve Arama Barı */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <div className="w-full sm:w-64">
                      <Input
                        placeholder="Açıklama veya tarih ara..."
                        value={ortakSearchText}
                        onChange={(e) => setOrtakSearchText(e.target.value)}
                        className="h-9 text-xs bg-background"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                      <Button
                        size="sm"
                        variant={ortakSubeFilter === "all" ? "default" : "outline"}
                        onClick={() => setOrtakSubeFilter("all")}
                        className="h-8 text-xs px-2.5 font-bold"
                      >
                        Tüm Şubeler ({selectedOrtak.advances.length})
                      </Button>
                      {subeler.map((sube) => {
                        const count = selectedOrtak.advances.filter(a => a.subeAd === sube.ad).length
                        return (
                          <Button
                            key={sube.id}
                            size="sm"
                            variant={ortakSubeFilter === sube.ad ? "default" : "outline"}
                            onClick={() => setOrtakSubeFilter(sube.ad)}
                            className="h-8 text-xs px-2.5 font-bold"
                          >
                            {sube.ad} ({count})
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Avans Listesi Tablosu */}
                  {(() => {
                    const filteredAdvances = selectedOrtak.advances.filter(item => {
                      if (ortakSubeFilter !== "all" && item.subeAd !== ortakSubeFilter) return false
                      if (ortakSearchText.trim()) {
                        const search = ortakSearchText.toLowerCase()
                        const desc = item.description.toLowerCase()
                        const tarih = item.tarih.toLowerCase()
                        const sube = item.subeAd.toLowerCase()
                        if (!desc.includes(search) && !tarih.includes(search) && !sube.includes(search)) return false
                      }
                      return true
                    })

                    return (
                      <div className="rounded-xl border overflow-hidden bg-background shadow-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-muted-foreground uppercase font-bold">
                            <tr>
                              <th className="px-4 py-2.5">Tarih</th>
                              <th className="px-4 py-2.5">Şube / Kaynak</th>
                              <th className="px-4 py-2.5">Açıklama</th>
                              <th className="px-4 py-2.5 text-right">Tutar</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {filteredAdvances.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground italic">
                                  Seçilen filtrelere uygun ortak avans kaydı bulunamadı.
                                </td>
                              </tr>
                            ) : (
                              filteredAdvances.map((item, idx) => (
                                <tr key={`${item.tarih}-${idx}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                  <td className="px-4 py-2.5 font-semibold text-muted-foreground">{formatDate(item.tarih)}</td>
                                  <td className="px-4 py-2.5">
                                    <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 dark:bg-slate-900">
                                      {item.subeAd}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2.5 font-medium">{item.description}</td>
                                  <td className="px-4 py-2.5 text-right font-extrabold text-red-600 dark:text-red-400">
                                    -{formatMoney(item.amount)} TL
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        {/* Avans Talepleri Geçmişi ve Yönetimi Tablosu */}
        {isManager && (
          <Card className="mt-8 border-border shadow-sm">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg font-bold">
                    <HandCoins className="h-5 w-5 text-emerald-600" />
                    Avans Talepleri Geçmişi ve Yönetimi
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Tüm personel avans taleplerini tarihe, duruma ve isme göre filtreleyip inceleyebilirsiniz.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-xs font-bold">
                  Toplam {avansTalepleri.length} Kayıt
                </Badge>
              </div>

              {/* Filtreleme Barları */}
              <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Personel Ara</label>
                  <Input
                    placeholder="Örn: Ahmet Yılmaz"
                    value={avansSearchName}
                    onChange={(e) => setAvansSearchName(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground block mb-1">Durum Filtresi</label>
                  <Select value={avansFilterStatus} onValueChange={(val: any) => setAvansFilterStatus(val)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm Durumlar</SelectItem>
                      <SelectItem value="beklemede">⏳ Bekleyenler</SelectItem>
                      <SelectItem value="onaylandi">✅ Onaylananlar</SelectItem>
                      <SelectItem value="reddedildi">❌ Reddedilenler</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <ModernDatePicker
                    label="Başlangıç Tarihi"
                    value={avansStartDate}
                    onChange={setAvansStartDate}
                    buttonClassName="h-9 text-xs"
                  />
                </div>
                <div>
                  <ModernDatePicker
                    label="Bitiş Tarihi"
                    value={avansEndDate}
                    onChange={setAvansEndDate}
                    buttonClassName="h-9 text-xs"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b font-bold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-3">Personel</th>
                      <th className="px-4 py-3">Talep Tarihi</th>
                      <th className="px-4 py-3">Tutar</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">Açıklama / Not</th>
                      <th className="px-4 py-3">Sonuç / Ödeme Tarihi</th>
                      <th className="px-4 py-3 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAvansTalepleri.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          Filtrelere uygun avans talebi bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      filteredAvansTalepleri.map((req) => {
                        const isPending = req.durum === "beklemede"
                        const isApproved = req.durum === "onaylandi"
                        return (
                          <tr key={req.id} className="hover:bg-muted/20 transition">
                            <td className="px-4 py-3 font-bold text-foreground">{req.user_name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{new Date(req.created_at).toLocaleDateString("tr-TR")}</td>
                            <td className="px-4 py-3 font-extrabold text-slate-900 dark:text-white text-sm">{formatMoney(Number(req.tutar))} TL</td>
                            <td className="px-4 py-3">
                              <Badge className={isPending ? "bg-amber-500" : isApproved ? "bg-emerald-600" : "bg-red-600"}>
                                {isPending ? "⏳ Beklemede" : isApproved ? "✅ Onaylandı" : "❌ Reddedildi"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-muted-foreground" title={req.aciklama || ""}>
                              {req.aciklama || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {isApproved && req.odeme_tarihi ? (
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                                  📅 {new Date(req.odeme_tarihi).toLocaleDateString("tr-TR")}
                                </span>
                              ) : !isPending && req.red_sebebi ? (
                                <span className="font-semibold text-red-700 dark:text-red-300">
                                  ⚠️ {req.red_sebebi}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {isPending ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                                    onClick={() => {
                                      setActionModal({ open: true, request: req, type: "approve" })
                                      setModalInput(new Date().toISOString().split("T")[0])
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Onayla
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-7 px-2.5 text-xs gap-1"
                                    onClick={() => {
                                      setActionModal({ open: true, request: req, type: "reject" })
                                      setModalInput("")
                                    }}
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Reddet
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Tamamlandı</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}



        {/* Action Dialog for Avans Approval / Rejection */}
        <Dialog open={actionModal.open} onOpenChange={(open) => setActionModal(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                {actionModal.type === "approve" ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Avans Talebini Onayla
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    Avans Talebini Reddet
                  </>
                )}
              </DialogTitle>
            </DialogHeader>

            {actionModal.request && (
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-semibold text-foreground">{actionModal.request.user_name}</p>
                  <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                    {Number(actionModal.request.tutar).toLocaleString("tr-TR")} ₺
                  </p>
                  {actionModal.request.aciklama && (
                    <p className="mt-1 text-xs text-muted-foreground italic">"{actionModal.request.aciklama}"</p>
                  )}
                </div>

                {actionModal.type === "approve" ? (
                  <div className="space-y-2">
                    <ModernDatePicker
                      label="Ödeme Yapılacak Tarih"
                      value={modalInput}
                      onChange={setModalInput}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Seçilen tarih personele bildirim olarak gönderilecektir.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Red Sebebi *</label>
                    <Textarea
                      placeholder="Örn: Bu ay avans limitiniz dolmuştur."
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                      rows={3}
                      className="w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Bu açıklama personele bildirim olarak iletilecektir.
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setActionModal({ open: false, request: null, type: "approve" })}>
                Vazgeç
              </Button>
              <Button
                className={actionModal.type === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
                onClick={handleAvansAction}
                disabled={actionLoading}
              >
                {actionLoading ? "İşleniyor..." : actionModal.type === "approve" ? "Onayla & Bildirim Gönder" : "Reddet & Bildirim Gönder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Personel Avans İste Modal (Web & Masaüstü) */}
        <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <HandCoins className="h-5 w-5 text-amber-600" />
                Avans Talebi Oluştur
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-muted-foreground">
                Talep etmek istediğiniz avans tutarını ve opsiyonel açıklamanızı girin. Talebiniz anında yöneticilere bildirilecektir.
              </p>
              <div>
                <label className="text-xs font-bold text-foreground mb-1 block">Avans Tutarı (₺) *</label>
                <div className="relative">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Örn: 1000"
                    value={requestTutar}
                    onChange={(e) => setRequestTutar(e.target.value)}
                    className="h-10 text-base font-bold pr-8"
                  />
                  <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">₺</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Açıklama / Not (Opsiyonel)</label>
                <Textarea
                  placeholder="Örn: Acil yol masrafı için avans talep ediyorum."
                  value={requestAciklama}
                  onChange={(e) => setRequestAciklama(e.target.value)}
                  rows={3}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setRequestModalOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleSendAvansRequest}
                disabled={submittingRequest}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2"
              >
                <HandCoins className="h-4 w-4" />
                {submittingRequest ? "Gönderiliyor..." : "Avans Talebi Gönder"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Maaş Onaylama Modal Dialog (Yönetici için) */}
        <Dialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                Maaş Onayı — {visiblePersonelSummaries.find(p => p.personel.id === approveTargetPersonelId)?.personel.ad}
              </DialogTitle>
            </DialogHeader>

            {(() => {
              const targetItem = visiblePersonelSummaries.find(p => p.personel.id === approveTargetPersonelId)
              if (!targetItem) return null
              const bankaAmt = Number(approveBankaInput) || 0
              const kalanNakitCalculated = Math.max(0, targetItem.remainingBeforeBank - bankaAmt)

              return (
                <div className="space-y-4 py-2">
                  <div className="rounded-xl border bg-slate-50 dark:bg-slate-900 p-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Örnek Maaş (Taban):</span>
                      <span className="font-bold text-foreground">{formatMoney(targetItem.baseSalary)} ₺</span>
                    </div>
                    {targetItem.overtimeTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kargo Prim / Mesai Hakediş:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(targetItem.overtimeTotal)} ₺</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold border-t pt-1.5 text-slate-900 dark:text-white">
                      <span>Toplam Hakediş:</span>
                      <span>{formatMoney(targetItem.totalHakedis)} ₺</span>
                    </div>
                    {targetItem.advanceTotal > 0 && (
                      <div className="flex justify-between text-rose-600 dark:text-rose-400">
                        <span>Alınan Avans:</span>
                        <span className="font-bold">-{formatMoney(targetItem.advanceTotal)} ₺</span>
                      </div>
                    )}
                    <div className="flex justify-between font-extrabold text-sm border-t pt-1.5 text-foreground">
                      <span>Avans Sonrası Kalan:</span>
                      <span>{formatMoney(targetItem.remainingBeforeBank)} ₺</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground mb-1 block">Bankaya Gönderilen Tutar (₺) *</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        placeholder="Örn: 15000"
                        value={approveBankaInput}
                        onChange={(e) => setApproveBankaInput(e.target.value)}
                        className="h-10 text-base font-bold pr-8"
                      />
                      <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground">₺</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">Yöneticinin bankadan personele göndereceği net tutar.</p>
                  </div>

                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-3.5 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 block">Hesaplanan Kalan Nakit:</span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-300">Teyit Edin: {formatMoney(targetItem.remainingBeforeBank)} - {formatMoney(bankaAmt)} =</span>
                    </div>
                    <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-200">
                      {formatMoney(kalanNakitCalculated)} ₺
                    </span>
                  </div>

                  <div className="space-y-1">
                    <ModernDatePicker
                      label="Kalan Nakit Ödeme Tarihi Seçin *"
                      value={approveNakitTarihi}
                      onChange={setApproveNakitTarihi}
                    />
                    {approveNakitTarihi && (
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                        📌 Kaydedilecek Bilgi: {formatDate(approveNakitTarihi)} Nakit: {formatMoney(kalanNakitCalculated)} ₺
                      </p>
                    )}
                  </div>
                </div>
              )
            })()}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setApproveModalOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleSaveMaasApproval}
                disabled={savingApproval}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {savingApproval ? "Kaydediliyor..." : "Onayla ve Kaydet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ZAM MODALI (Yalnızca Yöneticiler) */}
        <Dialog open={zamModalOpen} onOpenChange={setZamModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
                Maaş Zammı Yönetimi
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div>
                <label className="text-xs font-semibold block mb-1">Hedef Tipi *</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={zamTargetType === "personel" ? "default" : "outline"}
                    className={zamTargetType === "personel" ? "bg-emerald-600 text-white font-bold h-9 text-xs" : "h-9 text-xs"}
                    onClick={() => {
                      setZamTargetType("personel")
                      setZamTargetId("")
                      setZamYuvarlamaInput("")
                    }}
                  >
                    Personeller
                  </Button>
                  <Button
                    type="button"
                    variant={zamTargetType === "ortak" ? "default" : "outline"}
                    className={zamTargetType === "ortak" ? "bg-emerald-600 text-white font-bold h-9 text-xs" : "h-9 text-xs"}
                    onClick={() => {
                      setZamTargetType("ortak")
                      setZamTargetId("")
                      setZamYuvarlamaInput("")
                    }}
                  >
                    Ortaklar
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  {zamTargetType === "personel" ? "Personel Seçin *" : "Ortak Seçin *"}
                </label>
                <Select
                  value={zamTargetId}
                  onValueChange={(val) => {
                    setZamTargetId(val)
                    const target = zamTargetType === "personel" ? personeller.find(p => p.id === val) : ortaklar.find(o => o.id === val)
                    const currentSalary = target ? Number((target as any).aylik_maas || 0) : 0
                    const percent = Number(zamOraniInput || 0)
                    if (currentSalary > 0 && percent > 0) {
                      const calc = currentSalary * (1 + percent / 100)
                      setZamYuvarlamaInput(String(Math.round(calc)))
                    }
                  }}
                >
                  <SelectTrigger className="w-full h-10 text-xs bg-background">
                    <SelectValue placeholder="-- Seçiniz --" />
                  </SelectTrigger>
                  <SelectContent>
                    {zamTargetType === "personel" ? (
                      personeller.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          {p.ad} ({formatMoney(Number(p.aylik_maas || 0))} TL)
                        </SelectItem>
                      ))
                    ) : (
                      ortaklar.map(o => (
                        <SelectItem key={o.id} value={o.id} className="text-xs">
                          {o.ad}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {zamTargetId && (() => {
                const target = zamTargetType === "personel" ? personeller.find(p => p.id === zamTargetId) : ortaklar.find(o => o.id === zamTargetId)
                const currentSalary = target ? Number((target as any).aylik_maas || 0) : 0
                const percent = Number(zamOraniInput || 0)
                const calculatedNew = currentSalary > 0 && percent > 0 ? currentSalary * (1 + percent / 100) : currentSalary

                return (
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900 p-2.5 rounded-lg">
                      <span className="font-semibold text-muted-foreground">Mevcut Maaş:</span>
                      <span className="font-bold text-foreground text-sm">{formatMoney(currentSalary)} TL</span>
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1">Zam Oranı (%) *</label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Örn: 30"
                        value={zamOraniInput}
                        onChange={(e) => {
                          const val = e.target.value
                          setZamOraniInput(val)
                          const p = Number(val || 0)
                          if (currentSalary > 0 && p > 0) {
                            const calc = currentSalary * (1 + p / 100)
                            setZamYuvarlamaInput(String(Math.round(calc)))
                          }
                        }}
                        className="h-10 text-xs bg-background"
                      />
                    </div>

                    {percent > 0 && (
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-1.5">
                        <div className="flex justify-between text-emerald-800 dark:text-emerald-300">
                          <span>Hesaplanan Ham Zamlı Maaş:</span>
                          <span className="font-bold">{formatMoney(calculatedNew)} TL</span>
                        </div>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Küsüratsız net tutar için aşağıdaki yuvarlama kutucuğunu istediğiniz rakama göre düzenleyebilirsiniz.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-xs font-semibold block mb-1 text-emerald-700 dark:text-emerald-300">
                        Yuvarlamak / Belirlemek İstediğiniz Yeni Net Maaş (₺) *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Örn: 20000 veya 36500"
                        value={zamYuvarlamaInput}
                        onChange={(e) => setZamYuvarlamaInput(e.target.value)}
                        className="h-10 text-sm font-extrabold text-emerald-700 dark:text-emerald-300 bg-background"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1">Zam Geçerlilik Tarihi *</label>
                      <ModernDatePicker
                        label=""
                        value={zamTarihInput}
                        onChange={setZamTarihInput}
                        buttonClassName="w-full h-10 text-xs bg-background border-input rounded-md px-3"
                      />
                    </div>
                  </div>
                )
              })()}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setZamModalOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleSaveMaasZam}
                disabled={zamSubmitting || !zamTargetId || !zamYuvarlamaInput}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                {zamSubmitting ? "Kaydediliyor..." : "Zammı Onayla ve Güncelle"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* BORÇ TAKSİTLENDİRME MODALI */}
        <Dialog open={taksitModalOpen} onOpenChange={setTaksitModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg font-bold text-purple-700 dark:text-purple-400">
                <CreditCard className="h-5 w-5" />
                Personel Borç Taksitlendirme
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {(() => {
                const targetP = personeller.find(p => p.id === taksitPersonelId)
                const totalAmount = Number(taksitToplamBorcInput || 0)
                const count = Number(taksitSayisiInput || 1)
                const monthlyInst = totalAmount > 0 && count > 0 ? Math.round((totalAmount / count) * 100) / 100 : 0

                const startDate = taksitBaslangicTarihiInput ? new Date(taksitBaslangicTarihiInput) : new Date()
                const endDateObj = new Date(startDate.getFullYear(), startDate.getMonth() + (count > 0 ? count - 1 : 0), startDate.getDate())
                const endDateStr = `${endDateObj.getFullYear()}-${String(endDateObj.getMonth() + 1).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`

                return (
                  <>
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <span className="font-bold text-purple-900 dark:text-purple-200 text-sm block mb-1">
                        {targetP?.ad || "Personel"}
                      </span>
                      <p className="text-muted-foreground text-[11px]">
                        Verilen kişisel borcu belirlediğiniz taksit sayısına bölerek her ayın maaşından otomatik kesinti olarak düşer.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1 text-foreground">Toplam Borç Tutarı (₺) *</label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Örn: 100000"
                        value={taksitToplamBorcInput}
                        onChange={(e) => setTaksitToplamBorcInput(e.target.value)}
                        className="h-10 text-sm font-bold bg-background"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1 text-foreground">Borç Açıklaması *</label>
                      <Input
                        placeholder="Örn: Telefon Borcu, Ekipman Hasarı"
                        value={taksitAciklamaInput}
                        onChange={(e) => setTaksitAciklamaInput(e.target.value)}
                        className="h-10 text-xs bg-background"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">Taksit Sayısı (Ay) *</label>
                        <Input
                          type="number"
                          min="1"
                          max="36"
                          placeholder="Örn: 5"
                          value={taksitSayisiInput}
                          onChange={(e) => setTaksitSayisiInput(e.target.value)}
                          className="h-10 text-xs bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1 text-foreground">Hesaplanan Aylık Taksit</label>
                        <div className="h-10 px-3 bg-slate-100 dark:bg-slate-900 border rounded-md flex items-center font-extrabold text-purple-700 dark:text-purple-300">
                          {formatMoney(monthlyInst)} TL / Ay
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold block mb-1 text-foreground">İlk Ödeme Tarihi (Taksit Başlangıcı) *</label>
                      <ModernDatePicker
                        label=""
                        value={taksitBaslangicTarihiInput}
                        onChange={setTaksitBaslangicTarihiInput}
                        buttonClassName="w-full h-10 text-xs bg-background border-input rounded-md px-3"
                      />
                    </div>

                    {totalAmount > 0 && count > 0 && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1 text-xs font-medium">
                        <div className="flex justify-between text-muted-foreground">
                          <span>İlk Taksit Tarihi:</span>
                          <span className="font-bold text-foreground">{formatDate(taksitBaslangicTarihiInput)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Son Taksit Tarihi:</span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">{formatDate(endDateStr)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground border-t pt-1">
                          <span>Aylık Kesintiler:</span>
                          <span className="font-extrabold text-foreground">{count} Ay boyunca her ay {formatMoney(monthlyInst)} TL</span>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setTaksitModalOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleSaveBorcTaksit}
                disabled={taksitSubmitting || !taksitToplamBorcInput || !taksitSayisiInput}
                className="bg-purple-700 hover:bg-purple-800 text-white font-bold gap-2"
              >
                <CreditCard className="h-4 w-4" />
                {taksitSubmitting ? "Kaydediliyor..." : "Taksitlendirmeyi Başlat"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* UYGULAMA İÇİ SİLME ONAY MODALI (Tarayıcı confirm yerine) */}
        <Dialog open={deleteModalState.open} onOpenChange={(open) => setDeleteModalState(prev => ({ ...prev, open }))}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-600 dark:text-red-400">
                <Scissors className="h-5 w-5" />
                {deleteModalState.title}
              </DialogTitle>
            </DialogHeader>

            <div className="py-2 text-xs text-muted-foreground font-medium space-y-2">
              <p>{deleteModalState.description}</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setDeleteModalState(prev => ({ ...prev, open: false }))}>
                Vazgeç / İptal
              </Button>
              <Button
                variant="destructive"
                className="font-bold gap-1.5"
                onClick={executeDeleteKesinti}
              >
                <Trash2 className="h-4 w-4" />
                Evet, Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* MAAŞ AYARLARI / BELİRLEME MODALI */}
        <Dialog open={maasAyarlariModalOpen} onOpenChange={setMaasAyarlariModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
                <Calculator className="h-5 w-5" />
                Maaş Belirleme & Güncelleme
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                <Button
                  type="button"
                  variant={maasAyariType === "personel" ? "default" : "ghost"}
                  onClick={() => {
                    setMaasAyariType("personel")
                    if (personeller.length > 0) {
                      setMaasAyariTargetId(personeller[0].id)
                      setMaasAyariTutarInput(String(personeller[0].aylik_maas || ""))
                    }
                  }}
                  className="h-8 text-xs font-bold"
                >
                  Personel Maaşı
                </Button>
                <Button
                  type="button"
                  variant={maasAyariType === "ortak" ? "default" : "ghost"}
                  onClick={() => {
                    setMaasAyariType("ortak")
                    if (ortaklar.length > 0) {
                      setMaasAyariTargetId(ortaklar[0].id)
                      setMaasAyariTutarInput(String((ortaklar[0] as any).aylik_maas || ""))
                    }
                  }}
                  className="h-8 text-xs font-bold"
                >
                  Ortak Maaşı
                </Button>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  {maasAyariType === "personel" ? "Personel Seçin" : "Ortak Seçin"} *
                </label>
                <Select
                  value={maasAyariTargetId}
                  onValueChange={(val) => {
                    setMaasAyariTargetId(val)
                    if (maasAyariType === "personel") {
                      const p = personeller.find(item => item.id === val)
                      setMaasAyariTutarInput(String(p?.aylik_maas || ""))
                    } else {
                      const o = ortaklar.find(item => item.id === val)
                      setMaasAyariTutarInput(String((o as any)?.aylik_maas || ""))
                    }
                  }}
                >
                  <SelectTrigger className="h-10 text-xs bg-background">
                    <SelectValue placeholder="Kişi seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {maasAyariType === "personel"
                      ? personeller.map(p => (
                          <SelectItem key={p.id} value={p.id} className="text-xs">
                            {p.ad} (Mevcut: {formatMoney(Number(p.aylik_maas || 0))} TL)
                          </SelectItem>
                        ))
                      : ortaklar.map(o => (
                          <SelectItem key={o.id} value={o.id} className="text-xs">
                            {o.ad} (Mevcut: {formatMoney(Number((o as any).aylik_maas || 0))} TL)
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Net Taban Maaş Tutarı (TL) *</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Örn: 35000"
                  value={maasAyariTutarInput}
                  onChange={(e) => setMaasAyariTutarInput(e.target.value)}
                  className="h-10 text-xs font-bold"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setMaasAyarlariModalOpen(false)}>
                Vazgeç
              </Button>
              <Button
                onClick={handleSaveMaasAyari}
                disabled={maasAyariSaving || !maasAyariTargetId || !maasAyariTutarInput}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {maasAyariSaving ? "Güncelleniyor..." : "Maaşı Güncelle & Kaydet"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function DetailList({
  title,
  items,
  empty,
  totalLabel,
  variant,
  initialExpanded = false,
}: {
  title: string
  items: Detail[]
  empty: string
  totalLabel: string
  variant: "expense" | "income" | "info"
  initialExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const total = items.reduce((sum, item) => sum + item.amount, 0)
  const amountClass = variant === "expense" ? "text-red-700 dark:text-red-100" : variant === "info" ? "text-amber-600 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-100"
  const prefix = variant === "expense" ? "-" : "+"

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3 font-semibold text-sm">
        <span>{title}</span>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="h-7 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {expanded ? "Detay Gizle" : `Detay Göster (${items.length} Kayıt)`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </Button>
        )}
      </div>
      {expanded && (
        <div className="divide-y max-h-[300px] overflow-y-auto">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{empty}</p>
          ) : (
            items.map((item, index) => {
              const isKargoHakedis = item.description.includes("Kargo Hakediş")
              return (
                <div key={`${item.tarih}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <div>
                    {!isKargoHakedis && <p className="font-medium">{formatDate(item.tarih)}</p>}
                    <p className={`text-xs ${isKargoHakedis ? "font-semibold text-foreground text-sm" : "text-muted-foreground"}`}>{item.description}</p>
                  </div>
                  <p className={`font-semibold ${amountClass}`}>{prefix}{formatMoney(item.amount)} TL</p>
                </div>
              )
            })
          )}
        </div>
      )}
      <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-3 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span className={amountClass}>{prefix}{formatMoney(total)} TL</span>
      </div>
    </div>
  )
}
