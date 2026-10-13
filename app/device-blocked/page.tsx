import { ShieldAlert } from "lucide-react"

export default function DeviceBlockedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-slate-950 px-4 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-red-400/20 bg-white/[0.05] p-8 text-center shadow-2xl shadow-black/30">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-500 text-white">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-normal">Cihaz yetkisi iptal edildi</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          Bu PC veya telefon artik bu hesaba bagli lisansli cihazlar arasinda degil. Yeniden acmak icin developer yetkili kullanici cihaz lisansini aktif etmelidir.
        </p>
      </section>
    </main>
  )
}
