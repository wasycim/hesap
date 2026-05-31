import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Mobil Uygulama Destek | Hesap",
  description: "Hesap mobil uygulaması destek, gizlilik, veri silme ve mağaza bilgileri.",
}

export default function MobileSupportPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Hesap Mobil</p>
        <h1 className="text-3xl font-bold tracking-normal">Destek</h1>
        <p className="text-muted-foreground">
          iOS ve Android uygulaması için destek, gizlilik ve yayın bilgileri.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="/privacy-policy">
          <h2 className="font-semibold">Gizlilik Politikası</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mağaza ve kullanıcı gizlilik metni.</p>
        </a>
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="/data-deletion">
          <h2 className="font-semibold">Veri Silme Talebi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Hesap ve veri silme/düzeltme süreci.</p>
        </a>
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="/status">
          <h2 className="font-semibold">Sistem Durumu</h2>
          <p className="mt-1 text-sm text-muted-foreground">Web, veritabanı ve Supabase canlı durum kontrolü.</p>
        </a>
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="/mobile-native">
          <h2 className="font-semibold">Native Özellikler</h2>
          <p className="mt-1 text-sm text-muted-foreground">Push, offline, kamera, PDF ve cihaz entegrasyonları.</p>
        </a>
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="/store-screenshots">
          <h2 className="font-semibold">Mağaza Ekranları</h2>
          <p className="mt-1 text-sm text-muted-foreground">App Store ve Play Store ekran görüntüsü hazırlama sayfası.</p>
        </a>
        <a className="rounded-xl border p-4 transition hover:border-emerald-500" href="mailto:destek@pamukkaleturizm.info">
          <h2 className="font-semibold">Destek E-postası</h2>
          <p className="mt-1 text-sm text-muted-foreground">destek@pamukkaleturizm.info</p>
        </a>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Uygulama Özellikleri</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
          <li>Native alt menü ile dashboard, mesai, takip, vardiya ve maaş ekranlarına hızlı geçiş.</li>
          <li>İnternet yokken uygulama içi offline ekran ve yeniden yükleme akışı.</li>
          <li>Bağlantı geri geldiğinde bekleyen güvenlik kayıtlarını otomatik senkronize etme.</li>
          <li>Push bildirim ve yerel bildirim altyapısı.</li>
          <li>PDF raporları mobil yazdır/paylaş ekranından PDF olarak kaydetme.</li>
          <li>Kamera ile terminal QR okutma.</li>
          <li>Haptic geri bildirim ve native durum çubuğu/splash ekranı.</li>
          <li>TC ile şifre sıfırlama bağlantısı gönderme ve e-postadan yeni şifre belirleme.</li>
        </ul>
      </section>
    </main>
  )
}
