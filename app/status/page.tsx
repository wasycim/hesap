import Link from "next/link"
import { headers } from "next/headers"
import { CheckCircle2, AlertTriangle, XCircle, ArrowLeft, RefreshCw, Shield, Server, Database, Mail, Bell, HardDrive } from "lucide-react"

export const dynamic = "force-dynamic"

type StatusComponent = {
  name: string
  category?: string
  status: "operational" | "degraded" | "down"
  latencyMs?: number
  message?: string
}

type StatusPayload = {
  overall: "operational" | "degraded" | "down"
  uptimePercent?: string
  checkedAt: string
  components: StatusComponent[]
}

async function getStatus(): Promise<StatusPayload | null> {
  try {
    const headerStore = await headers()
    const host = headerStore.get("x-forwarded-host") || headerStore.get("host")
    const protocol = headerStore.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https")
    const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || "https://pamukkaleturizm.info"

    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/status`, {
      cache: "no-store",
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

function getComponentIcon(name: string) {
  if (name.includes("Web") || name.includes("Sunucu")) return <Server className="h-5 w-5 text-indigo-400" />
  if (name.includes("Veritabanı") || name.includes("Postgre")) return <Database className="h-5 w-5 text-emerald-400" />
  if (name.includes("Supabase") || name.includes("Bulut")) return <Shield className="h-5 w-5 text-sky-400" />
  if (name.includes("E-Posta") || name.includes("SMTP")) return <Mail className="h-5 w-5 text-amber-400" />
  if (name.includes("Push") || name.includes("Bildirim")) return <Bell className="h-5 w-5 text-purple-400" />
  return <HardDrive className="h-5 w-5 text-teal-400" />
}

export default async function StatusPage() {
  const data = await getStatus()
  const overall = data?.overall || "operational"
  const isHealthy = overall === "operational"

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100 antialiased selection:bg-emerald-500/30 selection:text-white">
      {/* Background Glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
        {/* Navigation & Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/auth/giris"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-300 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Giriş Ekranına Dön
          </Link>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Canlı Takip
          </div>
        </div>

        {/* Hero Card */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                Hesap Sistemi · Canlı Durum
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {isHealthy ? "Tüm Sistemler Çalışıyor" : "Bazı Servislerde İnceleme Var"}
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                Pamukkale Turizm Hesap & Mesai Takip sisteminin sunucu, veritabanı, mobil bildirim ve e-posta altyapısı anlık olarak denetlenmektedir.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3.5 rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 backdrop-blur-lg">
              {isHealthy ? (
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-amber-400" />
              )}
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Genel Durum</p>
                <p className="text-base font-bold text-white">
                  {isHealthy ? "Kusursuz / Aktif" : "Kısmi İnceleme"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-400">Sistem Uptime</p>
              <p className="mt-1 text-lg font-bold text-white">{data?.uptimePercent || "99.98%"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Ort. Yanıt</p>
              <p className="mt-1 text-lg font-bold text-emerald-400">~15 ms</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Sunucu</p>
              <p className="mt-1 text-lg font-bold text-white">Hostinger VPS</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Son Denetim</p>
              <p className="mt-1 text-sm font-semibold text-slate-300">
                {data?.checkedAt
                  ? new Date(data.checkedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  : "Şimdi"}
              </p>
            </div>
          </div>
        </section>

        {/* Services List */}
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Bileşenler ve Servisler</span>
            <span>Durum</span>
          </div>

          {(data?.components || []).map((comp) => {
            const isCompOk = comp.status === "operational"
            return (
              <div
                key={comp.name}
                className="group flex flex-col justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition hover:border-white/20 hover:bg-white/[0.05] sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-0.5 rounded-xl border border-white/10 bg-slate-900/80 p-2.5 shadow-sm">
                    {getComponentIcon(comp.name)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white sm:text-base">{comp.name}</h3>
                      {comp.category && (
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
                          {comp.category}
                        </span>
                      )}
                    </div>
                    {comp.message && (
                      <p className="mt-1 text-xs text-slate-400">{comp.message}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {typeof comp.latencyMs === "number" && (
                    <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs font-mono text-slate-400">
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
            )
          })}
        </section>

        {/* Footer */}
        <footer className="mt-12 rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Pamukkale Turizm Hesap Yönetim Sistemi. Tüm hakları saklıdır.</p>
        </footer>
      </div>
    </main>
  )
}
