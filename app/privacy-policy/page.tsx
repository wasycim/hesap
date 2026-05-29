import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gizlilik Politikası | Hesap",
  description: "Hesap iOS, Android, masaüstü ve web uygulamaları için gizlilik politikası.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-10 text-slate-900 dark:text-slate-100">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Hesap</p>
        <h1 className="text-3xl font-bold tracking-normal">Gizlilik Politikası</h1>
        <p className="text-sm text-muted-foreground">Son güncelleme: 29 Mayıs 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Toplanan Veriler</h2>
        <p>
          Hesap; şube yönetimi, finansal raporlama, personel mesai takibi ve QR ile giriş çıkış işlemleri için gerekli
          olan hesap, personel, şube, vardiya, maaş, mesai, güvenlik olayı ve rapor verilerini işler.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Kimlik ve hesap bilgileri: ad soyad, görünen ad, TC kimlik numarası, e-posta, rol ve şube bilgisi.</li>
          <li>Mesai bilgileri: QR okutma zamanı, giriş çıkış saati, vardiya, geç kalma ve fazla mesai süreleri.</li>
          <li>Finansal kayıtlar: gelir, gider, maaş, avans, cari ve rapor kayıtları.</li>
          <li>Cihaz verileri: push bildirim tokeni, uygulama açılış zamanı, bağlantı durumu ve hata bilgileri.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Kamera ve Bildirim İzinleri</h2>
        <p>
          Kamera izni yalnızca terminal QR kodunu okutmak için kullanılır. Görüntü kaydı yapılmaz ve kamera görüntüsü
          sunucuya gönderilmez. Bildirim izni mesai, rapor ve güvenlik hatırlatmaları göndermek için istenir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Veri İşleme Amacı</h2>
        <p>
          Veriler; kullanıcı doğrulama, yetki kontrolü, şube bazlı raporlama, personel mesai takibi, maaş hesabı,
          güvenlik denetimi ve yasal/operasyonel kayıt ihtiyacı için kullanılır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Paylaşım ve Saklama</h2>
        <p>
          Veriler yetkili şirket kullanıcıları dışında üçüncü kişilerle satılmaz. Uygulama Supabase/PostgreSQL ve Vercel
          altyapısı üzerinde çalışır. Veriler iş ihtiyacı devam ettiği sürece saklanır; silme veya düzeltme talepleri
          yetkili yönetici tarafından değerlendirilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Güvenlik</h2>
        <p>
          Uygulamada JWT tabanlı oturum, HTTP-only cookie, bcrypt şifre özeti, yetkili route kontrolleri ve Supabase
          RLS politikaları kullanılır. QR tokenleri süreli ve doğrulamalıdır.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Haklar ve İletişim</h2>
        <p>
          Verilerinize ilişkin erişim, düzeltme veya silme talepleri için şirket yöneticinizle ya da uygulama sahibiyle
          iletişime geçebilirsiniz.
        </p>
        <p className="rounded-lg border bg-muted/40 p-4 text-sm">
          İletişim: <a className="font-semibold text-emerald-600" href="mailto:destek@pamukkaleturizm.info">destek@pamukkaleturizm.info</a>
        </p>
      </section>
    </main>
  )
}
