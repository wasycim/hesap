# Hesap Rapor Sistemi

<p align="center">
  <img src="public/iconw.png" alt="Hesap W logosu" width="138" />
</p>

<p align="center">
  <strong>Gelir, gider, vardiya, QR mesai, maaş, bildirim, cihaz lisansı ve yedeklemeyi tek panelde birleştiren production odaklı işletme yönetim sistemi.</strong>
</p>

<p align="center">
  <a href="https://github.com/wasycim/hesap"><img alt="GitHub repo" src="https://img.shields.io/badge/repo-wasycim%2Fhesap-111827?style=for-the-badge&logo=github" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.13-10B981?style=for-the-badge" />
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-App%20Router-000000?style=for-the-badge&logo=nextdotjs" />
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
  <a href="https://github.com/wasycim/hesap/releases/latest">Son Windows Sürümü</a>
  ·
  <a href="LICENSE.md">Lisans</a>
</p>

## İçindekiler

- [Özet](#özet)
- [Ekran Görselleri](#ekran-görselleri)
- [Sistem Mantığı](#sistem-mantığı)
- [Mimari](#mimari)
- [Teknoloji Stack](#teknoloji-stack)
- [Ana Modüller](#ana-modüller)
- [Rol ve Yetki Sistemi](#rol-ve-yetki-sistemi)
- [Mesai Akışı](#mesai-akışı)
- [Vardiya ve Mesai Hesabı](#vardiya-ve-mesai-hesabı)
- [Maaş ve Fazla Mesai](#maaş-ve-fazla-mesai)
- [Bildirim Sistemi](#bildirim-sistemi)
- [Offline Çalışma](#offline-çalışma)
- [Yedekleme ve Failover](#yedekleme-ve-failover)
- [Cihaz Lisansı](#cihaz-lisansı)
- [Windows EXE](#windows-exe)
- [Android ve iOS](#android-ve-ios)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı ve Scriptler](#veritabanı-ve-scriptler)
- [Komutlar](#komutlar)
- [Rotalar](#rotalar)
- [Production Kontrol Listesi](#production-kontrol-listesi)
- [Sorun Giderme](#sorun-giderme)
- [Lisans](#lisans)

## Özet

Hesap Rapor Sistemi; şube bazlı finans takibi, QR destekli personel mesaisi, vardiya planlama, maaş hesaplama, PDF raporlama, push bildirim, cihaz lisansı, offline işlem kuyruğu ve günlük yedeklemeyi tek uygulamada toplar.

Sistem web, Windows EXE ve Android/iOS kabuklarında aynı iş mantığını kullanır. Ana hedef; işletme operasyonlarını tek yerden yönetmek, mesai ve maaş tarafında hatayı azaltmak, bağlantı kesilse bile veriyi kaybetmemek ve kritik durumları görünür hale getirmektir.

## Ekran Görselleri

<details>
  <summary><strong>Mobil ve store hazırlık ekranları</strong></summary>
  <br />
  <p align="center">
    <img src="docs/store-screenshots/store-screenshots-overview.png" alt="Hesap store ekran görüntüleri" width="860" />
  </p>
</details>

<details>
  <summary><strong>Native mobil destek ekranları</strong></summary>
  <br />
  <p align="center">
    <img src="docs/store-screenshots/mobile-native-phone.png" alt="Hesap native mobil ekran" width="320" />
    <img src="docs/store-screenshots/mobile-support-phone.png" alt="Hesap mobil destek ekranı" width="320" />
  </p>
</details>

## Sistem Mantığı

Temel kullanım akışı:

1. Kullanıcı `/auth/giris` üzerinden TC kimlik no ve şifre ile giriş yapar.
2. Kullanıcı yalnızca mesai yetkisine sahipse otomatik mesai QR ekranına yönlendirilir.
3. Dashboard yetkisi varsa menüden finans, vardiya, mesai takip, maaş ve yönetim ekranlarına erişir.
4. Personel, sabit `/terminal` ekranında sürekli değişen QR kodu kendi cihaz kamerasıyla okutur.
5. Açık mesaisi yoksa giriş kaydı, açık mesaisi varsa çıkış kaydı oluşturulur.
6. Fazla mesai maaşa otomatik yazılmaz; önce yönetici onayı gerekir.
7. Offline durumda güvenli işlemler yerel kuyruğa alınır ve internet gelince senkronize edilir.
8. Günlük yedekleme Cloudflare R2 ve failover PostgreSQL tarafına işlenir.

## Mimari

```mermaid
flowchart LR
  PERSONEL["Personel"] --> WEB["Next.js Web App"]
  ADMIN["Yönetici"] --> WEB
  DEV["Developer"] --> WEB

  WEB --> API["Next.js API Routes"]
  API --> SUPA["Supabase Auth + PostgreSQL"]
  API --> PRISMA["Prisma Attendance DB"]
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
| Frontend | Next.js App Router, React, TypeScript, TailwindCSS |
| Backend | Next.js API Routes, Prisma, Supabase |
| Database | PostgreSQL, Supabase Auth |
| Auth | JWT, Supabase session, bcrypt password hash |
| Mesai QR | Dinamik terminal QR, QR token doğrulama |
| PDF | Browser print, native Electron PDF save bridge |
| Bildirim | Firebase Cloud Messaging, web notification, Windows badge |
| Desktop | Electron, electron-updater, NSIS installer |
| Mobile | Capacitor Android/iOS |
| Offline | Service Worker, IndexedDB/local queue, cached API responses |
| Backup | Cloudflare R2, VPS worker, failover PostgreSQL |
| Deploy | Vercel, GitHub Releases |

## Ana Modüller

| Modül | Açıklama |
| --- | --- |
| Dashboard | Şube bazlı operasyon ana ekranı. |
| Gelir | Gelir kayıtları, firma sütunları, PDF ve offline queue desteği. |
| Gider | Gider kalemleri, personel payları, avanslar, PDF ve offline queue desteği. |
| Çorbalar | Günlük ürün/çorba kayıtları. |
| Kargo Cari | Firma bazlı cari borç/alacak takibi. |
| Vardiya | Günlük, haftalık, aylık ve tarih aralıklı vardiya planlama. |
| Mesai | Personelin QR okutarak giriş/çıkış yaptığı ekran. |
| Mesai Takip | Giriş/çıkış detayları, geç kalma, fazla mesai, onay/red ve manuel mesai. |
| Maaşlar | Maaş, avans ve yalnızca onaylanmış fazla mesai hesapları. |
| Bildirim Gönder | Yönetici tarafından kullanıcı/şube bazlı bildirim gönderimi. |
| Mail İşlemleri | Günlük/haftalık rapor alıcıları, rol hedefleri, PDF/HTML ekleri ve detay seviyesi. |
| Çay | Developer tarafından aktif edilirse seçili kullanıcıya çay durumu bildirimi. |
| Duyurular | Tarih aralıklı veya sürekli gösterilen duyuru yönetimi. |
| Lisanslar | PC, web ve mobil cihaz lisansları, arama/filtreli sade kart arayüzü ve uzaktan iptal. |
| Sistem Sağlığı | Supabase, SMTP, FCM, backup, failover ve deploy kontrolleri. |
| Gelişmiş Log | Developer rolüne özel denetim ve güvenlik kayıtları. |
| Log Backup | Gelişmiş logları indirme, yükleme ve silme yönetimi. |
| Operasyon Merkezi | Developer özellik bayrakları, izinler ve kritik sistem ayarları. |

## Rol ve Yetki Sistemi

| Rol | Ne Görebilir? | Ne Yapabilir? |
| --- | --- | --- |
| Personel | Kendi mesaisi, kendi şubesi için izin verilen vardiyalar, hesap ayarları | Mesai giriş/çıkış, kendi bildirimleri, tema tercihi |
| Yönetici | Şube operasyonları, mesai takip, vardiya, maaş, admin ayarları | Personel/yetki yönetimi, mesai onayı, bildirim gönderimi, PDF rapor |
| Developer | Yönetici üstü tüm kritik ekranlar | Gelişmiş log, sistem sağlığı, operasyon merkezi, rol/izin matrisi, log backup |

Önemli kurallar:

- Yönetici, developer hesabı oluşturamaz.
- Yönetici, developer’a özel gelişmiş log ve sistem operasyonlarını göremez.
- Developer, yönetici ve developer hesapları dahil tüm yetki matrisini yönetebilir.
- Kullanıcı bazlı görünürlük ve işlem izinleri Operasyon Merkezi üzerinden ayarlanabilir.

## Mesai Akışı

Mesai sistemi kullanıcı tarafında çok basit tutulur:

1. Personel TC kimlik no ve şifre ile giriş yapar.
2. Karşısına kamera ekranı çıkar.
3. Personel kendi cihaz kamerasıyla sabit terminaldeki QR kodu okutur.
4. Terminal QR kodu belirli aralıklarla yenilenir.
5. QR token doğrulanır.
6. Açık mesai yoksa `check-in`, açık mesai varsa `check-out` yapılır.
7. İşlem sonrası kamera kapanır ve kullanıcıya sonuç gösterilir.

Terminal tarafı:

- `/terminal` sabit ekranda tam ekran çalışır.
- QR sürekli yenilenir.
- QR içinde güvenli token bulunur.
- Telefonun kendi QR okuyucusuyla okutma için `/mesai-qr/okut?t=...` bağlantısı desteklenir.

## Vardiya ve Mesai Hesabı

Varsayılan vardiyalar:

| Vardiya | Saat |
| --- | --- |
| Sabah | 06:00 - 16:00 |
| Ara | 11:00 - 21:00 |
| Akşam | 16:00 - 02:00 |

Vardiya özellikleri:

- Vardiya tanımları ayarlardan değiştirilebilir.
- Vardiya adı, başlangıç saati, bitiş saati ve simgesi yönetilebilir.
- Aynı personele aynı gün çift vardiya verilmesi engellenir.
- Günlük, haftalık, aylık veya özel tarih aralığına göre filtreleme yapılabilir.
- Sabit vardiya seçimi aktif filtre aralığına uygulanır. Örneğin haftalık görünümde “sabit akşam” seçilirse yalnızca o hafta için atanır.
- Personel kendi şubesi için belirlenen vardiyaları görebilir ama değiştiremez.

## Maaş ve Fazla Mesai

Fazla mesai hesaplaması maaş için doğrudan yazılmaz; önce yönetici onayı gerekir.

Mesai takipte gösterilen detaylar:

- Planlanan vardiya
- İlk giriş saati
- Son çıkış saati
- Toplam çalışma süresi
- Parça sayısı
- Ara süresi
- Geç kalma
- Erken gelme
- Mesai sonrası çalışma
- Net fazla mesai
- Maaşa işlenecek yuvarlanmış saat

### Parçalı Çalışma Kuralı

Aynı gün içinde personel birden fazla giriş/çıkış yaptıysa sistem kayıtları tek gün olarak toplar.

Örnek:

| Parça | Giriş | Çıkış |
| --- | --- | --- |
| 1 | 12:26 | 19:29 |
| 2 | 19:31 | 06:49 |

Bu örnekte iki parça arasında yalnızca `2 dk` ara vardır. İkinci giriş ayrı bir geç kalma olarak sayılmaz. Geç kalma günün ilk girişine göre, mesai sonrası çalışma günün son çıkışına göre hesaplanır.

### Fazla Mesai Yuvarlama

Maaşa işlenecek fazla mesai kuralı:

| Gerçek fazla mesai | Maaşa işlenecek |
| --- | --- |
| 0 - 44 dk | 0 saat |
| 45 - 59 dk | 1 saat |
| 1 sa 00 dk - 1 sa 44 dk | 1 saat |
| 1 sa 45 dk - 1 sa 59 dk | 2 saat |
| 8 sa 37 dk | 8 saat |
| 8 sa 45 dk | 9 saat |

Yani 45 dakika ve üzeri bir üst saate tamamlanır; 45 dakika altı maaşa mesai olarak işlenmez.

### Onay Akışı

1. Sistem fazla mesaiyi hesaplar.
2. Mesai Takip ekranında yöneticiye onay bekleyen kayıt gösterilir.
3. Yönetici onaylarsa fazla mesai Maaşlar ekranına yansır.
4. Yönetici reddederse red nedeni zorunludur.
5. Onaylanan veya reddedilen kayıt tekrar onay/red işlemine açılamaz; karar geçmiş olarak kilitlenir.
6. Hatalı kayıt varsa yönetici manuel mesai ekleyebilir.
7. Manuel eklenen mesai gerekirse silinebilir.

## Bildirim Sistemi

Bildirim katmanları:

- Uygulama içi bildirim merkezi
- Web notification
- Android/iOS FCM push
- Windows EXE taskbar badge
- Yönetici manuel bildirim gönderimi
- Geç kalma/fazla mesai otomatik bildirimleri
- Günlük/haftalık yönetici özetleri

Mail İşlemleri ekranı:

- Günlük ve haftalık raporun aktif olup olmadığını belirler.
- Hangi saatte ve hangi haftalık günde rapor beklendiğini kaydeder.
- Hedef rolleri seçer: developer, yönetici veya personel.
- Tek tek kullanıcıların rapor e-postasını, günlük ve haftalık aboneliğini yönetir.
- Mail gövdesine ek olarak detaylı HTML özet ve PDF rapor eki üretir.

FCM akışı:

1. Mobil uygulama açılır.
2. Cihaz push token alır.
3. Token `/api/mobile/register-device` ile sisteme kaydedilir.
4. Sistem Sağlığı ekranından `FCM senkronize et` ile token kaydı yeniden denenebilir.
5. `Test push gönder` ile gerçek cihaz gönderimi kontrol edilebilir.

Windows EXE için:

- Uygulama açık veya arka planda ise bildirim ve badge çalışır.
- PC tamamen kapalıysa bildirim alınamaz.
- İleride Windows background service ile uygulama kapalıyken bildirim desteği genişletilebilir.

## Offline Çalışma

Offline katman hem web/PWA, hem Android/iOS, hem Windows EXE için tasarlanmıştır.

Nasıl çalışır:

- Service Worker uygulama shell dosyalarını cache’ler.
- Kritik GET API cevapları son başarılı veri olarak saklanır.
- Sol menü, Ctrl+K hızlı arama ve route izinleri son başarılı yetki cache’iyle çalışır.
- Güvenli POST/PATCH/DELETE işlemleri offline queue’ya alınır.
- İnternet geldiğinde kuyruk otomatik senkronize olur.
- Kullanıcı gerekirse `Senkronize et` butonuyla elle tetikleyebilir.
- Senkron tamamlanınca kullanıcıya “çevrimdışı veriler sisteme işlendi” bildirimi gösterilir.

| Alan | Offline Davranış |
| --- | --- |
| Dashboard shell | Cache üzerinden açılır |
| Gelir tablosu | Son başarılı API cache’iyle açılır |
| Gider tablosu | Son başarılı API cache’iyle açılır |
| Gelir/gider kayıt | Kuyruğa alınır |
| Mesai QR işlemi | Özel offline mutation kuyruğuna alınır |
| Bildirim merkezi | Son bilinen veriyi gösterir |
| Sol menü / yetkiler | Son başarılı yetki ve şube menü cache’iyle görünür kalır |
| İlk kez açılmamış sayfa | İlk yükleme için internet gerekir |
| Supabase realtime | Online gerekir |

Offline tasarımın amacı, bağlantı kısa süreli kesildiğinde kullanıcıya “web sayfası mevcut değil” hatası göstermek yerine uygulama deneyimini korumaktır.

## Yedekleme ve Failover

Production yedekleme üç katmandan oluşur:

1. Supabase PostgreSQL ana veritabanı.
2. Cloudflare R2 üzerinde günlük dump yedekleri.
3. VPS üzerinde failover PostgreSQL restore alanı.

VPS worker bileşenleri:

| Parça | Konum | Amaç |
| --- | --- | --- |
| Backup script | `/usr/local/bin/hesap-backup` | Günlük dump alır, R2’ye yükler, failover restore yapar |
| Health script | `/usr/local/bin/hesap-health` | R2, PostgreSQL ve son backup durumunu JSON döndürür |
| Timer | `hesap-backup.timer` | Günlük otomatik backup tetikler |
| Secret env | `/etc/hesap/backup.env` | R2, Supabase ve failover bağlantı bilgileri |
| Local secret | `.secrets/hesap-vps.env` | Yerel makinedeki gizli bilgiler, git’e girmez |

`/status` sayfası public durum ekranıdır. Supabase, web, SMTP, FCM, backup, R2, failover ve deploy durumunu tek yerden izlemek için kullanılır.

## Cihaz Lisansı

Cihaz lisansı, uygulamanın hangi PC veya telefonda çalıştığını izlemek için kullanılır.

Özellikler:

- Web, desktop, Android ve iOS cihaz ayrımı.
- Cihaz ID üretimi.
- Lisanslı cihaz listesi.
- Uzaktan iptal.
- Bloklanan cihazı `/device-blocked` ekranına yönlendirme.
- Developer/yönetici kontrol paneli.

Amaç; uygulamanın izinsiz cihazlarda kullanılmasını azaltmak ve terminal/mesai güvenliğini güçlendirmektir.

## Windows EXE

Windows uygulaması Electron ile paketlenir.

Özellikler:

- W logosu ile installer ve uygulama ikonu.
- `wasy.system.hesap` app id.
- GitHub Releases üzerinden auto-update.
- Uygulama içi güncelleme paneli.
- Sessiz NSIS kurulum akışı.
- Eski uninstall kayıtlarını temizleyen installer fix.
- Taskbar badge desteği.
- Native PDF kaydetme köprüsü.
- Otomatik başlatma tercihi.

Son yayınlanan sürüm:

- `v0.1.13`
- `Hesap-Setup-0.1.13.exe`
- GitHub Releases: <https://github.com/wasycim/hesap/releases/latest>

Build:

```bash
npm run desktop:dist
```

Publish:

```bash
npm run desktop:publish
```

Not: GitHub Actions build job’u hesap/billing kısıtına düşerse release dosyaları lokal build sonrası manuel yüklenebilir.

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
- Native alt menü
- Offline overlay
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

Güvenlik notu:

- Gerçek secret değerleri README’ye yazılmaz.
- SMTP şifresi, Supabase service role key, FCM private key ve R2 secret key commit edilmez.
- Production secret’ları Vercel, Supabase, VPS env veya yerel `.secrets` altında saklanır.

## Veritabanı ve Scriptler

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

Supabase Auth redirect ve mail template:

```bash
npm run supabase:auth-config
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
| `/auth/sifre-sifirla` | Recovery link ile yeni şifre belirleme |
| `/terminal` | Sabit terminal QR ekranı |
| `/mesai-qr` | Personel kamera ile QR okutma ekranı |
| `/mesai-qr/okut` | Telefonun native QR okuyucusu ile okutma yönlendirmesi |
| `/dashboard` | Ana panel |
| `/dashboard/gelir` | Gelir tablosu |
| `/dashboard/gider` | Gider tablosu |
| `/dashboard/corbalar` | Çorba/ürün takibi |
| `/dashboard/kargo-cari` | Cari hesap takibi |
| `/dashboard/vardiya` | Vardiya planlama |
| `/dashboard/mesai` | Dashboard içi mesai okutma |
| `/dashboard/mesai-takip` | Mesai takip, onay, red ve manuel mesai |
| `/dashboard/maaslar` | Maaş, avans, onaylı mesai |
| `/dashboard/bildirimler` | Kullanıcı bildirim geçmişi |
| `/dashboard/bildirim-gonder` | Yönetici bildirim gönderimi |
| `/dashboard/mail-islemleri` | Otomatik mail alıcıları, rapor zamanları ve PDF/HTML ek ayarları |
| `/dashboard/lisanslar` | Lisanslı cihazlar |
| `/dashboard/sistem-sagligi` | Sistem sağlık paneli |
| `/dashboard/gelismis-log` | Developer gelişmiş log |
| `/dashboard/log-backup` | Developer log backup |
| `/dashboard/operasyon` | Developer operasyon merkezi |
| `/status` | Public sistem durumu |
| `/privacy-policy` | Gizlilik politikası |
| `/data-deletion` | Veri silme açıklaması |

## Production Kontrol Listesi

- [ ] `/auth/giris` production domainde çalışıyor.
- [ ] `/login` kullanılmıyor; giriş akışı `/auth/giris` üzerinden.
- [ ] Supabase Auth redirect URL production domaini gösteriyor.
- [ ] Şifre sıfırlama maili Türkçe ve production link üretiyor.
- [ ] Supabase RLS kritik tablolar için aktif.
- [ ] SMTP test maili başarılı.
- [ ] Mail İşlemleri ekranında günlük/haftalık alıcılar ve PDF/HTML ekleri doğru ayarlı.
- [ ] FCM cihaz token kaydı ve test push başarılı.
- [ ] `/status` public durum sayfası çalışıyor.
- [ ] `/dashboard/sistem-sagligi` developer için detaylı bileşenleri gösteriyor.
- [ ] Mesai onayı olmadan fazla mesai maaşa yansımıyor.
- [ ] Mesai reddinde red nedeni zorunlu.
- [ ] Manuel mesai ekleme ve silme çalışıyor.
- [ ] Aynı güne çift vardiya atanamıyor.
- [ ] Gelir/gider tabloları online açıldıktan sonra offline cache ile açılıyor.
- [ ] Offline queue internet gelince senkronize oluyor.
- [ ] Offline durumda sol menü ve Ctrl+K son başarılı yetkilere göre görünür kalıyor.
- [ ] Senkron tamamlanınca kullanıcıya “sistem güncel” bildirimi geliyor.
- [ ] Windows EXE auto-update `latest.yml` üzerinden son sürümü görüyor.
- [ ] Windows installer uygulama açıkken takılmadan güncelliyor.
- [ ] Cloudflare R2 günlük backup dosyası oluşuyor.
- [ ] VPS `hesap-backup.timer` aktif.
- [ ] Failover PostgreSQL son yedeği restore edebiliyor.

## Sorun Giderme

### GitHub views badge görünmüyor

Eski `hits.seeyoufarm.com` endpoint’i 404 döndürdüğü için sayaç görünmüyordu. README artık çalışan `komarev.com` SVG badge’ini kullanır:

```text
https://komarev.com/ghpvc/?username=wasycim-hesap&style=for-the-badge&color=10b981&label=views
```

### EXE güncelleme “uygulamayı kapatın” hatası veriyor

`v0.1.13` installer akışı eski uninstall kayıtlarını kurulum başında temizler ve açık `Hesap.exe` süreçlerini güvenli biçimde kapatır. Uygulama içi güncelleme paneli üzerinden kurulum başlatılır.

### Mesai onay butonu pasif görünüyor

Yetki ve kayıt durumu kontrol edilir. Yönetici rolü onay verebilir; developer da yönetici üstü yetkiyle bu işlemi yapabilir.

### Reddedilen mesai maaşa yansır mı?

Hayır. Maaşlar ekranı yalnızca onaylanmış otomatik veya manuel mesai kayıtlarını hesaba katar.

### Gelir tablosu offline açılmıyor

İlgili sayfa online iken en az bir kez açılmış olmalıdır. İlk başarılı API cevabından sonra cache üzerinden offline açılabilir.

### FCM cihaz 0 görünüyor

Mobil uygulamada oturum açın, Sistem Sağlığı ekranında `FCM senkronize et` butonuna basın ve ardından test push gönderin. Android bildirim izninin açık olduğundan emin olun.

### Şifre sıfırlama linki localhost geliyor

`NEXT_PUBLIC_SITE_URL` ve Supabase Auth redirect ayarları production domaine göre güncellenmelidir.

## Lisans

Bu proje public depoda görüntülenebilir; ancak açık kaynak değildir.

Kod, installer, APK, iOS paketi, veritabanı şeması, logo, marka varlıkları ve sistem tasarımı Wasy Systems izni olmadan satılamaz, kopyalanamaz, dağıtılamaz veya yeniden yayınlanamaz.

Detaylar için: [`LICENSE.md`](LICENSE.md)
