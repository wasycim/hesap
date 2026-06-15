# Hesap Rapor Sistemi

<p align="center">
  <img src="public/iconw.png" alt="Hesap W logosu" width="150" />
</p>

<p align="center">
  <strong>Gelir, gider, kargo cari, vardiya, QR mesai, maaş, bildirim, lisans ve yedeklemeyi tek panelde birleştiren production odaklı işletme yönetim sistemi.</strong>
</p>

<p align="center">
  <a href="https://github.com/wasycim/hesap"><img alt="GitHub repo" src="https://img.shields.io/badge/repo-wasycim%2Fhesap-111827?style=for-the-badge&logo=github" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-2.0.1-10B981?style=for-the-badge" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=nextdotjs" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Windows-EXE-47848F?style=for-the-badge&logo=electron&logoColor=white" />
  <img alt="Repo views" src="https://komarev.com/ghpvc/?username=wasycim-hesap&style=for-the-badge&color=10b981&label=views" />
</p>

<p align="center">
  <a href="https://pamukkaleturizm.info">Production</a>
  ·
  <a href="https://pamukkaleturizm.info/status">Sistem Durumu</a>
  ·
  <a href="https://github.com/wasycim/hesap/releases/latest">Windows Sürümü</a>
  ·
  <a href="LICENSE.md">Lisans</a>
</p>

## İçindekiler

- [Özet](#özet)
- [Ekran Görselleri](#ekran-görselleri)
- [Son Güncellemeler](#son-güncellemeler)
- [Mimari](#mimari)
- [Teknoloji Stack](#teknoloji-stack)
- [Ana Modüller](#ana-modüller)
- [Rol ve Yetki Sistemi](#rol-ve-yetki-sistemi)
- [Mesai Sistemi](#mesai-sistemi)
- [Kargo Cari](#kargo-cari)
- [Offline Çalışma](#offline-çalışma)
- [Yedekleme](#yedekleme)
- [Windows EXE](#windows-exe)
- [Android ve iOS](#android-ve-ios)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı Scriptleri](#veritabanı-scriptleri)
- [Komutlar](#komutlar)
- [Rotalar](#rotalar)
- [Production Kontrol Listesi](#production-kontrol-listesi)
- [Lisans](#lisans)

## Özet

Hesap Rapor Sistemi; şube bazlı finans takibi, QR destekli personel mesaisi, vardiya planlama, maaş hesaplama, kargo cari takibi, PDF raporlama, push bildirim, cihaz lisansı, offline işlem kuyruğu ve günlük yedeklemeyi tek uygulamada toplar.

Sistem web, Windows EXE ve mobil uygulama katmanlarında aynı iş mantığını kullanır. Amaç; işletme kayıtlarını tek yerden yönetmek, mesai/maaş tarafında hatayı azaltmak, bağlantı kesilse bile veri kaybetmemek ve kritik durumları görünür hale getirmektir.

## Ekran Görselleri

<details>
  <summary><strong>Store ve mobil hazırlık ekranları</strong></summary>
  <br />
  <p align="center">
    <img src="docs/store-screenshots/store-screenshots-overview.png" alt="Hesap store ekran görüntüleri" width="860" />
  </p>
</details>

<details>
  <summary><strong>Native mobil ekranlar</strong></summary>
  <br />
  <p align="center">
    <img src="docs/store-screenshots/mobile-native-phone.png" alt="Hesap native mobil ekran" width="320" />
    <img src="docs/store-screenshots/mobile-support-phone.png" alt="Hesap mobil destek ekranı" width="320" />
  </p>
</details>

## Son Güncellemeler

- Gelir ve gider tablolarında satırlar yeni tarihten eski tarihe sıralanır.
- Sistem ay başlangıcı Ocak 2026 olarak geri açıldı.
- Türkçe büyük harf dönüşümleri `toLocaleUpperCase("tr-TR")` ile düzeltildi.
- Kargo cari borç özetine ödeme listesi eklendi.
- Ödeme listesine tarih, firma, toplam borç, ödenen borç, kalan borç ve not alanları eklendi.
- Kargo firma detayına aylık firma notları eklendi.
- Firma notları PDF raporuna dahil edildi.
- Kargo cari firma detayında yönetici satır tarihini elle değiştirebilir.
- Ahmet Şömine Excel karşılığı sistemde `AHMET SEYREK ŞÖMİNE` olarak eşleştirildi.
- Kesir Mühendislik ve Nokta Denizcilik Haziran 2026 kargo kayıtları sisteme işlendi.
- Sistem genelindeki native `date` alanları modern takvim bileşenine taşındı.
- Kargo cari notları günlük yedekleme kapsamına alındı.

## Mimari

```mermaid
flowchart LR
  PERSONEL["Personel"] --> WEB["Next.js Web App"]
  ADMIN["Yönetici"] --> WEB
  DEV["Developer"] --> WEB

  WEB --> API["Next.js API Routes"]
  API --> SUPA["Supabase Auth + PostgreSQL"]
  API --> PRISMA["Prisma Mesai DB"]
  API --> SMTP["Zoho SMTP"]
  API --> FCM["Firebase Cloud Messaging"]
  API --> R2["Cloudflare R2 Backup"]

  WEB --> SW["Service Worker + Offline Queue"]
  DESKTOP["Windows EXE / Electron"] --> WEB
  ANDROID["Android / Capacitor"] --> WEB
  IOS["iOS / Capacitor"] --> WEB

  VPS["VPS Backup Worker"] --> SUPA
  VPS --> R2
  VPS --> FAILOVER["Failover PostgreSQL"]
```

## Teknoloji Stack

| Katman | Teknoloji |
| --- | --- |
| Frontend | Next.js 15 App Router, React, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Prisma, Supabase |
| Database | PostgreSQL, Supabase Auth |
| Auth | JWT, Supabase session, bcrypt password hash |
| QR Mesai | Dinamik terminal QR, token doğrulama |
| PDF | Browser print, Electron native PDF bridge |
| Bildirim | Firebase Cloud Messaging, web notification, Windows badge |
| Desktop | Electron, electron-updater, NSIS |
| Mobile | Capacitor Android/iOS |
| Offline | Service Worker, IndexedDB/local queue, cached API |
| Backup | Cloudflare R2, VPS worker, failover PostgreSQL |
| Deploy | Vercel, GitHub Releases |

## Ana Modüller

| Modül | Açıklama |
| --- | --- |
| Dashboard | Şube bazlı ana operasyon ekranı. |
| Gelir | Gelir kayıtları, firma sütunları, PDF ve offline queue. |
| Gider | Gider kalemleri, personel payları, avanslar, PDF ve offline queue. |
| Çorbalar | Günlük ürün/çorba kayıtları. |
| Kargo Cari | Firma bazlı cari kayıt, ödeme hareketleri ve firma notları. |
| Vardiya | Günlük, haftalık, aylık ve özel aralıklı vardiya planlama. |
| Mesai | Personelin QR okutarak giriş/çıkış yaptığı ekran. |
| Mesai Takip | Giriş/çıkış detayları, fazla mesai, onay/red ve manuel mesai. |
| Maaşlar | Maaş, avans ve onaylı fazla mesai hesapları. |
| Bildirim Gönder | Yönetici bildirim paneli. |
| Mail İşlemleri | Günlük/haftalık rapor alıcıları, PDF/HTML ayarları. |
| Lisanslar | PC, web ve mobil cihaz lisans kontrolü. |
| Sistem Sağlığı | Supabase, SMTP, FCM, backup ve deploy kontrolleri. |
| Gelişmiş Log | Developer rolüne özel denetim kayıtları. |
| Operasyon Merkezi | Feature flag, izin ve sistem yönetimi. |

## Rol ve Yetki Sistemi

| Rol | Yetki |
| --- | --- |
| Personel | Kendi mesaisi, kendi şubesi için izin verilen ekranlar, hesap ayarları. |
| Yönetici | Şube operasyonları, mesai takip, vardiya, maaş, admin ayarları. |
| Developer | Yönetici üstü yetkiler, sistem sağlığı, gelişmiş log, operasyon merkezi. |

Kurallar:

- Yönetici developer hesabı oluşturamaz.
- Yönetici developer ekranlarını göremez.
- Developer yetki matrisini ve kritik sistem ayarlarını yönetebilir.
- Kullanıcı bazlı görünürlük ve işlem izinleri operasyon merkezinden ayarlanabilir.

## Mesai Sistemi

Personel akışı:

1. Personel `/auth/giris` üzerinden TC kimlik no ve şifre ile giriş yapar.
2. Sadece mesai yetkisi varsa doğrudan QR okutma ekranına yönlendirilir.
3. Personel kendi cihaz kamerasıyla sabit terminaldeki QR kodu okutur.
4. Açık mesai yoksa giriş, açık mesai varsa çıkış kaydı oluşur.
5. İşlem tamamlandıktan sonra kamera kapatılır.

Mesai kuralları:

- Terminal QR belirli aralıklarla yenilenir.
- QR token doğrulanmadan giriş/çıkış yapılmaz.
- Fazla mesai maaşa doğrudan yazılmaz; yönetici onayı gerekir.
- Red işleminde neden kaydedilir.
- Onaylanan veya reddedilen kayıt tekrar serbestçe değiştirilemez.
- Parçalı çalışmalarda günün ilk girişi ve son çıkışı esas alınır.

Fazla mesai yuvarlama:

| Gerçek fazla mesai | Maaşa işlenecek |
| --- | --- |
| 0-44 dk | 0 saat |
| 45-59 dk | 1 saat |
| 1 sa 00 dk - 1 sa 44 dk | 1 saat |
| 1 sa 45 dk - 1 sa 59 dk | 2 saat |

## Kargo Cari

Kargo cari modülü firma bazlı kayıtları yönetir:

- Aylık veya tüm zaman borç özeti.
- Firma detayında tarih, fiş no, gönderilen yer, alınan tutar, satılan tutar ve kalan kar.
- Yönetici için satır tarihini elle düzeltme.
- Fiş numarasında 6 haneli standart format.
- Türkçe büyük harf desteği.
- Ödeme listesi ve not alanı.
- Aylık firma notları.
- Firma notlarının PDF raporuna eklenmesi.

Kargo veri import notları:

- `AHMET ŞÖMİNE` Excel sayfası sistemde `AHMET SEYREK ŞÖMİNE` firmasına eşlenir.
- Haziran 2026 importlarında kayıtlı veriler korunur; yeni satırlar ek olarak işlenir.
- Nokta Denizcilik ve Kesir Mühendislik Haziran kayıtları normalize edilmiştir.

## Offline Çalışma

Offline katman web, Windows EXE ve mobil uygulamalar için tasarlanmıştır.

- Uygulama shell dosyaları cache edilir.
- Kritik GET cevapları son başarılı veri olarak saklanır.
- Sol menü ve yetkiler son başarılı kullanıcı cache'iyle görünür kalır.
- Güvenli kayıt işlemleri offline queue'ya alınır.
- İnternet geldiğinde kuyruk otomatik senkronize olur.
- Senkron tamamlanınca kullanıcıya sistemin güncellendiği bildirilir.

İlk kez açılmamış bir sayfanın offline çalışması için önce online durumda en az bir kez yüklenmesi gerekir.

## Yedekleme

Production yedekleme katmanları:

1. Supabase PostgreSQL ana veritabanı.
2. Cloudflare R2 günlük backup dosyaları.
3. VPS üzerinde failover PostgreSQL restore alanı.

Backup kapsamı gelir, gider, çorbalar, kargo cari, ödeme hareketleri, firma notları, vardiya, mesai, maaş, bildirim, lisans ve sistem tablolarını kapsayacak şekilde genişletilir.

## Windows EXE

Windows uygulaması Electron ile paketlenir.

Özellikler:

- W logosu ile uygulama ve installer ikonu.
- `wasy.system.hesap` app id.
- GitHub Releases üzerinden auto-update.
- Uygulama içi güncelleme kontrolü.
- Native PDF kaydetme köprüsü.
- Taskbar badge desteği.
- Offline queue ve online/offline durum göstergesi.

Build:

```bash
npm run desktop:dist
```

Publish:

```bash
npm run desktop:publish
```

## Android ve iOS

Mobil uygulama Capacitor ile hazırlanır.

Native yetenekler:

- Push Notifications
- Local Notifications
- Network status
- Preferences
- Haptics
- Splash Screen
- Status Bar
- Native destek ekranları
- PDF indirme/yazdırma akışı

Android:

```bash
npm run mobile:sync
npm run mobile:open:android
```

iOS:

```bash
npm run mobile:sync
npm run mobile:open:ios
```

iOS build için Mac veya Codemagic gibi bulut Mac gerekir. App Store/TestFlight yayını için Apple Developer hesabı zorunludur.

## Kurulum

```bash
git clone https://github.com/wasycim/hesap.git
cd hesap
npm install
```

Geliştirme:

```bash
npm run dev
```

Production:

```bash
npm run build
npm run start
```

## Ortam Değişkenleri

`.env.local` örneği:

```env
NEXT_PUBLIC_SITE_URL=https://pamukkaleturizm.info
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ACCESS_TOKEN=...
SUPABASE_PROJECT_REF=...

DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
FAILOVER_DATABASE_URL=postgresql://...

JWT_SECRET=change-me
QR_SECRET=change-me

SMTP_HOST=smtp.zoho.eu
SMTP_PORT=587
SMTP_USER=system@pamukkaleturizm.tr
SMTP_PASS=...
SMTP_FROM="Hesap <system@pamukkaleturizm.tr>"

FCM_PROJECT_ID=...
FCM_CLIENT_EMAIL=...
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=hesap-backups

VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...
VERCEL_TOKEN=...
```

Güvenlik:

- Gerçek secret değerleri README'ye yazılmaz.
- SMTP şifresi, Supabase service role key, FCM private key ve R2 secret key commit edilmez.
- Production secret'ları Vercel, Supabase, VPS env veya yerel `.secrets` altında saklanır.

## Veritabanı Scriptleri

Öne çıkan scriptler:

| Script | Amaç |
| --- | --- |
| `scripts/019_kargo_cari_payment_history.sql` | Kargo cari ödeme hareketleri ve not alanı. |
| `scripts/020_kargo_cari_firma_notlari.sql` | Aylık firma notları tablosu ve RLS politikaları. |

Prisma:

```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

Supabase operasyon şemaları:

```bash
npm run supabase:system-schema
npm run supabase:push-audit-schema
npm run supabase:notification-rules-schema
npm run supabase:advanced-ops-schema
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Local Next.js geliştirme sunucusu |
| `npm run build` | Prisma generate + Next production build |
| `npx tsc --noEmit` | TypeScript kontrolü |
| `npm run desktop:dev` | Electron geliştirme modu |
| `npm run desktop:dist` | Windows NSIS installer üretir |
| `npm run desktop:publish` | GitHub Releases publish akışı |
| `npm run mobile:sync` | Capacitor asset ve native sync |
| `npm run mobile:open:android` | Android Studio projesini açar |
| `npm run mobile:open:ios` | iOS native projeyi açar |

## Rotalar

| Rota | Amaç |
| --- | --- |
| `/` | Oturuma göre yönlendirme |
| `/auth/giris` | Ana giriş ekranı |
| `/auth/sifremi-unuttum` | TC ile şifre sıfırlama maili |
| `/terminal` | Sabit terminal QR ekranı |
| `/mesai-qr` | Personel kamera ile QR okutma ekranı |
| `/dashboard` | Ana panel |
| `/dashboard/gelir` | Gelir tablosu |
| `/dashboard/gider` | Gider tablosu |
| `/dashboard/corbalar` | Çorba takibi |
| `/dashboard/kargo-cari` | Cari hesap takibi |
| `/dashboard/vardiya` | Vardiya planlama |
| `/dashboard/mesai-takip` | Mesai takip ve onay ekranı |
| `/dashboard/maaslar` | Maaş, avans ve onaylı mesai |
| `/dashboard/mail-islemleri` | Rapor mail ayarları |
| `/dashboard/lisanslar` | Lisanslı cihazlar |
| `/dashboard/sistem-sagligi` | Sistem sağlık paneli |
| `/dashboard/gelismis-log` | Developer gelişmiş log |
| `/dashboard/operasyon` | Developer operasyon merkezi |
| `/status` | Public sistem durumu |
| `/privacy-policy` | Gizlilik politikası |
| `/data-deletion` | Veri silme açıklaması |

## Production Kontrol Listesi

- [ ] `/auth/giris` production domainde çalışıyor.
- [ ] Supabase Auth redirect URL production domaini gösteriyor.
- [ ] Şifre sıfırlama maili Türkçe ve production link üretiyor.
- [ ] Supabase RLS kritik tablolar için aktif.
- [ ] SMTP test maili başarılı.
- [ ] FCM cihaz token kaydı ve test push başarılı.
- [ ] `/status` public durum sayfası çalışıyor.
- [ ] Mesai onayı olmadan fazla mesai maaşa yansımıyor.
- [ ] Mesai reddinde red nedeni zorunlu.
- [ ] Aynı personele aynı gün çift vardiya atanamıyor.
- [ ] Gelir/gider/kargo cari ekranları online açıldıktan sonra offline cache ile açılıyor.
- [ ] Offline queue internet gelince senkronize oluyor.
- [ ] Windows EXE auto-update `latest.yml` üzerinden son sürümü görüyor.
- [ ] Cloudflare R2 günlük backup dosyası oluşuyor.
- [ ] VPS backup timer aktif.
- [ ] Failover PostgreSQL son yedeği restore edebiliyor.

## Lisans

Bu proje public depoda görüntülenebilir; ancak açık kaynak değildir.

Kod, installer, APK, iOS paketi, veritabanı şeması, logo, marka varlıkları ve sistem tasarımı Wasy Systems izni olmadan satılamaz, kopyalanamaz, dağıtılamaz veya yeniden yayınlanamaz.

Detaylar için: [`LICENSE.md`](LICENSE.md)
