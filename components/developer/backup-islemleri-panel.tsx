"use client"

import { useRef, useState, useMemo } from "react"
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
  Store,
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

function tableCount(payload: BackupPayload | null) {
  if (!payload?.tables) return []
  return Object.entries(payload.tables).map(([table, rows]) => ({
    table,
    count: Array.isArray(rows) ? rows.length : 0,
  }))
}

function formatMoney(amount?: number) {
  if (!amount || isNaN(amount)) return "0 ₺"
  return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`
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

  // Live Table Preview States
  const [selectedPreviewTable, setSelectedPreviewTable] = useState<string>("gider_kayitlari")
  const [previewSearch, setPreviewSearch] = useState<string>("")
  const [previewViewMode, setPreviewViewMode] = useState<"ui" | "raw">("ui")
  const [livePreviewData, setLivePreviewData] = useState<BackupPayload | null>(null)

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
    toast.success("Canlı UI arayüz önizlemesi güncellendi!")
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

    toast.info("Yedek dosyası Canlı UI Arayüz Önizlemesine yüklendi!")
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

  // Compute active preview rows based on selected table & search
  const currentPreviewSource = pendingBackup?.payload || livePreviewData || lastBackup
  const availableTables = useMemo(() => {
    if (!currentPreviewSource?.tables) return ["gider_kayitlari", "personeller", "avans_talepleri", "subeler", "user_profiles"]
    return Object.keys(currentPreviewSource.tables)
  }, [currentPreviewSource])

  const tableRows = useMemo(() => {
    if (!currentPreviewSource?.tables?.[selectedPreviewTable]) return []
    const rawRows = currentPreviewSource.tables[selectedPreviewTable]
    if (!Array.isArray(rawRows)) return []

    if (!previewSearch.trim()) return rawRows

    const query = previewSearch.toLowerCase()
    return rawRows.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
  }, [currentPreviewSource, selectedPreviewTable, previewSearch])

  return (
    <main className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col gap-2 rounded-2xl bg-gradient-to-r from-cyan-900/40 via-slate-900 to-slate-950 p-6 border border-cyan-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <DatabaseBackup className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Veritabanı Yedekleme & Canlı UI Önizleme Merkezi</h1>
            <p className="text-xs text-cyan-200/70">
              Sistem verilerini dışa aktarın, geri yükleyin ve kullanıcının gerçekte gördüğü canlı UI ekranları ile önizleyin.
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
              Dosya incelendi. Aşağıdaki 'Canlı UI Ekran Ön İzlemesi' bölümünden kullanıcının ekranında nasıl duracağını görebilirsiniz.
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

      {/* ✨ LIVE UI SCREEN PREVIEW FEATURE: Canlı Ekran & Arayüz Ön İzleme (User Visual View) */}
      <Card className="border-cyan-500/30 bg-gradient-to-b from-card via-card to-cyan-950/5 shadow-md">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  🎨 Canlı Arayüz & UI Ekran Ön İzlemesi
                </CardTitle>
                <CardDescription className="text-xs">
                  Sanki o tabloya o veri eklenmiş gibi kullanıcının gerçekte göreceği canlı UI kartları ve ekran simülasyonu.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-xl border bg-muted/60 p-1">
                <Button
                  size="sm"
                  variant={previewViewMode === "ui" ? "default" : "ghost"}
                  onClick={() => setPreviewViewMode("ui")}
                  className={`h-7 px-3 text-xs gap-1 font-bold ${
                    previewViewMode === "ui" ? "bg-cyan-600 text-white shadow-sm" : ""
                  }`}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  🎨 Canlı UI Görünümü
                </Button>
                <Button
                  size="sm"
                  variant={previewViewMode === "raw" ? "default" : "ghost"}
                  onClick={() => setPreviewViewMode("raw")}
                  className={`h-7 px-3 text-xs gap-1 font-bold ${
                    previewViewMode === "raw" ? "bg-cyan-600 text-white shadow-sm" : ""
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  📊 Ham Veri Tablosu
                </Button>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={fetchLivePreviewData}
                disabled={busy === "fetch-preview"}
                className="gap-1.5 border-cyan-500/40 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10 text-xs font-semibold"
              >
                {busy === "fetch-preview" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                Önizlemeyi Yenile
              </Button>
            </div>
          </div>

          {/* Table & Filter Controls */}
          <div className="mt-4 grid gap-3 grid-cols-1 sm:grid-cols-3 pt-2">
            <div>
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Önizlenecek Modül / Tablo Seçin:</label>
              <Select value={selectedPreviewTable} onValueChange={setSelectedPreviewTable}>
                <SelectTrigger className="h-10 text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableTables.map((tbl) => (
                    <SelectItem key={tbl} value={tbl} className="font-semibold text-xs cursor-pointer">
                      {tbl === "gider_kayitlari"
                        ? "📊 Gelir & Gider Kayıtları UI"
                        : tbl === "personeller"
                        ? "👥 Personeller & Maaşlar UI"
                        : tbl === "avans_talepleri"
                        ? "💰 Avans Talepleri UI"
                        : tbl === "subeler"
                        ? "🏪 Şubeler Yönetimi UI"
                        : tbl === "user_profiles"
                        ? "⚙️ Kullanıcı Profilleri & Yetkiler UI"
                        : `📊 Tablo: ${tbl}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-muted-foreground block mb-1">Arayüz İçinde Canlı Ara:</label>
              <div className="relative">
                <Input
                  placeholder="İsim, tarih, tutar veya açıklama arayın..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="h-10 text-xs pl-9"
                />
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-cyan-900 dark:text-cyan-200 bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/20">
            <span className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              Ekran Modülü: <strong className="font-extrabold text-foreground">{selectedPreviewTable}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Badge className="bg-cyan-600 text-white font-bold">{tableRows.length} Kayıt Gösteriliyor</Badge>
              {pendingBackup && <Badge className="bg-amber-500 text-white font-bold">📂 Yüklenen Dosya Simülasyonu</Badge>}
            </div>
          </div>

          {/* RENDER LIVE UI VISUAL COMPONENTS AS THE USER SEES THEM IN APP */}
          {previewViewMode === "ui" ? (
            <div className="space-y-4">
              {tableRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                  <LayoutGrid className="h-10 w-10 text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-semibold">Bu modülde önizlenecek veri kaydı bulunamadı.</p>
                  <p className="text-xs opacity-75 mt-1">Lütfen baska bir tablo seçin veya arama filtresini değiştirin.</p>
                </div>
              ) : selectedPreviewTable === "gider_kayitlari" || selectedPreviewTable === "gelir_kayitlari" ? (
                /* Gelir & Gider Kayıtları UI Component Preview */
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tableRows.slice(0, 12).map((row: any, idx: number) => {
                      const isIncome = row.tur === "gelir" || Number(row.tutar || 0) > 0
                      const tutar = Math.abs(Number(row.tutar || row.miktar || 0))
                      return (
                        <div
                          key={idx}
                          className="rounded-2xl border bg-card p-4 shadow-xs hover:shadow-sm transition-all border-border/80"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-xs text-muted-foreground flex items-center gap-1.5">
                              <Receipt className="h-3.5 w-3.5 text-cyan-500" />
                              {row.kategori || row.tur || "İşlem Kaydı"}
                            </span>
                            <Badge className={isIncome ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}>
                              {isIncome ? "🟢 Gelir" : "🔴 Gider"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className={`text-xl font-extrabold ${isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                              {isIncome ? "+" : "-"}{formatMoney(tutar)}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-semibold">
                              {row.tarih || (row.created_at ? row.created_at.slice(0, 10) : "")}
                            </span>
                          </div>
                          {row.aciklama ? (
                            <p className="mt-2 text-xs text-muted-foreground italic bg-muted/40 p-2 rounded-xl truncate">
                              "{row.aciklama}"
                            </p>
                          ) : null}
                          <div className="mt-3 pt-2 border-t border-dashed flex items-center justify-between text-[11px] text-muted-foreground">
                            <span>Kasa/Ödeme: <strong className="text-foreground">{row.odeme_turu || "Nakit"}</strong></span>
                            <Badge variant="outline" className="text-[10px]">✨ UI Simülasyonu</Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : selectedPreviewTable === "personeller" ? (
                /* Personeller UI Component Preview */
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tableRows.slice(0, 12).map((row: any, idx: number) => {
                    return (
                      <div key={idx} className="rounded-2xl border bg-card p-4 shadow-xs border-border/80 hover:border-cyan-500/40 transition">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-extrabold text-sm border border-cyan-500/30">
                            {row.ad ? row.ad.slice(0, 2).toUpperCase() : "P"}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-sm text-foreground">{row.ad || "Personel"}</h4>
                            <p className="text-xs text-muted-foreground font-semibold">{row.gorev || "Saha Personeli"}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border border-border/50">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Aylık Taban:</span>
                            <strong className="text-foreground font-bold">{formatMoney(Number(row.aylik_maas || 0))}</strong>
                          </div>
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Saat Ücreti:</span>
                            <strong className="text-emerald-600 font-bold">{formatMoney(Number(row.saat_ucreti || 0))}</strong>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : selectedPreviewTable === "avans_talepleri" ? (
                /* Avans Talepleri UI Component Preview */
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tableRows.slice(0, 12).map((row: any, idx: number) => {
                    const isPending = row.durum === "beklemede"
                    const isApproved = row.durum === "onaylandi"
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl border p-4 shadow-xs bg-card transition ${
                          isPending
                            ? "border-amber-300 dark:border-amber-500/40"
                            : isApproved
                            ? "border-emerald-300 dark:border-emerald-500/40"
                            : "border-red-300 dark:border-red-500/40"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground">{row.user_name || "Personel"}</span>
                          <Badge className={isPending ? "bg-amber-500 text-white" : isApproved ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}>
                            {isPending ? "⏳ Beklemede" : isApproved ? "✅ Onaylandı" : "❌ Reddedildi"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xl font-extrabold text-foreground">
                          {formatMoney(Number(row.tutar || 0))}
                        </div>
                        {row.aciklama ? (
                          <p className="mt-2 text-xs italic text-muted-foreground bg-muted/40 p-2 rounded-xl">
                            "{row.aciklama}"
                          </p>
                        ) : null}
                        {isApproved && row.odeme_tarihi ? (
                          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            📅 Ödeme Tarihi: {row.odeme_tarihi}
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* Generic Styled Card Grid Preview for other tables */
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {tableRows.slice(0, 12).map((row: any, idx: number) => {
                    const title = row.ad || row.title || row.user_name || row.display_name || row.sube_adi || `Kayıt #${idx + 1}`
                    return (
                      <div key={idx} className="rounded-2xl border bg-card p-4 shadow-xs border-border/80 hover:border-cyan-500/30 transition">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground truncate">{title}</span>
                          <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-[10px]">
                            {selectedPreviewTable}
                          </Badge>
                        </div>
                        <pre className="mt-2 text-[10px] font-mono text-muted-foreground bg-muted/40 p-2 rounded-xl max-h-24 overflow-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(row, null, 2)}
                        </pre>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            /* RAW DATA TABLE VIEW */
            <div className="max-h-[380px] overflow-auto rounded-xl border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur border-b font-bold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Simülasyon Durumu</th>
                    <th className="px-4 py-3">Kayıt Veri Özeti (JSON / Sütunlar)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tableRows.slice(0, 50).map((row: any, idx: number) => {
                    const rowText = typeof row === "object" ? JSON.stringify(row) : String(row)
                    const isIncome = rowText.includes("gelir") || rowText.includes("onaylandi")
                    const isExpense = rowText.includes("gider") || rowText.includes("reddedildi")
                    const rowTitle = row?.ad || row?.user_name || row?.display_name || row?.tarih || row?.created_at || `Kayıt #${idx + 1}`

                    return (
                      <tr key={idx} className="hover:bg-cyan-500/5 transition">
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{idx + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge
                            className={
                              isIncome
                                ? "bg-emerald-600 text-white"
                                : isExpense
                                ? "bg-amber-600 text-white"
                                : "bg-cyan-600 text-white"
                            }
                          >
                            <BadgeCheck className="h-3 w-3 mr-1" />
                            {pendingBackup ? "✨ Eklenecek Veri" : "✅ Canlı Tablo Kaydı"}
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
