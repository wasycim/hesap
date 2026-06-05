"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { DatabaseBackup, Download, ShieldAlert, Trash2, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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

export function LogBackupPanel() {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState<"download" | "upload" | "delete-logs" | "delete-settings" | "delete-all" | null>(null)
  const [lastBackup, setLastBackup] = useState<BackupPayload | null>(null)

  async function downloadBackup() {
    setBusy("download")
    const response = await fetch("/api/admin/log-backup", { cache: "no-store" })
    const data = await response.json().catch(() => null) as BackupPayload | null
    setBusy(null)

    if (!response.ok || !data) {
      toast.error((data as any)?.error || "Log yedegi indirilemedi.")
      return
    }

    setLastBackup(data)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `hesap-log-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Log yedegi indirildi.")
  }

  async function uploadBackup(file: File | null) {
    if (!file) return
    setBusy("upload")
    const text = await file.text()
    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      setBusy(null)
      toast.error("Yuklenen dosya JSON formatinda degil.")
      return
    }

    const response = await fetch("/api/admin/log-backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    setBusy(null)
    if (fileRef.current) fileRef.current.value = ""

    if (!response.ok) {
      toast.error(result.error || "Log yedegi yuklenemedi.")
      return
    }

    setLastBackup(payload as BackupPayload)
    toast.success(`Yedek yuklendi: ${(result.restored || []).join(", ") || "kayit yok"}`)
  }

  async function deleteTarget(target: "logs" | "security-settings" | "all") {
    const label = target === "logs" ? "gelismis loglar" : target === "security-settings" ? "guvenlik ayarlari" : "loglar ve guvenlik ayarlari"
    if (!window.confirm(`${label} silinsin mi? Bu islemden once yedek indirmeniz onerilir.`)) return

    const busyKey = target === "logs" ? "delete-logs" : target === "security-settings" ? "delete-settings" : "delete-all"
    setBusy(busyKey)
    const response = await fetch(`/api/admin/log-backup?target=${target}`, { method: "DELETE" })
    const result = await response.json().catch(() => ({}))
    setBusy(null)

    if (!response.ok) {
      toast.error(result.error || "Silme islemi tamamlanamadi.")
      return
    }

    toast.success("Silme islemi tamamlandi.")
  }

  return (
    <main className="space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-normal">Log Backup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Developer seviyesinde gelismis log, guvenlik ayari, terminal cihaz ve lisans kayitlarini indir, geri yukle veya temizle.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">Developer only</Badge>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" />
              Yedek indir / yukle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              Indirilen dosya JSON formatindadir. Geri yukleme ayni ID'li kayitlari gunceller, eksik kayitlari ekler.
              Sifreler veya gizli anahtarlar bu yedegin icine yazilmaz.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={downloadBackup} disabled={busy === "download"} className="gap-2">
                <Download className="h-4 w-4" />
                Log indir
              </Button>
              <Button type="button" variant="outline" disabled={busy === "upload"} className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                Log yukle
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(event) => uploadBackup(event.target.files?.[0] || null)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Kritik silme islemleri
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-muted-foreground">
              Bu bolum sadece developer icindir. Silmeden once mutlaka log yedegi indirin.
            </p>
            <div className="grid gap-2">
              <Button variant="outline" disabled={busy === "delete-logs"} className="justify-start gap-2 text-red-600" onClick={() => deleteTarget("logs")}>
                <Trash2 className="h-4 w-4" />
                Gelismis loglari sil
              </Button>
              <Button variant="outline" disabled={busy === "delete-settings"} className="justify-start gap-2 text-amber-600" onClick={() => deleteTarget("security-settings")}>
                <Trash2 className="h-4 w-4" />
                Guvenlik ayarlarini sil
              </Button>
              <Button variant="destructive" disabled={busy === "delete-all"} className="justify-start gap-2" onClick={() => deleteTarget("all")}>
                <Trash2 className="h-4 w-4" />
                Tum log backup kapsamını sil
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Son yedek ozeti</CardTitle>
        </CardHeader>
        <CardContent>
          {!lastBackup ? (
            <p className="text-sm text-muted-foreground">Bu oturumda henuz yedek indirilmedi veya yuklenmedi.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {tableCount(lastBackup).map((item) => (
                <div key={item.table} className="flex items-center justify-between rounded-xl border p-3 text-sm">
                  <span className="font-semibold">{item.table}</span>
                  <Badge>{item.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
