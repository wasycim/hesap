import { createClient } from "@/lib/supabase/server"
import { Wrench } from "lucide-react"
import Link from "next/link"

async function getMaintenanceMessage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle()

  const value = data?.value as { message?: string } | null
  return value?.message || "Sistem bakim modunda. Kisa sure sonra tekrar deneyin."
}

export default async function MaintenancePage() {
  const message = await getMaintenanceMessage()

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-400 text-slate-950">
          <Wrench className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.18em] text-amber-200">Bakim modu</p>
        <h1 className="mt-3 text-3xl font-black tracking-normal">Hesap gecici olarak kapali</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{message}</p>
        <Link
          href="/auth/giris?next=/dashboard/operasyon"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/10 px-5 text-sm font-bold text-amber-100 transition hover:bg-amber-300/20"
        >
          Developer girisi
        </Link>
      </section>
    </main>
  )
}
