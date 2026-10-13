import type { Metadata } from "next"
import { BellRing, CalendarDays, Camera, Download, HeartPulse, ShieldCheck, WifiOff } from "lucide-react"

export const metadata: Metadata = {
  title: "Store Screenshots | Hesap",
  description: "Hesap App Store ve Play Store ekran görüntüsü hazırlama alanı.",
}

const screens = [
  {
    title: "Native Ana Ekran",
    label: "Mesai ve raporlar tek yerde",
    color: "from-slate-950 to-emerald-950",
    icon: ShieldCheck,
    body: [
      ["Aktif personel", "12"],
      ["Açık mesai", "2"],
      ["Net fazla", "8 sa"],
    ],
  },
  {
    title: "QR Mesai",
    label: "Terminal QR ile güvenli giriş çıkış",
    color: "from-slate-950 to-amber-950",
    icon: Camera,
    body: [
      ["Terminal", "Onaylı"],
      ["QR değişimi", "30 sn"],
      ["Kamera", "Aktif"],
    ],
  },
  {
    title: "Offline Mod",
    label: "Bağlantı yokken kontrollü ekran",
    color: "from-slate-950 to-rose-950",
    icon: WifiOff,
    body: [
      ["Bağlantı", "Yok"],
      ["Yeniden yükle", "Hazır"],
      ["Senkron", "Bekliyor"],
    ],
  },
  {
    title: "Bildirimler",
    label: "Geç kalma ve fazla mesai uyarıları",
    color: "from-slate-950 to-sky-950",
    icon: BellRing,
    body: [
      ["Push", "FCM"],
      ["Yerel bildirim", "Aktif"],
      ["Özet mail", "Günlük"],
    ],
  },
  {
    title: "Vardiya",
    label: "Çakışmasız planlama takvimi",
    color: "from-slate-950 to-violet-950",
    icon: CalendarDays,
    body: [
      ["Sabah", "06:00-16:00"],
      ["Akşam", "16:00-02:00"],
      ["Ara", "11:00-21:00"],
    ],
  },
  {
    title: "Sistem Durumu",
    label: "Sağlık ve denetim kayıtları",
    color: "from-slate-950 to-cyan-950",
    icon: HeartPulse,
    body: [
      ["Web", "Çalışıyor"],
      ["DB", "Çalışıyor"],
      ["Log", "Aktif"],
    ],
  },
]

export default function StoreScreenshotsPage() {
  return (
    <main className="min-h-screen bg-[#f3f7fb] px-8 py-10 text-slate-950">
      <header className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <img src="/iconw.png" alt="Hesap" className="h-12 w-12 object-contain drop-shadow" />
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Wasy Systems</p>
            <h1 className="text-3xl font-black tracking-normal">Hesap mobil mağaza ekranları</h1>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-8 grid max-w-7xl gap-8 lg:grid-cols-3">
        {screens.map((screen) => {
          const Icon = screen.icon
          return (
            <article key={screen.title} className="mx-auto w-[320px] rounded-[42px] bg-slate-950 p-3 shadow-2xl shadow-slate-400/40">
              <div className={`min-h-[620px] rounded-[34px] bg-gradient-to-br ${screen.color} p-5 text-white`}>
                <div className="mx-auto mb-5 h-1.5 w-24 rounded-full bg-white/18" />
                <div className="flex items-center justify-between gap-3">
                  <img src="/iconw.png" alt="" className="h-11 w-11 object-contain" />
                  <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black">Hesap</span>
                </div>
                <div className="mt-9">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-slate-950">
                    <Icon className="h-7 w-7" />
                  </div>
                  <p className="mt-6 text-sm font-bold uppercase tracking-wide text-emerald-200">{screen.label}</p>
                  <h2 className="mt-2 text-3xl font-black tracking-normal">{screen.title}</h2>
                </div>

                <div className="mt-8 space-y-3">
                  {screen.body.map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
                      <span className="text-sm text-slate-300">{label}</span>
                      <span className="font-black">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-3xl bg-white p-4 text-slate-950">
                  <div className="flex items-center gap-3">
                    <Download className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="text-sm font-black">PDF ve rapor hazır</p>
                      <p className="text-xs text-slate-500">Mobil paylaşım akışına uygun</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}
