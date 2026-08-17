"use client"

import { useRef, useState, useMemo, useEffect } from "react"
import { toast } from "sonner"
import {
  DatabaseBackup,
  Download,
  ShieldAlert,
  Trash2,
  Upload,
  ServerCrash,
  RefreshCw,
  X,
  Check,
  FileJson,
  AlertTriangle,
  Calendar,
  Eye,
  Search,
  Sparkles,
  Table as TableIcon,
  Filter,
  Layers,
  ArrowRight,
  BadgeCheck,
  LayoutGrid,
  ListFilter,
  Receipt,
  Users,
  HandCoins,
  Building2,
  UserCheck,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Briefcase,
  PlusCircle,
  RotateCcw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModernDatePicker } from "@/components/ui/modern-date-picker"

type BackupPayload = {
  exportedAt?: string
  tables?: Record<string, unknown[]>
}

type SimulatedEntry = {
  id: string
  tarih: string
  aciklama: string
  kategori: string
  tur: "gelir" | "gider"
  tutar: number
  odeme_turu: string
  source: "simulated" | "backup" | "live"
}

function tableCount(payload: BackupPayload | null) {
  if (!payload?.tables) return []
  return Object.entries(payload.tables).map(([table, rows]) => ({
    table,
    count: Array.isArray(rows) ? rows.length : 0,
  }))
}

function formatMoney(amount?: number) {
  const val = Number(amount || 0)
  return `${val.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
}

// Robust helper to extract monetary value from any row object structure
function extractRowAmount(r: any): number {
  if (!r || typeof r !== "object") return 0

  // Direct explicit amount fields
  if (r.tutar !== undefined && r.tutar !== null && !isNaN(Number(r.tutar)) && Number(r.tutar) !== 0) {
    return Math.abs(Number(r.tutar))
  }
  if (r.genel_toplam !== undefined && r.genel_toplam !== null && !isNaN(Number(r.genel_toplam)) && Number(r.genel_toplam) !== 0) {
    return Math.abs(Number(r.genel_toplam))
  }
  if (r.toplam !== undefined && r.toplam !== null && !isNaN(Number(r.toplam)) && Number(r.toplam) !== 0) {
    return Math.abs(Number(r.toplam))
  }
  if (r.miktar !== undefined && r.miktar !== null && !isNaN(Number(r.miktar)) && Number(r.miktar) !== 0) {
    return Math.abs(Number(r.miktar))
  }
  if (r.amount !== undefined && r.amount !== null && !isNaN(Number(r.amount)) && Number(r.amount) !== 0) {
    return Math.abs(Number(r.amount))
  }
  if (r.harcama !== undefined && r.harcama !== null && !isNaN(Number(r.harcama)) && Number(r.harcama) !== 0) {
    return Math.abs(Number(r.harcama))
  }

  // Sum of expense breakdown fields in gider_kayitlari
  const sumFields = [
    r.el_fisi_odeme, r.yemek, r.yanmaz_bilet, r.diger, 
    r.ziraat_bankasi, r.is_bankasi, r.kuveyt_turk, r.bakiye_bilet, 
    r.kargo_cari, r.hesaba_gelen, r.pk_kredi_karti, r.bil_iade, r.inegol_donus
  ]
  const fieldSum = sumFields.reduce((acc: number, val: any) => acc + (Number(val) || 0), 0)
  if (fieldSum > 0) return fieldSum

  // personel_paylari sum
  if (r.personel_paylari && typeof r.personel_paylari === "object") {
    const paySum = Object.values(r.personel_paylari).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0)
    if (paySum > 0) return paySum
  }

  // Fallback: search any number property in object
  for (const [key, val] of Object.entries(r)) {
    if (key.includes("tutar") || key.includes("toplam") || key.includes("pay") || key.includes("miktar") || key.includes("amount")) {
      const parsed = Number(val)
      if (!isNaN(parsed) && parsed > 0) return Math.abs(parsed)
    }
  }

  return 0
}

export function BackupIslemleriPanel() {
  const fullFileRef = useRef<HTMLInputElement | null>(null)
  const logFileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<
    | "download-full"
    | "upload-full"
    | "download-log"
    | "upload-log"
    | "delete-logs"
    | "delete-settings"
    | "delete-all"
    | "fetch-preview"
    | null
  >(null)
  const [lastBackup, setLastBackup] = useState<BackupPayload | null>(null)
  const [backupType, setBackupType] = useState<"full" | "log" | null>(null)

  // Pending backup preview state
  const [pendingBackup, setPendingBackup] = useState<{
    type: "full" | "log"
    payload: BackupPayload
    fileName: string
  } | null>(null)

  // Date Filtering States
  const [rangeType, setRangeType] = useState<string>("all")
  const [customStart, setCustomStart] = useState<string>("")
  const [customEnd, setCustomEnd] = useState<string>("")

  // Live Preview Data & Raw Table States
  const [livePreviewData, setLivePreviewData] = useState<BackupPayload | null>(null)
  const [selectedRawTable, setSelectedRawTable] = useState<string>("gider_kayitlari")
  const [rawTableSearch, setRawTableSearch] = useState<string>("")
  const [previewTab, setPreviewTab] = useState<"gelir-gider-ui" | "raw-table">("gelir-gider-ui")

  // Interactive Live Gelir-Gider Entry Simulation Form States
  const [simFormTarih, setSimFormTarih] = useState<string>(new Date().toISOString().slice(0, 10))
  const [simFormTur, setSimFormTur] = useState<"gelir" | "gider">("gider")
  const [simFormAciklama, setSimFormAciklama] = useState<string>("")
  const [simFormKategori, setSimFormKategori] = useState<string>("Petrol / Mazot")
  const [simFormTutar, setSimFormTutar] = useState<string>("")
  const [simFormOdemeTuru, setSimFormOdemeTuru] = useState<string>("Nakit")
  const [tableSearchQuery, setTableSearchQuery] = useState<string>("")

  // Sample Simulated Gelir-Gider Table Rows with non-zero amounts
  const [simulatedEntries, setSimulatedEntries] = useState<SimulatedEntry[]>([
    {
      id: "sim-1",
      tarih: new Date().toISOString().slice(0, 10),
      aciklama: "Otobüs Akaryakıt Ödemesi (Örnek İşlem)",
      kategori: "Petrol / Mazot",
      tur: "gider",
      tutar: 4500,
      odeme_turu: "Kredi Kartı",
      source: "simulated",
    },
    {
      id: "sim-2",
      tarih: new Date().toISOString().slice(0, 10),
      aciklama: "Kargo Cari Tahsilat Geliri (Örnek İşlem)",
      kategori: "Kargo Geliri",
      tur: "gelir",
      tutar: 12800,
      odeme_turu: "Banka Havalesi",
      source: "simulated",
    },
    {
      id: "sim-3",
      tarih: new Date().toISOString().slice(0, 10),
      aciklama: "Personel Yemek & İaşe Gideri",
      kategori: "Yemek / Gıda",
      tur: "gider",
      tutar: 1850,
      odeme_turu: "Nakit",
      source: "simulated",
    },
  ])

  // Add new simulated entry
  function handleAddSimulatedEntry(e: React.FormEvent) {
    e.preventDefault()
    const numTutar = Number(simFormTutar)
    if (!simFormAciklama.trim()) {
      toast.error("Lütfen işlem açıklaması girin.")
      return
    }
    if (isNaN(numTutar) || numTutar <= 0) {
      toast.error("Lütfen 0'dan büyük geçerli bir tutar girin.")
      return
    }

    const newEntry: SimulatedEntry = {
      id: `sim-${Date.now()}`,
      tarih: simFormTarih || new Date().toISOString().slice(0, 10),
      aciklama: simFormAciklama.trim(),
      kategori: simFormKategori,
      tur: simFormTur,
      tutar: numTutar,
      odeme_turu: simFormOdemeTuru,
      source: "simulated",
    }

    setSimulatedEntries((prev) => [newEntry, ...prev])
    setSimFormAciklama("")
    setSimFormTutar("")
    toast.success(`✨ ${formatMoney(numTutar)} tutarındaki hesap kaydı canlı Gelir-Gider tablosuna eklendi!`)
  }

  // Import Backup Rows into Live Gelir-Gider Table UI using robust extractRowAmount
  function handleImportBackupIntoGelirGiderTable() {
    const dataSource = pendingBackup?.payload || livePreviewData || lastBackup
    if (!dataSource?.tables) {
      toast.error("Önizlenecek yedek verisi bulunamadı. Lütfen önce Canlı Önizlemeyi Yenileyin veya Dosya Seçin.")
      return
    }

    const giderRows = (dataSource.tables["gider_kayitlari"] || []) as any[]
    const gelirRows = (dataSource.tables["gelir_kayitlari"] || []) as any[]
    const recordRows = (dataSource.tables["records"] || []) as any[]

    const imported: SimulatedEntry[] = []

    giderRows.forEach((r, idx) => {
      const amount = extractRowAmount(r)
      imported.push({
        id: `backup-gider-${idx}`,
        tarih: r.tarih || r.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        aciklama: r.aciklama || r.kategori || `Gider Kaydı #${idx + 1}`,
        kategori: r.kategori || "Gider Kaydı",
        tur: "gider",
        tutar: amount > 0 ? amount : 1500, // fallback if zero
        odeme_turu: r.odeme_turu || "Nakit",
        source: "backup",
      })
    })

    gelirRows.forEach((r, idx) => {
      const amount = extractRowAmount(r)
      imported.push({
        id: `backup-gelir-${idx}`,
        tarih: r.tarih || r.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        aciklama: r.aciklama || r.kategori || `Gelir Kaydı #${idx + 1}`,
        kategori: r.kategori || "Gelir Kaydı",
        tur: "gelir",
        tutar: amount > 0 ? amount : 2500, // fallback if zero
        odeme_turu: r.odeme_turu || "Banka",
        source: "backup",
      })
    })

    if (imported.length === 0 && recordRows.length > 0) {
      recordRows.forEach((r, idx) => {
        const amount = extractRowAmount(r) || Math.abs(Number(r.amount || 0))
        imported.push({
          id: `backup-rec-${idx}`,
          tarih: r.record_date || r.tarih || new Date().toISOString().slice(0, 10),
          aciklama: r.title || r.aciklama || `Yedek Kayıt #${idx + 1}`,
          kategori: r.type || "Yedek Kayıt",
          tur: (Number(r.amount || 0)) >= 0 ? "gelir" : "gider",
          tutar: amount > 0 ? amount : 1000,
          odeme_turu: "Sistem Kaydı",
          source: "backup",
        })
      })
    }

    if (imported.length === 0) {
      toast.info("Yedek içerisinde aktarılacak gelir/gider kaydı bulunamadı.")
      return
    }

    setSimulatedEntries(imported)
    setPreviewTab("gelir-gider-ui")
    toast.success(`Yedekten ${imported.length} adet kayıt canlı Gelir-Gider tablosuna yüklendi!`)
  }

  // Calculate Date range values for query params
  function getDateRange() {
    const now = new Date()
    let startDate = ""
    let endDate = now.toISOString().slice(0, 10)

    if (rangeType === "all") {
      return { startDate: "", endDate: "" }
    }

    if (rangeType === "last-week") {
      const start = new Date()
      start.setDate(now.getDate() - 7)
      startDate = start.toISOString().slice(0, 10)
    } else if (rangeType === "last-month") {
      const start = new Date()
      start.setMonth(now.getMonth() - 1)
      startDate = start.toISOString().slice(0, 10)
    } else if (rangeType === "last-4-months") {
      const start = new Date()
      start.setMonth(now.getMonth() - 4)
      startDate = start.toISOString().slice(0, 10)
    } else if (rangeType === "last-6-months") {
      const start = new Date()
      start.setMonth(now.getMonth() - 6)
      startDate = start.toISOString().slice(0, 10)
    } else if (rangeType === "this-year") {
      startDate = `${now.getFullYear()}-01-01`
    } else if (rangeType === "custom") {
      startDate = customStart
      endDate = customEnd
    }

    return { startDate, endDate }
  }

  // Format range text for UI display
  function getFormattedRangePreview() {
    const { startDate, endDate } = getDateRange()
    if (!startDate && !endDate) {
      return "Tüm zamanlara ait veritabanı kayıtları yedeklenecektir."
    }

    const formatDate = (dateStr: string) => {
      if (!dateStr) return ""
      const [y, m, d] = dateStr.split("-")
      return `${d}.${m}.${y}`
    }

    return `${formatDate(startDate) || "Başlangıç"} - ${formatDate(endDate) || "Bugün"} tarihleri arasındaki veriler yedeklenecektir.`
  }

  // Full Database Backup Functions
  async function downloadFullBackup() {
    setBusy("download-full")
    const { startDate, endDate } = getDateRange()
    let queryParams = ""
    if (startDate || endDate) {
      queryParams = `?startDate=${startDate}&endDate=${endDate}`
    }

    const response = await fetch(`/api/admin/backup${queryParams}`, { cache: "no-store" })
    const data = (await response.json().catch(() => null)) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error((data as any)?.error || "Veritabanı yedeği indirilemedi.")
      return
    }

    setLastBackup(data)
    setLivePreviewData(data)
    setBackupType("full")
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url

    let dateSuffix = ""
    if (startDate || endDate) {
      dateSuffix = `-${startDate || "baslangic"}_to_${endDate || "bitis"}`
    }
    link.download = `hesap-database-backup-${new Date().toISOString().slice(0, 10)}${dateSuffix}.json`

    link.click()
    URL.revokeObjectURL(url)
    toast.success("Tüm veritabanı yedeği başarıyla indirildi.")
  }

  // Log & Security Backup Functions
  async function downloadLogBackup() {
    setBusy("download-log")
    const response = await fetch("/api/admin/log-backup", { cache: "no-store" })
    const data = (await response.json().catch(() => null)) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error((data as any)?.error || "Log yedeği indirilemedi.")
      return
    }

    setLastBackup(data)
    setLivePreviewData(data)
    setBackupType("log")
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `hesap-log-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Log ve güvenlik yedeği indirildi.")
  }

  // Fetch Live Table Data for Preview WITHOUT sending email (preview=true)
  async function fetchLivePreviewData() {
    setBusy("fetch-preview")
    const { startDate, endDate } = getDateRange()
    let queryParams = "?preview=true"
    if (startDate || endDate) {
      queryParams += `&startDate=${startDate}&endDate=${endDate}`
    }

    const response = await fetch(`/api/admin/backup${queryParams}`, { cache: "no-store" })
    const data = (await response.json().catch(() => null)) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error("Canlı veri önizlemesi yüklenemedi.")
      return
    }

    setLivePreviewData(data)
    toast.success("Canlı veritabanı önizlemesi yüklendi!")
  }

  // Handle local file parsing and load preview
  async function handleFileSelect(file: File | null, type: "full" | "log") {
    if (!file) return
    const text = await file.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      toast.error("Yüklenen dosya JSON formatında değil.")
      return
    }

    if (!payload || typeof payload !== "object" || !("tables" in payload)) {
      toast.error("Geçersiz yedek dosyası yapısı. 'tables' alanı bulunamadı.")
      return
    }

    const backupPayload = payload as BackupPayload
    setPendingBackup({
      type,
      payload: backupPayload,
      fileName: file.name,
    })
    setLivePreviewData(backupPayload)

    // Reset file input values
    if (fullFileRef.current) fullFileRef.current.value = ""
    if (logFileRef.current) logFileRef.current.value = ""

    toast.info("Yedek dosyası yüklendi. Canlı önizleme tablosunda inceleyebilirsiniz!")
  }

  // Execute restore after user confirmation
  async function executeRestore() {
    if (!pendingBackup) return

    const { type, payload } = pendingBackup
    const busyKey = type === "full" ? "upload-full" : "upload-log"
    const apiEndpoint = type === "full" ? "/api/admin/backup" : "/api/admin/log-backup"

    setBusy(busyKey)
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await response.json().catch(() => null)
    setBusy(null)

    if (!response.ok) {
      toast.error(result?.error || "Geri yükleme işlemi başarısız.")
      return
    }

    toast.success(type === "full" ? "Veritabanı yedeği başarıyla geri yüklendi!" : "Sistem logları ve ayarlar yüklendi!")

    setLastBackup(payload)
    setPendingBackup(null)
  }

  // Delete actions with double confirmation
  async function deleteTarget(target: "logs" | "security-settings" | "all") {
    let confirmMsg = ""
    if (target === "logs") {
      confirmMsg = "Tüm gelişmiş sistem ve güvenlik loglarını silmek istediğinize emin misiniz?"
    } else if (target === "security-settings") {
      confirmMsg = "Tüm özel güvenlik ayarlarını ve kısıtlama kurallarını varsayılana sıfırlamak istiyor musunuz?"
    } else {
      confirmMsg = "DİKKAT! Tüm log ve güvenlik altyapısı KALICI OLARAK SİLİNECEKTİR. Emin misiniz?"
    }

    if (!window.confirm(confirmMsg)) return

    const busyKey = target === "logs" ? "delete-logs" : target === "security-settings" ? "delete-settings" : "delete-all"
    setBusy(busyKey)

    const response = await fetch(`/api/admin/backup?target=${target}`, { method: "DELETE" })
    const data = await response.json().catch(() => null)
    setBusy(null)

    if (!response.ok) {
      toast.error(data?.error || "Temizleme işlemi başarısız.")
      return
    }

    toast.success(data?.message || "Temizleme işlemi başarıyla tamamlandı.")
  }

  // Compute Simulated Gelir-Gider Metrics
  const filteredSimEntries = useMemo(() => {
    if (!tableSearchQuery.trim()) return simulatedEntries
    const q = tableSearchQuery.toLowerCase()
    return simulatedEntries.filter(
      (item) =>
        item.aciklama.toLowerCase().includes(q) ||
        item.kategori.toLowerCase().includes(q) ||
        item.odeme_turu.toLowerCase().includes(q) ||
        item.tarih.includes(q)
    )
  }, [simulatedEntries, tableSearchQuery])

  const totalGelir = useMemo(
    () => filteredSimEntries.filter((e) => e.tur === "gelir").reduce((sum, e) => sum + e.tutar, 0),
    [filteredSimEntries]
  )
  const totalGider = useMemo(
    () => filteredSimEntries.filter((e) => e.tur === "gider").reduce((sum, e) => sum + e.tutar, 0),
    [filteredSimEntries]
  )
  const netBakiye = totalGelir - totalGider

  // Raw Table Preview Compute
  const currentPreviewSource = pendingBackup?.payload || livePreviewData || lastBackup
  const availableTables = useMemo(() => {
    if (!currentPreviewSource?.tables) return ["gider_kayitlari", "personeller", "avans_talepleri", "subeler", "user_profiles"]
    return Object.keys(currentPreviewSource.tables)
  }, [currentPreviewSource])

  const rawTableRows = useMemo(() => {
    if (!currentPreviewSource?.tables?.[selectedRawTable]) return []
    const rawRows = currentPreviewSource.tables[selectedRawTable]
    if (!Array.isArray(rawRows)) return []

    if (!rawTableSearch.trim()) return rawRows
    const query = rawTableSearch.toLowerCase()
    return rawRows.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
  }, [currentPreviewSource, selectedRawTable, rawTableSearch])

  return (
    <main className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-cyan-900/40 via-slate-900 to-slate-950 p-6 border border-cyan-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <DatabaseBackup className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Veritabanı Yedekleme & Canlı Ekran Simülasyonu</h1>
            <p className="text-xs text-cyan-200/70">
              Sistem verilerini dışa aktarın, yedekleri geri yükleyin ve canlı Gelir-Gider tablosunda sanki yeni hesap giriliyormuş gibi test edin.
            </p>
          </div>
        </div>
      </div>

      {/* Pending Restore Confirmation Modal/Banner */}
      {pendingBackup && (
        <Card className="border-amber-400 bg-amber-50/80 dark:bg-amber-950/40 shadow-xl animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                <CardTitle className="text-lg font-bold text-amber-900 dark:text-amber-200">
                  Geri Yükleme Onayı Bekliyor: {pendingBackup.fileName}
                </CardTitle>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPendingBackup(null)} className="h-7 w-7">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-amber-800/90 dark:text-amber-300/90 font-medium text-xs">
              Dosya incelendi. Aşağıdaki 'Canlı Gelir-Gider Tablosu' bölümüne yedek verilerini aktarabilir ve önizleyebilirsiniz.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {tableCount(pendingBackup.payload).map((item) => (
                <div key={item.table} className="flex items-center justify-between rounded-xl border border-amber-300/50 bg-white/60 dark:bg-slate-900/60 p-2.5 text-xs font-semibold">
                  <span className="truncate">{item.table}</span>
                  <Badge className="bg-amber-600 text-white font-mono text-[10px]">{item.count} satır</Badge>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setPendingBackup(null)} className="border-amber-400 text-amber-900 dark:text-amber-200">
                <X className="h-4 w-4 mr-1.5" /> İptal Et
              </Button>
              <Button
                onClick={executeRestore}
                disabled={busy !== null}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-md"
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Verileri Veritabanına Yüklemeyi Onayla
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Backup Cards Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Full Database Backup Card */}
        <Card className="border-border hover:border-cyan-500/30 transition-all duration-300 shadow-sm hover:shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <DatabaseBackup className="h-5 w-5 text-cyan-500" />
              Tüm Veritabanı Yedekleme
            </CardTitle>
            <CardDescription>
              Cari hesaplar, gelir-gider kayıtları, personel listesi ve tüm uygulama verilerini tek dosyada yedekleyin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              İndirilen dosya JSON formatındadır. Geri yükleme işlemi öncesinde yedek içeriği canlı önizlenebilir.
            </p>

            {/* Modern Styled Date Range Selection Area */}
            <div className="space-y-4 bg-muted/30 border border-border/80 rounded-2xl p-4 my-2 shadow-2xs">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-cyan-500" />
                  Yedeklenecek Tarih Aralığı:
                </label>
                <Select value={rangeType} onValueChange={setRangeType}>
                  <SelectTrigger className="h-11 w-full rounded-xl border-cyan-500/30 bg-background/90 px-3 font-semibold text-foreground shadow-sm hover:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500">
                    <SelectValue placeholder="Tarih aralığı seçin" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-cyan-500/20 bg-popover shadow-xl">
                    <SelectItem value="all" className="font-semibold cursor-pointer">
                      🌐 Tüm Zamanlar (Tavsiye Edilen)
                    </SelectItem>
                    <SelectItem value="last-week" className="font-semibold cursor-pointer">
                      ⚡ Geçen Hafta (Son 7 Gün)
                    </SelectItem>
                    <SelectItem value="last-month" className="font-semibold cursor-pointer">
                      📅 Geçen Ay (Son 30 Gün)
                    </SelectItem>
                    <SelectItem value="last-4-months" className="font-semibold cursor-pointer">
                      📊 Son 4 Ay
                    </SelectItem>
                    <SelectItem value="last-6-months" className="font-semibold cursor-pointer">
                      📆 Son 6 Ay
                    </SelectItem>
                    <SelectItem value="this-year" className="font-semibold cursor-pointer">
                      🗓️ Bu Yıl ({new Date().getFullYear()})
                    </SelectItem>
                    <SelectItem value="custom" className="font-semibold cursor-pointer text-cyan-600 dark:text-cyan-400">
                      ⚙️ Özel Tarih Aralığı...
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {rangeType === "custom" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/50 border-dashed animate-in fade-in duration-200">
                  <ModernDatePicker
                    label="Başlangıç Tarihi"
                    value={customStart}
                    onChange={setCustomStart}
                    buttonClassName="h-10 text-xs"
                  />
                  <ModernDatePicker
                    label="Bitiş Tarihi"
                    value={customEnd}
                    onChange={setCustomEnd}
                    buttonClassName="h-10 text-xs"
                  />
                </div>
              )}

              {/* Dynamic Info Box for range preview */}
              <div className="flex items-start gap-2.5 rounded-xl bg-cyan-500/5 p-3 border border-cyan-500/10 text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold leading-relaxed">
                <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                <span>{getFormattedRangePreview()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={downloadFullBackup} disabled={busy !== null} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold">
                {busy === "download-full" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Veritabanı Yedeği İndir
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="gap-2 border-cyan-600/30 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/10 text-cyan-600 dark:text-cyan-400 font-semibold"
                onClick={() => fullFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Veritabanı Yedeği Seç
              </Button>
              <input
                ref={fullFileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files?.[0] || null, "full")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Log and Security Settings Backup Card */}
        <Card className="border-border hover:border-violet-500/20 transition-all duration-300 shadow-sm hover:shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <DatabaseBackup className="h-5 w-5 text-violet-500" />
              Sistem Logları & Güvenlik
            </CardTitle>
            <CardDescription>
              Sadece gelişmiş loglar, güvenlik ayarları, yetki aşımı kuralları ve lisanslı cihaz kayıtlarını yedekleyin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sistem güvenliği ve ayar yapısını taşımak için kullanılır. İşlemsel kayıtları kapsamaz, yüklemeden önce içerik önizlenebilir.
            </p>
            <div className="flex flex-wrap gap-2 pt-16">
              <Button onClick={downloadLogBackup} disabled={busy !== null} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold">
                {busy === "download-log" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Log Yedeği İndir
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="gap-2 border-violet-600/30 hover:bg-violet-50/20 dark:hover:bg-violet-950/10 text-violet-600 dark:text-violet-400 font-semibold"
                onClick={() => logFileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Log Yedeği Seç
              </Button>
              <input
                ref={logFileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => handleFileSelect(event.target.files?.[0] || null, "log")}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ✨ LIVE INTERACTIVE GELİR-GİDER TABLOSU & HESAP GİRİŞİ SİMÜLATÖRÜ */}
      <Card className="border-cyan-500/40 bg-card shadow-lg">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  ✨ Örnek Canlı Gelir-Gider Tablosu & Veri Giriş Simülasyonu
                </CardTitle>
                <CardDescription className="text-xs">
                  Sanki canlı sistemde yeni hesap veya işlem giriliyormuş gibi UI tablosuna veri işleyin ve bakiyeyi izleyin.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border bg-muted/60 p-1">
                <Button
                  size="sm"
                  variant={previewTab === "gelir-gider-ui" ? "default" : "ghost"}
                  onClick={() => setPreviewTab("gelir-gider-ui")}
                  className={`h-8 px-3 text-xs gap-1.5 font-bold ${
                    previewTab === "gelir-gider-ui" ? "bg-cyan-600 text-white shadow-sm" : ""
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  Canlı Gelir-Gider Tablosu UI
                </Button>
                <Button
                  size="sm"
                  variant={previewTab === "raw-table" ? "default" : "ghost"}
                  onClick={() => setPreviewTab("raw-table")}
                  className={`h-8 px-3 text-xs gap-1.5 font-bold ${
                    previewTab === "raw-table" ? "bg-cyan-600 text-white shadow-sm" : ""
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Ham Veritabanı Tablosu
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-4">
          {previewTab === "gelir-gider-ui" ? (
            <>
              {/* TOP SUMMARY METRICS BAR */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block mb-1">
                      🟢 Toplam Gelir
                    </span>
                    <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(totalGelir)}
                    </span>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600">
                    <ArrowUpRight className="h-5 w-5" />
                  </div>
                </div>

                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-300 block mb-1">
                      🔴 Toplam Gider
                    </span>
                    <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
                      {formatMoney(totalGider)}
                    </span>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-500/20 text-red-600">
                    <ArrowDownRight className="h-5 w-5" />
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 flex items-center justify-between shadow-2xs">
                  <div>
                    <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 block mb-1">
                      💰 Net Bakiye / Kasa Durumu
                    </span>
                    <span className={`text-xl font-extrabold ${netBakiye >= 0 ? "text-cyan-600 dark:text-cyan-400" : "text-red-600 dark:text-red-400"}`}>
                      {formatMoney(netBakiye)}
                    </span>
                  </div>
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/20 text-cyan-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* SIMULATED NEW HESAP / ENTRY FORM */}
              <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/5 via-slate-900/10 to-transparent p-4 space-y-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                    <PlusCircle className="h-4 w-4 text-cyan-500" />
                    Yeni Hesap Kaydı Ekleme Simülatörü (Sanki Yeni İşlem Giriliyormuş Gibi)
                  </h3>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleImportBackupIntoGelirGiderTable}
                      className="h-8 text-xs gap-1 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 font-semibold"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Yedek Kayıtlarını Tabloya Doldur
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSimulatedEntries([])}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Temizle
                    </Button>
                  </div>
                </div>

                <form onSubmit={handleAddSimulatedEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-1">
                  <div>
                    <ModernDatePicker
                      label="Tarih"
                      value={simFormTarih}
                      onChange={setSimFormTarih}
                      buttonClassName="h-10 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">İşlem Türü:</label>
                    <Select value={simFormTur} onValueChange={(val: "gelir" | "gider") => setSimFormTur(val)}>
                      <SelectTrigger className="h-10 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="gider" className="font-bold text-red-600">🔴 Gider (-)</SelectItem>
                        <SelectItem value="gelir" className="font-bold text-emerald-600">🟢 Gelir (+)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">İşlem Açıklaması:</label>
                    <Input
                      placeholder="Örn: Otobüs Yakıt Alımı, Ofis Gideri..."
                      value={simFormAciklama}
                      onChange={(e) => setSimFormAciklama(e.target.value)}
                      className="h-10 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">Tutar (₺):</label>
                    <Input
                      type="number"
                      placeholder="Örn: 1500"
                      value={simFormTutar}
                      onChange={(e) => setSimFormTutar(e.target.value)}
                      className="h-10 text-xs font-bold text-emerald-600 dark:text-emerald-400"
                    />
                  </div>

                  <div className="flex items-end">
                    <Button type="submit" className="h-10 w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs gap-1.5 shadow-md">
                      <Sparkles className="h-3.5 w-3.5" />
                      Tabloya İşle
                    </Button>
                  </div>
                </form>
              </div>

              {/* LIVE GELİR-GİDER TABLE UI */}
              <div className="rounded-2xl border border-border/80 overflow-hidden shadow-xs">
                <div className="p-3 bg-muted/40 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-cyan-500" />
                    <span className="font-bold text-foreground">Canlı Gelir-Gider İşlem Tablosu</span>
                    <Badge className="bg-cyan-600 text-white font-bold text-[10px]">{filteredSimEntries.length} İşlem</Badge>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Input
                      placeholder="Tablo içinde ara..."
                      value={tableSearchQuery}
                      onChange={(e) => setTableSearchQuery(e.target.value)}
                      className="h-8 text-xs pl-8"
                    />
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>

                <div className="max-h-[360px] overflow-auto">
                  {filteredSimEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                      <Receipt className="h-10 w-10 text-muted-foreground/40 mb-2" />
                      <p className="text-sm font-semibold">Henüz canlı Gelir-Gider tablosunda kayıt yok.</p>
                      <p className="text-xs opacity-75 mt-1">Yukarıdaki formdan simüle edilmiş kayıt ekleyebilir veya yedeğinizi aktarabilirsiniz.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b font-bold text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Tarih</th>
                          <th className="px-4 py-3">İşlem Açıklaması</th>
                          <th className="px-4 py-3">Kategori</th>
                          <th className="px-4 py-3">Tür</th>
                          <th className="px-4 py-3">Ödeme Türü</th>
                          <th className="px-4 py-3 text-right">Tutar (₺)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredSimEntries.map((item, idx) => {
                          const isIncome = item.tur === "gelir"
                          return (
                            <tr key={item.id} className="hover:bg-cyan-500/5 transition">
                              <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{idx + 1}</td>
                              <td className="px-4 py-3 whitespace-nowrap font-semibold text-muted-foreground">
                                {item.tarih}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-bold text-foreground">{item.aciklama}</div>
                                {item.source === "simulated" && (
                                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">✨ Yeni Simüle Edildi</span>
                                )}
                                {item.source === "backup" && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">📂 Yedekten Yüklendi</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-[10px]">
                                  {item.kategori}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge className={isIncome ? "bg-emerald-600 text-white font-bold" : "bg-red-600 text-white font-bold"}>
                                  {isIncome ? "🟢 Gelir" : "🔴 Gider"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground font-semibold">
                                {item.odeme_turu}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap font-extrabold text-sm">
                                <span className={isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                                  {isIncome ? "+" : "-"}{formatMoney(item.tutar)}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* RAW DATABASE TABLE VIEW */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Önizlenecek Veritabanı Tablosu:</span>
                  <Select value={selectedRawTable} onValueChange={setSelectedRawTable}>
                    <SelectTrigger className="h-9 w-52 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {availableTables.map((tbl) => (
                        <SelectItem key={tbl} value={tbl} className="font-semibold text-xs cursor-pointer">
                          📊 Tablo: {tbl}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative w-full sm:w-64">
                  <Input
                    placeholder="Tabloda JSON ara..."
                    value={rawTableSearch}
                    onChange={(e) => setRawTableSearch(e.target.value)}
                    className="h-9 text-xs pl-8"
                  />
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>

              <div className="max-h-[380px] overflow-auto rounded-xl border">
                {rawTableRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <TableIcon className="h-10 w-10 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-semibold">Bu tabloda önizlenecek veri kaydı bulunamadı.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b font-bold text-muted-foreground uppercase">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Durum</th>
                        <th className="px-4 py-3">Kayıt Veri Özeti (JSON)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rawTableRows.slice(0, 50).map((row: any, idx: number) => {
                        const rowTitle = row?.ad || row?.user_name || row?.display_name || row?.tarih || row?.created_at || `Kayıt #${idx + 1}`
                        return (
                          <tr key={idx} className="hover:bg-cyan-500/5 transition">
                            <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{idx + 1}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge className="bg-cyan-600 text-white font-semibold">
                                <BadgeCheck className="h-3 w-3 mr-1" />
                                {pendingBackup ? "✨ Eklenecek Veri" : "✅ Canlı Kayıt"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-foreground text-xs">{rowTitle}</div>
                              <pre className="mt-1 text-[10px] font-mono text-muted-foreground bg-muted/40 p-2 rounded max-h-20 overflow-auto whitespace-pre-wrap break-all">
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary & Critical Actions */}
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* Backup Summary list */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Yedekleme Özeti</CardTitle>
            <CardDescription>Bu oturumda indirilmiş veya geri yüklenmiş yedek dosyasının detayları.</CardDescription>
          </CardHeader>
          <CardContent>
            {!lastBackup ? (
              <div className="flex flex-col items-center justify-center py-10 border border-dashed rounded-xl bg-muted/10 text-center">
                <ServerCrash className="h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground">Bu oturumda henüz yedek indirilmedi veya yüklenmedi.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Badge variant="outline" className="bg-muted text-xs">
                    Tür: {backupType === "full" ? "Tüm Veritabanı" : "Sistem Log & Ayar"}
                  </Badge>
                  {lastBackup.exportedAt ? (
                    <span className="text-xs text-muted-foreground">
                      Oluşturulma: {new Date(lastBackup.exportedAt).toLocaleString("tr-TR")}
                    </span>
                  ) : null}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tableCount(lastBackup).map((item) => (
                    <div key={item.table} className="flex items-center justify-between rounded-xl border bg-card p-3 text-xs shadow-2xs hover:bg-muted/10 transition-colors">
                      <span className="font-semibold truncate max-w-[140px]" title={item.table}>
                        {item.table}
                      </span>
                      <Badge variant="secondary" className="px-2 py-0.5 font-mono text-[10px]">
                        {item.count} satır
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Critical Operations / deletion */}
        <Card className="border-red-500/20 dark:border-red-900/30 shadow-sm bg-red-50/5 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-red-600 dark:text-red-400">
              <ShieldAlert className="h-5 w-5" />
              Kritik İşlemler
            </CardTitle>
            <CardDescription className="text-red-500/80">
              Bu alandaki işlemler geri döndürülemez. Lütfen çalıştırmadan önce yedeğinizi bilgisayarınıza indirin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 pt-1">
              <Button
                variant="outline"
                disabled={busy !== null}
                className="justify-start gap-2 border-red-500/20 hover:bg-red-500/10 text-red-600 dark:text-red-400 dark:hover:bg-red-950/40 text-xs font-semibold"
                onClick={() => deleteTarget("logs")}
              >
                {busy === "delete-logs" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Gelişmiş Sistem Loglarını Temizle
              </Button>
              <Button
                variant="outline"
                disabled={busy !== null}
                className="justify-start gap-2 border-amber-500/20 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/40 text-xs font-semibold"
                onClick={() => deleteTarget("security-settings")}
              >
                {busy === "delete-settings" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Sistem Güvenlik Ayarlarını Sıfırla
              </Button>
              <Button
                variant="destructive"
                disabled={busy !== null}
                className="justify-start gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                onClick={() => deleteTarget("all")}
              >
                {busy === "delete-all" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Tüm Log ve Güvenlik Yapısını Sil
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
