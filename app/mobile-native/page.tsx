import type { Metadata } from "next"
import { BellRing, Camera, Download, RefreshCw, ShieldCheck, Smartphone, WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "Mobil Native Özellikler | Hesap",
  description: "Hesap iOS ve Android uygulaması için native özellik ekranı.",
}

const features = [
  {
    title: "Push bildirim",
    text: "Geç kalma, fazla mesai ve yönetici uyarıları cihaz bildirimleriyle takip edilir.",
    icon: BellRing,
    color: "text-emerald-500",
  },
  {
    title: "Terminal QR kamera",
    text: "Personel kendi cihaz kamerasıyla terminaldeki güvenli QR kodu okutur.",
    icon: Camera,
    color: "text-amber-500",
  },
  {
    title: "Offline ekran",
    text: "Bağlantı yokken güvenli uyarı ekranı ve yeniden yükleme akışı açılır.",
    icon: WifiOff,
    color: "text-rose-500",
  },
  {
    title: "PDF indirme",
    text: "Mesai, vardiya, maaş ve log raporları mobil PDF akışına uygun hazırlanır.",
    icon: Download,
    color: "text-sky-500",
  },
]

export default function MobileNativePage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-5 py-6 text-white">
      <section className="mx-auto flex max-w-md flex-col gap-5">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src="/iconw.png" alt="Hesap" className="h-11 w-11 object-contain" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-300">Wasy Systems</p>
                <h1 className="text-xl font-black tracking-normal">Hesap Mobil</h1>
              </div>
            </div>
            <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">Hazır</span>
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-300">
            iOS ve Android uygulaması; bildirim, kamera, offline durum, haptic geri bildirim, PDF ve güvenli cihaz kaydıyla güçlendirildi.
          </p>
        </header>

        <section className="grid gap-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article key={feature.title} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-slate-950">
                  <Icon className={`h-5 w-5 ${feature.color}`} />
                </div>
                <div>
                  <h2 className="font-bold">{feature.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-300">{feature.text}</p>
                </div>
              </article>
            )
          })}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
            <Smartphone className="h-5 w-5 text-emerald-300" />
            <p className="mt-3 text-xs text-slate-300">Cihaz eşleştirme</p>
            <p className="text-lg font-black">Aktif</p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
            <RefreshCw className="h-5 w-5 text-amber-300" />
            <p className="mt-3 text-xs text-slate-300">Offline senkron</p>
            <p className="text-lg font-black">Hazır</p>
          </div>
        </section>

        <footer className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 font-bold text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            Mağaza uyumluluğu
          </div>
          <p className="mt-2 leading-5">Gizlilik politikası, veri silme, destek ve sistem durumu sayfaları uygulama içinden erişilebilir.</p>
        </footer>
      </section>
    </main>
  )
}
