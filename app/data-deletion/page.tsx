import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Veri Silme Talebi | Hesap",
  description: "Hesap uygulaması için kullanıcı verisi silme ve düzeltme talep süreci.",
}

export default function DataDeletionPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-5 py-10 text-slate-900 dark:text-slate-100">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Hesap</p>
        <h1 className="text-3xl font-bold tracking-normal">Veri Silme Talebi</h1>
        <p className="text-sm text-muted-foreground">Son güncelleme: 29 Mayıs 2026</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Talep Kapsamı</h2>
        <p>
          Hesap uygulamasında kullanıcı hesapları kurum yöneticileri tarafından oluşturulur ve yönetilir. Kullanıcılar;
          hesap, personel, mesai, vardiya, maaş ve rapor verilerinin düzeltilmesi ya da silinmesi için kurum yöneticisine
          veya uygulama destek adresine başvurabilir.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Nasıl Talep Edilir?</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Ad soyad, TC kimlik numaranız ve bağlı olduğunuz şube bilgisiyle destek adresine yazın.</li>
          <li>Talebin silme, düzeltme veya erişim talebi olduğunu açıkça belirtin.</li>
          <li>Yetkili yönetici talebi doğrular ve yasal/operasyonel saklama zorunluluğu yoksa işlem yapar.</li>
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Saklama Notu</h2>
        <p>
          Finansal kayıtlar, mesai kayıtları ve yasal raporlama kapsamındaki bazı veriler mevzuat veya şirket içi denetim
          ihtiyacı nedeniyle belirli sürelerle saklanabilir. Bu durumda kullanıcı hesabı pasifleştirilir, gereksiz erişim
          kaldırılır ve saklama süresi bittiğinde kayıtlar silinir.
        </p>
      </section>

      <p className="rounded-lg border bg-muted/40 p-4 text-sm">
        İletişim: <a className="font-semibold text-emerald-600" href="mailto:destek@pamukkaleturizm.info">destek@pamukkaleturizm.info</a>
      </p>
    </main>
  )
}
