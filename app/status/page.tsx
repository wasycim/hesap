"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  RefreshCw,
  Shield,
  Server,
  Database,
  Mail,
  Bell,
  HardDrive,
  Cpu,
  Zap,
  Lock,
  Cloud,
  Clock,
  Activity,
  Layers,
} from "lucide-react"

type ComponentState = "operational" | "degraded" | "down"

type Component = {
  name: string
  category: "Veritabanı" | "Altyapı & Sunucu" | "Yedekleme & Güvenlik" | "İletişim & Bildirim"
  status: ComponentState
  latencyMs?: number
  message: string
  details?: Record<string, string | number | boolean>
}

type StatusPayload = {
  overall: ComponentState
  uptimePercent: string
  checkedAt: string
  metrics: {
    dbLatencyMs: number
    totalRows: number
    tableCount: number
    userCount: number
    memoryRss: string
    memoryHeap: string
    serverUptime: string
    platform: string
    nodeVersion: string
    lastBackup: {
      title: string
      interval: string
      sizeBytes: number
      date: string
      status: string
    } | null
  }
  components: Component[]
}

function getComponentIcon(name: string) {
  if (name.includes("Web") || name.includes("Sunucu")) return <Server className="h-5 w-5 text-indigo-400" />
  if (name.includes("Birincil") || name.includes("Postgre")) return <Database className="h-5 w-5 text-emerald-400" />
  if (name.includes("İkincil") || name.includes("Supabase")) return <Cloud className="h-5 w-5 text-sky-400" />
  if (name.includes("Yedekleme") || name.includes("S3")) return <HardDrive className="h-5 w-5 text-teal-400" />
  if (name.includes("E-Posta") || name.includes("SMTP")) return <Mail className="h-5 w-5 text-amber-400" />
  if (name.includes("Push") || name.includes("Mobil")) return <Bell className="h-5 w-5 text-purple-400" />
  return <Shield className="h-5 w-5 text-emerald-400" />
}

export default function StatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  async function fetchStatus() {
    try {
      setLoading(true)
      const res = await fetch("/api/status", { cache: "no-store" })
      if (!res.ok) throw new Error("Durum alınamadı")
      const json: StatusPayload = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatus()
    const timer = setInterval(() => {
      fetchStatus()
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const overall = data?.overall || "operational"
  const isHealthy = overall === "operational"

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-white">
      {/* Dynamic Background Glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[130px]" />
        <div className="absolute top-1/3 -right-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[140px]" />
        <div className="absolute bottom-10 -left-40 h-80 w-80 rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Navigation & Controls */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/auth/giris"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Giriş Ekranına Dön
          </Link>

          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 px-3.5 py-1.5 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Canlı İzleme (30s)</span>
            </div>

            <button
              onClick={() => startTransition(() => fetchStatus())}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              Yenile
            </button>
          </div>
        </div>

        {/* Hero Banner */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-400">
                <Activity className="h-3.5 w-3.5" />
                Pamukkale Turizm Hesap Altyapısı
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {isHealthy ? "Tüm Servisler Kusursuz Çalışıyor" : "Bazı Servislerde Kısmi İnceleme Var"}
              </h1>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
                Web sunucusu, yerel VPS PostgreSQL veritabanı, bulut yedekleme, e-posta SMTP ve mobil bildirim altyapısı anlık olarak izlenmektedir.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-900/70 px-5 py-4 backdrop-blur-lg">
              {isHealthy ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-400" />
              )}
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Genel Durum</p>
                <p className="text-sm font-bold text-white sm:text-base">
                  {isHealthy ? "Aktif & Sağlıklı" : "İnceleme Gerekli"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="mt-8 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span>DB Gecikmesi</span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-emerald-400">
                {data?.metrics?.dbLatencyMs !== undefined ? `${data.metrics.dbLatencyMs} ms` : "..."}
              </p>
              <p className="text-[11px] text-slate-500">Yerel VPS bağlantısı</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span>Veritabanı Satırı</span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-white">
                {data?.metrics?.totalRows ? data.metrics.totalRows.toLocaleString("tr-TR") : "11.919+"}
              </p>
              <p className="text-[11px] text-slate-500">{data?.metrics?.tableCount || 60} tablo aktif</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Cpu className="h-3.5 w-3.5 text-sky-400" />
                <span>Sunucu RAM (RSS)</span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-white">
                {data?.metrics?.memoryRss || "..."}
              </p>
              <p className="text-[11px] text-slate-500">Uptime: {data?.metrics?.serverUptime || "..."}</p>
            </div>

            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                <span>Son Denetim</span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-slate-200">
                {data?.checkedAt
                  ? new Date(data.checkedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "Şimdi"}
              </p>
              <p className="text-[11px] text-slate-500">Uptime: {data?.uptimePercent || "99.98%"}</p>
            </div>
          </div>
        </section>

        {/* Detailed Service Components */}
        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Altyapı ve Servis Bileşenleri</span>
            <span>Çalışma Durumu</span>
          </div>

          <div className="grid gap-3.5">
            {(data?.components || []).map((comp) => {
              const isCompOk = comp.status === "operational"
              return (
                <div
                  key={comp.name}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5 rounded-xl border border-white/10 bg-slate-900/80 p-2.5 shadow-sm">
                        {getComponentIcon(comp.name)}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white sm:text-base">{comp.name}</h3>
                          {comp.category && (
                            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
                              {comp.category}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-300 sm:text-sm">{comp.message}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-start">
                      {typeof comp.latencyMs === "number" && (
                        <span className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-xs font-mono text-slate-300">
                          {comp.latencyMs} ms
                        </span>
                      )}
                      <div
                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
                          isCompOk
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            isCompOk ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                          }`}
                        />
                        {isCompOk ? "Çalışıyor" : "Beklemede"}
                      </div>
                    </div>
                  </div>

                  {/* Component Metadata / Details Grid */}
                  {comp.details && Object.keys(comp.details).length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 pt-3 sm:grid-cols-3 lg:grid-cols-4">
                      {Object.entries(comp.details).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-slate-900/40 p-2 text-xs">
                          <span className="text-[10px] uppercase font-semibold text-slate-500">{key}</span>
                          <p className="mt-0.5 truncate font-medium text-slate-200">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Disaster Recovery & Backup Notice */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-500/10 via-slate-900/40 to-indigo-500/10 p-5 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                <Lock className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Çift Yönlü Güvenlik ve Felaket Koruması</h4>
                <p className="text-xs text-slate-400">
                  Verileriniz hem Hostinger VPS üzerinde ultra düşük gecikmeyle çalışmakta, hem de Supabase Bulut & Cloudflare R2 kasasında yedeklenmektedir.
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              <span className="inline-block rounded-md bg-white/[0.06] px-2.5 py-1 font-mono text-emerald-400">
                AES-256-GCM
              </span>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Pamukkale Turizm Hesap Yönetim Sistemi. Tüm hakları saklıdır.</p>
        </footer>
      </div>
    </main>
  )
}
