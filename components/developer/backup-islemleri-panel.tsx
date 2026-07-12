"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { DatabaseBackup, Download, ShieldAlert, Trash2, Upload, ServerCrash, RefreshCw, X, Check, FileJson, AlertTriangle, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
    const data = await response.json().catch(() => null) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error((data as any)?.error || "Veritabanı yedeği indirilemedi.")
      return
    }

    setLastBackup(data)
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
    const data = await response.json().catch(() => null) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error((data as any)?.error || "Log yedeği indirilemedi.")
      return
    }

    setLastBackup(data)
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

    setPendingBackup({
      type,
      payload: payload as BackupPayload,
      fileName: file.name
    })
    
    // Reset file input values
    if (fullFileRef.current) fullFileRef.current.value = ""
    if (logFileRef.current) logFileRef.current.value = ""
    
    toast.info("Yedek dosyası önizlemesi hazır. Lütfen kontrol edip onaylayın.")
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
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    setPendingBackup(null)

    if (!response.ok) {
      toast.error(result.error || "Yedek geri yüklenemedi.")
      return
    }

    setLastBackup(payload)
    setBackupType(type)
    toast.success(`Yedek başarıyla geri yüklendi. İşlem yapılan tablolar: ${(result.restored || []).join(", ") || "kayıt yok"}`)
  }

  async function deleteTarget(target: "logs" | "security-settings" | "all") {
    const label =
      target === "logs"
        ? "gelişmiş loglar"
        : target === "security-settings"
          ? "güvenlik ayarları"
          : "loglar ve güvenlik ayarları"
    if (!window.confirm(`${label} silinsin mi? Bu işlemden önce mutlaka yedek indirmeniz önerilir.`)) return

    const busyKey = target === "logs" ? "delete-logs" : target === "security-settings" ? "delete-settings" : "delete-all"
    setBusy(busyKey)
    const response = await fetch(`/api/admin/log-backup?target=${target}`, { method: "DELETE" })
    const result = await response.json().catch(() => ({}))
    setBusy(null)

    if (!response.ok) {
      toast.error(result.error || "Silme işlemi tamamlanamadı.")
      return
    }

    toast.success("Silme işlemi başarıyla tamamlandı.")
  }

  return (
    <main className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Backup İşlemleri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sistem seviyesinde tam veritabanı yedeği veya log yedeği indir, geri yükle ya da temizleme işlemlerini yönetin.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-cyan-500/30 text-cyan-600 bg-cyan-50/50 dark:bg-cyan-950/20 dark:text-cyan-400">
          Developer Mode
        </Badge>
      </header>

      {/* PENDING BACKUP PREVIEW SECTION */}
      {pendingBackup && (
        <Card className="border-amber-500/40 dark:border-amber-600/40 bg-amber-500/5 shadow-md animate-in fade-in zoom-in-95 duration-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-5 w-5 animate-pulse" />
                Yüklenecek Yedek Önizlemesi
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setPendingBackup(null)} className="h-8 w-8 hover:bg-amber-500/20">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-muted-foreground mt-1">
              Dosya adı: <span className="font-mono font-bold text-foreground">{pendingBackup.fileName}</span> (
              {pendingBackup.type === "full" ? "Tüm Veritabanı Yedeği" : "Sistem Log & Ayar Yedeği"})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-amber-500/10 p-3 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
              <strong>DİKKAT:</strong> "Yüklemeyi Onayla ve Başlat" butonuna bastığınızda, bu yedek dosyasının içindeki tablolar veritabanındaki mevcut kayıtların üzerine yazılacaktır. Bu işlem geri alınamaz!
            </div>
            
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dosyadaki Tablolar ve Kayıt Sayıları:</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 max-h-48 overflow-y-auto pr-1">
                {tableCount(pendingBackup.payload).map((item) => (
                  <div key={item.table} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-background/50 p-2 text-xs">
                    <span className="font-semibold truncate max-w-[150px]" title={item.table}>{item.table}</span>
                    <Badge variant="secondary" className="px-1.5 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      {item.count} satır
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-amber-500/20">
              <Button 
                onClick={executeRestore} 
                disabled={busy !== null}
                className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                {busy !== null ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Yüklemeyi Onayla ve Başlat
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setPendingBackup(null)}
                disabled={busy !== null}
                className="border-amber-600/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
              >
                İptal Et
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-6 md:grid-cols-2">
        {/* Full Database Backup Card */}
        <Card className="border-border hover:border-cyan-500/20 transition-all duration-300 shadow-sm hover:shadow">
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
              İndirilen dosya JSON formatındadır. Geri yükleme işlemi öncesinde yedek içeriği önizlenir, ardından onaylanırsa yüklenir. Hassas şifreler veya gizli anahtarlar bu yedeğin içerisine yazılmaz.
            </p>

            {/* Premium Date Range Selection Area */}
            <div className="space-y-4 bg-muted/30 border border-border/80 rounded-2xl p-4 my-2 shadow-2xs">
              <label className="flex flex-col gap-2 font-bold text-xs text-muted-foreground">
                Yedeklenecek Tarih Aralığı:
                <div className="relative">
                  <select
                    value={rangeType}
                    onChange={(e) => setRangeType(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background pl-10 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-cyan-500 text-foreground font-semibold appearance-none cursor-pointer hover:bg-muted/10 transition-colors"
                  >
                    <option value="all">Tüm Zamanlar (Tavsiye Edilen)</option>
                    <option value="last-week">Geçen Hafta (Son 7 Gün)</option>
                    <option value="last-month">Geçen Ay (Son 30 Gün)</option>
                    <option value="last-4-months">Son 4 Ay</option>
                    <option value="last-6-months">Son 6 Ay</option>
                    <option value="this-year">Bu Yıl ({new Date().getFullYear()})</option>
                    <option value="custom">Özel Tarih Aralığı...</option>
                  </select>
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cyan-500 pointer-events-none" />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground/75 text-[10px]">
                    ▼
                  </div>
                </div>
              </label>

              {rangeType === "custom" && (
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border/50 border-dashed animate-in fade-in slide-in-from-top-1 duration-200">
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground">
                    Başlangıç Tarihi:
                    <div className="relative">
                      <input
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500 font-semibold text-foreground transition-all cursor-pointer"
                      />
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </label>
                  <label className="flex flex-col gap-1.5 text-[10px] font-bold text-muted-foreground">
                    Bitiş Tarihi:
                    <div className="relative">
                      <input
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        className="flex h-10 w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500 font-semibold text-foreground transition-all cursor-pointer"
                      />
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </label>
                </div>
              )}

              {/* Dynamic Info Box for range preview */}
              <div className="flex items-start gap-2.5 rounded-xl bg-cyan-500/5 p-3 border border-cyan-500/10 text-[11px] text-cyan-700 dark:text-cyan-400 font-semibold leading-relaxed">
                <Calendar className="h-4 w-4 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
                <span>{getFormattedRangePreview()}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={downloadFullBackup} disabled={busy !== null} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
                {busy === "download-full" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Veritabanı Yedeği İndir
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="gap-2 border-cyan-600/30 hover:bg-cyan-50/20 dark:hover:bg-cyan-950/10 text-cyan-600 dark:text-cyan-400"
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
              Sistem güvenliği ve ayar yapısını taşımak için kullanılır. İşlemsel kayıtları (gelir, gider vb.) kapsamaz, yüklemeden önce dosya içeriğindeki satır sayılarını inceleyebilirsiniz.
            </p>
            <div className="flex flex-wrap gap-2 pt-24">
              <Button onClick={downloadLogBackup} disabled={busy !== null} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
                {busy === "download-log" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Log Yedeği İndir
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                className="gap-2 border-violet-600/30 hover:bg-violet-50/20 dark:hover:bg-violet-950/10 text-violet-600 dark:text-violet-400"
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
