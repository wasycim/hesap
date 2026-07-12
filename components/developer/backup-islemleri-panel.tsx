"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { DatabaseBackup, Download, ShieldAlert, Trash2, Upload, ServerCrash, RefreshCw } from "lucide-react"
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

  // Full Database Backup Functions
  async function downloadFullBackup() {
    setBusy("download-full")
    const response = await fetch("/api/admin/backup", { cache: "no-store" })
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
    link.download = `hesap-database-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Tüm veritabanı yedeği başarıyla indirildi.")
  }

  async function uploadFullBackup(file: File | null) {
    if (!file) return
    if (!window.confirm("Seçilen veritabanı yedeği geri yüklenecektir. Mevcut verilerin üzerine yazılabilir. Devam etmek istiyor musunuz?")) return

    setBusy("upload-full")
    const text = await file.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      setBusy(null)
      toast.error("Yüklenen dosya JSON formatında değil.")
      return
    }

    const response = await fetch("/api/admin/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (fullFileRef.current) fullFileRef.current.value = ""

    if (!response.ok) {
      toast.error(result.error || "Veritabanı yedeği geri yüklenemedi.")
      return
    }

    setLastBackup(payload as BackupPayload)
    setBackupType("full")
    toast.success(`Tüm veritabanı yedeği başarıyla yüklendi. Geri yüklenen tablolar: ${(result.restored || []).join(", ") || "kayıt yok"}`)
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

  async function uploadLogBackup(file: File | null) {
    if (!file) return
    setBusy("upload-log")
    const text = await file.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      setBusy(null)
      toast.error("Yüklenen dosya JSON formatında değil.")
      return
    }

    const response = await fetch("/api/admin/log-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (logFileRef.current) logFileRef.current.value = ""

    if (!response.ok) {
      toast.error(result.error || "Log yedeği yüklenemedi.")
      return
    }

    setLastBackup(payload as BackupPayload)
    setBackupType("log")
    toast.success(`Log yedeği yüklendi: ${(result.restored || []).join(", ") || "kayıt yok"}`)
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
              İndirilen dosya JSON formatındadır. Geri yükleme işlemi, aynı ID'li kayıtları günceller ve eksik olanları sisteme ekler. Hassas şifreler veya gizli anahtarlar bu yedeğin içerisine yazılmaz.
            </p>
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
                {busy === "upload-full" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Veritabanı Yedeği Yükle
              </Button>
              <input
                ref={fullFileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => uploadFullBackup(event.target.files?.[0] || null)}
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
              Sistem güvenliği, denetim kaydı (audit) ve ayar yapısını taşımak için kullanılır. İşlemsel kayıtları (gelir, gider vb.) kapsamaz, sadece sistem ayarlarını ve logları kapsar.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
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
                {busy === "upload-log" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Log Yedeği Yükle
              </Button>
              <input
                ref={logFileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => uploadLogBackup(event.target.files?.[0] || null)}
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
