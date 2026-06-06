import { headers } from "next/headers"

type StatusPayload = {
  overall: "operational" | "degraded" | "down"
  checkedAt: string
  components: Array<{
    name: string
    status: "operational" | "degraded" | "down"
    latencyMs?: number
    message?: string
  }>
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

function statusLabel(value?: string) {
  if (value === "operational") return "Çalışıyor"
  if (value === "degraded") return "Kısmi sorun"
  return "Kesinti"
}

function statusClass(value?: string) {
  if (value === "operational") return "bg-emerald-500"
  if (value === "degraded") return "bg-amber-500"
  return "bg-red-500"
}

export default async function StatusPage() {
  const status = await getStatus()
  const overall = status?.overall || "down"

  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-8 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">Hesap durum sayfası</p>
              <h1 className="mt-3 text-3xl font-black tracking-normal sm:text-4xl">Sistem Sağlığı</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Web, veritabanı, Supabase, bildirim ve yedekleme servislerinin canlı durumunu buradan takip edebilirsiniz.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${statusClass(overall)}`} />
                <span className="text-lg font-black">{statusLabel(overall)}</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Son kontrol: {status?.checkedAt ? new Date(status.checkedAt).toLocaleString("tr-TR") : "Alınamadı"}
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3">
          {(status?.components || []).map((component) => (
            <article key={component.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusClass(component.status)}`} />
                  <h2 className="font-bold">{component.name}</h2>
                </div>
                <div className="text-sm font-semibold text-slate-300">
                  {statusLabel(component.status)}
                  {typeof component.latencyMs === "number" ? ` · ${component.latencyMs} ms` : ""}
                </div>
              </div>
              {component.message ? <p className="mt-2 text-sm text-slate-400">{component.message}</p> : null}
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
