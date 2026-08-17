"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, HandCoins, Wallet, XCircle } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { openPdfReport } from "@/lib/pdf-report"

interface Personel {
  id: string
  ad: string
  aylik_maas?: number
  banka_maas?: number
  nakit_maas?: number
  saatlik_mesai_ucreti?: number
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

type Detail = { tarih: string; amount: number; description: string }
type OvertimeDetail = Detail & { hours: number; rate: number; minutes: number; source: "attendance" | "manual" }

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
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr-TR")
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
  const [actionModal, setActionModal] = useState<{ open: boolean; request: AvansTalebi | null; type: "approve" | "reject" }>({ open: false, request: null, type: "approve" })
  const [modalInput, setModalInput] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  const supabase = createClient()
  const { currentSube, isAdmin, loading: subeLoading } = useSube()
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

    const [personelRes, ortakRes, giderRes, attendanceRes, approvalsRes, kargoPrimRes, corbaRes, avansRes] = await Promise.all([
      supabase
        .from("personeller")
        .select("id, ad, aylik_maas, banka_maas, nakit_maas, saatlik_mesai_ucreti, aktif")
        .eq("sube_id", currentSube.id)
        .order("sira", { ascending: true }),
      supabase
        .from("ortaklar")
        .select("id, ad")
        .eq("sube_id", currentSube.id)
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
    ])

    const attendancePayload = await attendanceRes.json().catch(() => null) as AttendancePayload | null
    const approvalsPayload = await approvalsRes.json().catch(() => null)
    const avansPayload = await avansRes.json().catch(() => null)
    if (avansPayload?.requests) {
      setAvansTalepleri(avansPayload.requests)
    }
    
    const allPersoneller = personelRes.data || []
    const usedPersonelIds = new Set<string>()

    ;(giderRes.data || []).forEach(row => {
      if (row.personel_paylari) {
        Object.entries(row.personel_paylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
      }
      if (row.personel_mesai_detaylari) {
        Object.entries(row.personel_mesai_detaylari).forEach(([k, v]) => { if (Number(v) > 0) usedPersonelIds.add(k) })
      }
    })

    ;(corbaRes.data || []).forEach(c => {
      if (Number(c.miktar) > 0) usedPersonelIds.add(c.personel_id)
    })

    const monthIndex = MONTHS.indexOf(month) + 1
    const monthStartDate = `${year}-${String(monthIndex).padStart(2, "0")}-01`

    setPersoneller(allPersoneller.filter(p => {
      // If employee resigned before this month started, exclude them unless they have recorded entries in this month
      if (p.isten_cikis_tarihi && p.isten_cikis_tarihi < monthStartDate && !usedPersonelIds.has(p.id)) {
        return false
      }
      return p.aktif || usedPersonelIds.has(p.id) || Boolean(p.isten_cikis_tarihi && p.isten_cikis_tarihi >= monthStartDate)
    }))
    setOrtaklar(ortakRes.data || [])
    setRows(giderRes.data || [])
    setAttendanceOvertime(attendanceRes.ok ? (attendancePayload?.details || []) : [])
    setOvertimeApprovals(approvalsRes.ok ? (approvalsPayload?.items || []) : [])
    setKargoPrimAmount(kargoPrimRes.data ? Number(kargoPrimRes.data.personel_hakedis || 0) : 0)
    setKargoSeciliPersoneller(kargoPrimRes.data?.secili_personeller ? (kargoPrimRes.data.secili_personeller as string[]) : null)
    setCorbaData(corbaRes.data || [])
    setLoading(false)
  }

  const personelSummaries = useMemo(() => personeller.map(personel => {
    const bankaMaas = Number(personel.banka_maas || 0)
    const nakitMaas = Number(personel.nakit_maas !== undefined && personel.nakit_maas !== null ? personel.nakit_maas : (personel.aylik_maas || 0))
    const baseSalary = bankaMaas + nakitMaas
    const isSelectedForKargo = !kargoSeciliPersoneller || kargoSeciliPersoneller.includes(personel.id)
    const kargoHakedisAmount = isSelectedForKargo ? kargoPrimAmount : 0
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

    rows.forEach(row => {
      const advanceAmount = Number(row.personel_paylari?.[personel.id]) || 0
      if (advanceAmount > 0) {
        advances.push({ tarih: row.tarih, amount: advanceAmount, description: "Alınan avans" })
      }

      const manualAmount = Number(row.personel_mesai_detaylari?.[personel.id]) || 0
      if (manualAmount > 0) {
        overtime.push({
          tarih: row.tarih,
          amount: manualAmount,
          description: `Gider tablosu manuel mesai tutarı: ${formatMoney(manualAmount)} TL`,
          hours: 0,
          rate: 0,
          minutes: 0,
          source: "manual",
        })
      }
    })

    attendanceOvertime
      .filter(detail => detail.personelId === personel.id && (detail.payableOvertimeMinutes ?? detail.overtimeMinutes) > 0 && approvalByLogId.has(Number(detail.id)))
      .forEach(detail => {
        const approval = approvalByLogId.get(Number(detail.id))
        const payableMinutes = Number(approval?.payable_minutes) || detail.payableOvertimeMinutes || detail.overtimeMinutes
        const hours = payableMinutes / 60
        overtime.push({
          tarih: detail.workDate,
          amount: hours * hourlyRate,
          description: `Mesai takip: gerçek ${formatDurationFromMinutes(detail.overtimeMinutes)}, maaşa ${formatDurationFromMinutes(payableMinutes)} x ${formatMoney(hourlyRate)} TL`,
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

    overtime.sort((a, b) => a.tarih.localeCompare(b.tarih) || a.source.localeCompare(b.source))
    const advanceTotal = advances.reduce((sum, item) => sum + item.amount, 0)
    const overtimeTotal = overtime.reduce((sum, item) => sum + item.amount, 0)

    // Nakit Maaştan Avans Düşüşü:
    const nakitAlinacak = Math.max(0, nakitMaas - advanceTotal)
    const remaining = bankaMaas + nakitAlinacak + overtimeTotal

    return {
      personel,
      baseSalary,
      bankaMaas,
      nakitMaas,
      nakitAlinacak,
      kargoHakedisAmount,
      corbaTotal,
      corbaDetails,
      hourlyRate,
      advances,
      overtime,
      advanceTotal,
      overtimeTotal,
      remaining,
    }
  }), [attendanceOvertime, corbaData, kargoPrimAmount, kargoSeciliPersoneller, month, overtimeApprovals, personeller, rows, year])

  const ortakSummaries = useMemo(() => ortaklar.map(ortak => {
    const advances: Detail[] = []
    rows.forEach(row => {
      const amount = Number(row.ortak_pilarim?.[ortak.id]) || 0
      if (amount > 0) advances.push({ tarih: row.tarih, amount, description: "Ortak avansi" })
    })
    const total = advances.reduce((sum, item) => sum + item.amount, 0)
    return { ortak, advances, total }
  }), [ortaklar, rows])

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
  const ortakTotal = useMemo(() => visibleOrtakSummaries.reduce((sum, item) => sum + item.total, 0), [visibleOrtakSummaries])

  function exportGeneralPdf() {
    openPdfReport({
      title: "Maaşlar Genel Raporu",
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "landscape",
      metrics: [
        { label: "Toplam Maaş", value: `${formatMoney(salaryTotals.baseSalary)} TL` },
        { label: "Toplam Avans", value: `-${formatMoney(salaryTotals.advances)} TL` },
        { label: "Toplam Mesai / Hakediş", value: `+${formatMoney(salaryTotals.overtime)} TL` },
        { label: "Ortak Avans", value: `-${formatMoney(ortakTotal)} TL` },
      ],
      tables: [
        {
          title: "Personel Maaşları",
          headers: ["Personel", "Banka", "Nakit Alınacak", "Avans", "Ekstra/Prim", "Net Toplam"],
          firstColumnWidth: "25%",
          rows: personelSummaries.map(item => [
            item.personel.ad,
            `${formatMoney(item.bankaMaas)} TL`,
            `${formatMoney(item.nakitAlinacak)} TL`,
            `-${formatMoney(item.advanceTotal)} TL`,
            `+${formatMoney(item.overtimeTotal)} TL`,
            `${formatMoney(item.remaining)} TL`,
          ]),
        },
        {
          title: "Ortaklar Pay",
          headers: ["Ortak", "Alınan Avans"],
          firstColumnWidth: "55%",
          rows: ortakSummaries.map(item => [item.ortak.ad, `-${formatMoney(item.total)} TL`]),
        },
      ],
    })
  }

  function exportPersonelPdf(item = selectedPersonel) {
    if (!item) return
    openPdfReport({
      title: `${item.personel.ad} Maaş Detayı`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "portrait",
      metrics: [
        { label: "Banka Gönderilen", value: `${formatMoney(item.bankaMaas)} TL` },
        { label: "Nakit Maaş (Taban)", value: `${formatMoney(item.nakitMaas)} TL` },
        { label: "Alınan Avans", value: `-${formatMoney(item.advanceTotal)} TL` },
        ...(item.corbaTotal > 0 ? [{ label: "Çorba Kazanılan", value: `+${formatMoney(item.corbaTotal)} TL` }] : []),
        { label: "Nakit Alınacak", value: `${formatMoney(item.nakitAlinacak)} TL` },
        { label: "Ekstra / Kargo Prim / Mesai", value: `+${formatMoney(item.overtimeTotal)} TL` },
        { label: "Net Toplam Kalan", value: `${formatMoney(item.remaining)} TL` },
      ],
      tables: [
        {
          title: "Alınan Avanslar",
          headers: ["Tarih", "Açıklama", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
        },
        {
          title: "Ekstra / Mesai / Prim Hakedişleri",
          headers: ["Tarih", "Kaynak", "Mesai", "Saatlik Ücret", "Tutar"],
          firstColumnWidth: "28%",
          rows: item.overtime.map(detail => {
            const isKargo = detail.description.includes("Kargo Hakediş")
            const isDirectAmount = detail.source === "manual" && detail.minutes === 0 && detail.rate === 0
            return [
              isKargo ? month : formatDate(detail.tarih),
              isKargo ? "Kargo Prim" : detail.source === "attendance" ? "Mesai takip" : isDirectAmount ? "Hakediş / Manuel" : "Manuel",
              isDirectAmount ? "Doğrudan tutar" : formatDurationFromMinutes(detail.minutes),
              isDirectAmount ? "-" : `${formatMoney(detail.rate)} TL`,
              `+${formatMoney(detail.amount)} TL`,
            ]
          }),
        },
      ],
    })
  }

  function exportOrtakPdf(item = selectedOrtak) {
    if (!item) return
    openPdfReport({
      title: `${item.ortak.ad} Ortak Pay Detayı`,
      subtitle: `${currentSube?.ad || ""} - ${month} ${year}`,
      orientation: "portrait",
      metrics: [{ label: "Toplam Alınan Avans", value: `-${formatMoney(item.total)} TL` }],
      tables: [{
        title: "Ortak Avansları",
        headers: ["Tarih", "Açıklama", "Tutar"],
        firstColumnWidth: "28%",
        rows: item.advances.map(detail => [formatDate(detail.tarih), detail.description, `-${formatMoney(detail.amount)} TL`]),
      }],
    })
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

  const pendingAvansList = useMemo(() => avansTalepleri.filter(item => item.durum === "beklemede"), [avansTalepleri])

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
              {years.map(item => (
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
        {/* Avans Talepleri Management Card */}
        {isManager && avansTalepleri.length > 0 && (
          <Card className="mb-6 border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-200">
                  <HandCoins className="h-5 w-5 text-amber-600" />
                  Personel Avans Talepleri ({avansTalepleri.length})
                </CardTitle>
                <Badge variant="outline" className="border-amber-400 bg-amber-100 text-amber-900 font-semibold dark:bg-amber-900/40 dark:text-amber-200">
                  {pendingAvansList.length} Bekleyen
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {avansTalepleri.map(req => {
                  const isPending = req.durum === "beklemede"
                  const isApproved = req.durum === "onaylandi"
                  return (
                    <div
                      key={req.id}
                      className={`rounded-xl border p-4 shadow-sm transition ${
                        isPending
                          ? "border-amber-300 bg-white dark:border-amber-500/40 dark:bg-slate-900"
                          : isApproved
                          ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-950/20"
                          : "border-red-200 bg-red-50/50 dark:border-red-500/30 dark:bg-red-950/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{req.user_name}</span>
                        <Badge
                          className={
                            isPending
                              ? "bg-amber-500 text-white"
                              : isApproved
                              ? "bg-emerald-600 text-white"
                              : "bg-red-600 text-white"
                          }
                        >
                          {isPending ? "Beklemede" : isApproved ? "Onaylandı" : "Reddedildi"}
                        </Badge>
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
                      {isApproved && req.odeme_tarihi ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          📅 Ödeme Tarihi: {new Date(req.odeme_tarihi).toLocaleDateString("tr-TR")}
                        </p>
                      ) : null}
                      {!isPending && req.red_sebebi ? (
                        <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
                          ⚠️ Red Sebebi: {req.red_sebebi}
                        </p>
                      ) : null}
                      {isPending && (
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
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
        {/* Personel Kendi Avans Talepleri Takibi */}
        {!isManager && avansTalepleri.length > 0 && (
          <Card className="mb-6 border-amber-300/60 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-500/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-900 dark:text-amber-200">
                <HandCoins className="h-5 w-5 text-amber-600" />
                Avans Taleplerim ({avansTalepleri.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {avansTalepleri.map(req => {
                  const isPending = req.durum === "beklemede"
                  const isApproved = req.durum === "onaylandi"
                  return (
                    <div
                      key={req.id}
                      className={`rounded-xl border p-4 shadow-sm bg-white dark:bg-slate-900 ${
                        isPending
                          ? "border-amber-300 dark:border-amber-500/40"
                          : isApproved
                          ? "border-emerald-300 dark:border-emerald-500/40"
                          : "border-red-300 dark:border-red-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-extrabold text-lg text-foreground">
                          {Number(req.tutar).toLocaleString("tr-TR")} ₺
                        </span>
                        <Badge className={isPending ? "bg-amber-500" : isApproved ? "bg-emerald-600" : "bg-red-600"}>
                          {isPending ? "⏳ Beklemede" : isApproved ? "✅ Onaylandı" : "❌ Reddedildi"}
                        </Badge>
                      </div>
                      {req.aciklama ? (
                        <p className="mt-2 text-xs italic text-muted-foreground bg-muted/50 p-2 rounded">
                          "{req.aciklama}"
                        </p>
                      ) : null}
                      {isApproved && req.odeme_tarihi ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          📅 Ödeme Tarihi: {new Date(req.odeme_tarihi).toLocaleDateString("tr-TR")}
                        </p>
                      ) : null}
                      {!isPending && req.red_sebebi ? (
                        <p className="mt-2 text-xs font-semibold text-red-700 dark:text-red-300">
                          ⚠️ Red Sebebi: {req.red_sebebi}
                        </p>
                      ) : null}
                    </div>
                  )
                })}
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
                <div className="flex items-center justify-between gap-1">
                  <p className={`truncate text-xs font-semibold uppercase ${item.remaining < 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{item.personel.ad}</p>
                </div>
                <p className={`mt-1 text-xl font-bold ${item.remaining < 0 ? "text-red-700 dark:text-red-100" : "text-emerald-700 dark:text-emerald-100"}`}>{formatMoney(item.remaining)} TL</p>
                <div className="mt-2 space-y-1 text-xs border-t pt-2 border-emerald-200/60 dark:border-emerald-500/20">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Bankaya Gönderilen:</span>
                    <span className="font-semibold text-foreground">{formatMoney(item.bankaMaas)} TL</span>
                  </div>
                  {item.kargoHakedisAmount > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Kargo Hakediş:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">+{formatMoney(item.kargoHakedisAmount)} TL</span>
                    </div>
                  )}
                  {item.corbaTotal > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Çorba Kazanılan:</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400">+{formatMoney(item.corbaTotal)} TL</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Nakit Alınacak:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatMoney(item.nakitAlinacak)} TL</span>
                  </div>
                </div>
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
                  <CardTitle className="flex items-center gap-2">
                    <span>{selectedPersonel.personel.ad} Maaş Detayı</span>
                  </CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Bankaya Gönderilen: <strong className="text-foreground">{formatMoney(selectedPersonel.bankaMaas)} TL</strong></span>
                    <span>Nakit Verilen (Taban): <strong className="text-foreground">{formatMoney(selectedPersonel.nakitMaas)} TL</strong></span>
                    <span>Alınan Avans: <strong className="text-red-600">-{formatMoney(selectedPersonel.advanceTotal)} TL</strong></span>
                    {selectedPersonel.corbaTotal > 0 && (
                      <span>Çorba Kazanılan: <strong className="text-amber-600 dark:text-amber-400 font-bold">+{formatMoney(selectedPersonel.corbaTotal)} TL</strong></span>
                    )}
                    <span>Nakit Alınacak: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatMoney(selectedPersonel.nakitAlinacak)} TL</strong></span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportPersonelPdf(selectedPersonel)} className="gap-2">
                  <FileText className="h-4 w-4" />
                  Personel PDF
                </Button>
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
            </CardContent>
          </Card>
        )}

        {/* Partners Section */}
        {isManager && visibleOrtakSummaries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Ortaklar Pay</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
                {visibleOrtakSummaries.map(item => (
                  <button
                    key={item.ortak.id}
                    onClick={() => setSelectedOrtakId(item.ortak.id)}
                    className="rounded-lg border border-red-200 bg-red-50 p-4 text-left transition hover:border-red-400 dark:border-red-500/30 dark:bg-red-500/15"
                  >
                    <p className="truncate text-xs font-semibold uppercase text-red-700 dark:text-red-100">{item.ortak.ad}</p>
                    <p className="mt-1 text-xl font-bold text-red-700 dark:text-red-100">-{formatMoney(item.total)} TL</p>
                  </button>
                ))}
              </div>
              {selectedOrtak && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => exportOrtakPdf(selectedOrtak)} className="gap-2">
                      <FileText className="h-4 w-4" />
                      Ortak PDF
                    </Button>
                  </div>
                  <DetailList
                    title={`${selectedOrtak.ortak.ad} Ortak Avansları`}
                    items={selectedOrtak.advances}
                    empty="Ortak avansı yok."
                    totalLabel="Toplam Ortak Avansı"
                    variant="expense"
                  />
                </div>
              )}
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
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Ödeme Yapılacak Tarih *
                    </label>
                    <Input
                      type="date"
                      value={modalInput}
                      onChange={(e) => setModalInput(e.target.value)}
                      className="w-full"
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
}: {
  title: string
  items: Detail[]
  empty: string
  totalLabel: string
  variant: "expense" | "income" | "info"
}) {
  const [expanded, setExpanded] = useState(variant === "income")
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
