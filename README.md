# Hesap Rapor Sistemi

<p align="center">
  <img src="public/iconw.png" alt="Hesap W logosu" width="132" />
</p>

<p align="center">
  <strong>Gelir, gider, vardiya, QR mesai, maaş, bildirim ve cihaz yönetimini tek panelde toplayan üretim odaklı işletme sistemi.</strong>
</p>

<p align="center">
  <a href="https://github.com/wasycim/hesap"><img alt="GitHub" src="https://img.shields.io/badge/repo-wasycim%2Fhesap-111827?style=for-the-badge&logo=github" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-App%20Router-000000?style=for-the-badge&logo=nextdotjs" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
  <img alt="Electron" src="https://img.shields.io/badge/Windows-EXE-47848F?style=for-the-badge&logo=electron&logoColor=white" />
</p>

## İçindekiler

- [Özet](#özet)
- [Mimari](#mimari)
- [Ana Modüller](#ana-modüller)
- [Mesai ve Maaş Mantığı](#mesai-ve-maaş-mantığı)
- [Offline Çalışma](#offline-çalışma)
- [Push Bildirim](#push-bildirim)
- [Yetki Sistemi](#yetki-sistemi)
- [Kurulum](#kurulum)
- [Ortam Değişkenleri](#ortam-değişkenleri)
- [Veritabanı ve Scriptler](#veritabanı-ve-scriptler)
- [Çalıştırma Komutları](#çalıştırma-komutları)
- [Windows EXE](#windows-exe)
- [Android ve iOS Hazırlığı](#android-ve-ios-hazırlığı)
- [Production Kontrol Listesi](#production-kontrol-listesi)
- [Rota Haritası](#rota-haritası)
- [Sorun Giderme](#sorun-giderme)
- [Lisans](#lisans)

## Özet

Hesap; şube bazlı işletme raporlarını, QR destekli personel mesai takibini, vardiya planlamayı, maaş hesabını, PDF raporlamayı, FCM push bildirimlerini, cihaz lisanslarını ve offline senkronizasyonu aynı sistemde birleştirir.

Sistem özellikle şu iş akışlarına göre tasarlanmıştır:

- Şubelerin gelir, gider, çorba, kargo cari ve 14 no hesap kayıtlarını yönetmek.
- Personelin TC ve şifre ile giriş yapıp sabit terminal QR kodunu kendi kamerası ile okutmasını sağlamak.
- Mesaiyi vardiya planına göre hesaplamak, ancak maaşa yansımadan önce yönetici onayı istemek.
- Hatalı mesai kaydında yöneticinin red nedeni girmesini ve manuel mesai ekleyebilmesini sağlamak.
- İnternet yokken uygulamanın açılabilmesi, kayıtları kuyruklayabilmesi ve internet gelince senkronize etmesi.
- Windows `.exe`, Android APK ve ileride iOS/TestFlight dağıtımı için aynı web çekirdeğini kullanmak.

## Mimari

```mermaid
flowchart LR
  U["Kullanıcı / Personel"] --> WEB["Next.js Web App"]
  ADM["Yönetici / Developer"] --> WEB
  WEB --> AUTH["Supabase Auth"]
  WEB --> API["Next.js API Routes"]
  API --> PG["Supabase PostgreSQL"]
  API --> PRISMA["Prisma Attendance DB"]
  API --> FCM["Firebase Cloud Messaging"]
  API --> SMTP["SMTP / Zoho Mail"]
  WEB --> SW["Service Worker + Offline Queue"]
  DESK["Windows EXE / Electron"] --> WEB
  MOB["Android / iOS / Capacitor"] --> WEB
  MOB --> FCM
  DESK --> BADGE["Windows Badge + Native Notification"]
```

## Ana Modüller

| Modül | Açıklama |
| --- | --- |
| Dashboard | Şube bazlı finans ve operasyon paneli. |
| Gelir Tablosu | Gelir kayıtları, özel firma sütunları, PDF çıktı ve offline kayıt kuyruğu. |
| Gider Tablosu | Gider kalemleri, personel payları, ortak avansları ve raporlama. |
| Çorbalar | Günlük çorba/ürün takibi. |
| Kargo Cari | Firma bazlı cari borç/alacak takibi. |
| Vardiya | Günlük/haftalık/aylık vardiya planlama, çakışma engeli, özel vardiya tanımları. |
| Mesai | Personelin terminal QR okutma ekranı. |
| Mesai Takip | Şube/personel bazlı giriş-çıkış, geç kalma, fazla mesai, onay ve manuel mesai. |
| Maaşlar | Maaş, avans ve yalnızca onaylanmış mesai ücretleri. |
| Sistem Sağlığı | Supabase, SMTP, FCM, terminal, cihaz ve rapor kontrolleri. |
| Gelişmiş Log | Developer rolüne özel detaylı denetim kayıtları. |
| Lisanslar | PC, web ve mobil cihaz lisansları; uzaktan iptal. |
| Bildirimler | Uygulama içi bildirim, push geçmişi, okundu/silindi durumu. |

## Mesai ve Maaş Mantığı

Mesai sistemi kritik iş kuralıdır. Maaşa para yazmadan önce şu kurallar uygulanır:

1. Personel TC ve şifre ile `/auth/giris` üzerinden giriş yapar.
2. Sadece mesai yetkisi varsa otomatik `/mesai-qr` sayfasına gider.
3. Personel kendi kamerası ile sabit `/terminal` ekranındaki dinamik QR kodu okutur.
4. Açık mesai yoksa giriş, açık mesai varsa çıkış oluşur.
5. Aynı gün içindeki parçalı kayıtlar tek günlük çalışma gibi hesaplanır.
6. Örneğin `12:26 - 19:29` ve `19:31 - 06:49` arası yalnızca `2 dk` ara ise ikinci giriş geç kalma sayılmaz.
7. Geç kalma sadece günün ilk girişine göre, mesai sonrası sadece son çıkışa göre hesaplanır.
8. Toplam çalışma tüm parçaların toplamıdır; ara süre ayrıca gösterilir.
9. Fazla mesai maaşa otomatik eklenmez.
10. Yönetici Mesai Takip ekranında `Onayla` veya `Reddet` kararı verir.
11. Yönetici reddederse red nedeni zorunludur ve kayda yazılır.
12. Kayıtta hata varsa yönetici manuel mesai ekleyebilir veya eklenen manuel mesaiyi silebilir.

### Fazla Mesai Yuvarlama

| Gerçek fazla mesai | Maaşa işlenecek |
| --- | --- |
| 0 - 44 dk | 0 saat |
| 45 - 59 dk | 1 saat |
| 1 sa 00 dk - 1 sa 44 dk | 1 saat |
| 1 sa 45 dk - 1 sa 59 dk | 2 saat |
| 8 sa 37 dk | 8 saat |
| 8 sa 45 dk | 9 saat |

Bu kural `lib/mesai/overtime.ts` içinde merkezi olarak uygulanır.

## Offline Çalışma

Sistem hem PWA, hem Android/iOS WebView kabuğu, hem Windows EXE için offline katmana sahiptir.

### Nasıl Çalışır?

- `public/sw.js` uygulama shell'ini ve API GET cevaplarını cache'ler.
- `lib/offline-sync.ts` güvenli POST/PATCH/DELETE isteklerini offline kuyruğa alır.
- `ConnectivityOverlay` internet yokken kullanıcıya bilgi verir.
- İnternet geri gelince kuyruk otomatik senkronize olur.
- Kullanıcı isterse `Senkronize et` butonuyla kuyruk işlemlerini elle zorlayabilir.
- Gelir tablosu `/api/dashboard/gelir` üzerinden cache'lenebilir hale getirildiği için offline açılabilir.
- Şube/profil bilgileri `contexts/sube-context.tsx` içinde local cache'e düşer; internet yokken son bilinen şube ile ekran açılır.

### Offline Kapsam

| Alan | Durum |
| --- | --- |
| Dashboard shell | Cache |
| Gelir tablosu açılış | Son başarılı API cache'i |
| Gelir kaydetme | Offline queue |
| Mesai QR okutma | Özel offline mutation kuyruğu |
| Bildirim merkezi | Son API cache'i |
| Supabase realtime | Online gerekir |
| İlk kez hiç açılmamış sayfa | Online ilk yükleme gerekir |

## Push Bildirim

Push sistemi Firebase Cloud Messaging kullanır.

- Mobil uygulama açıldığında cihaz tokenı `/api/mobile/register-device` ile kaydedilir.
- Sistem Sağlığı ekranında `FCM senkronize et` butonu native cihaz token kaydını yeniden tetikler.
- `Test push gönder` butonu mevcut hesaba kayıtlı cihazlara gerçek FCM gönderimi yapar.
- Push sonucu `push_delivery_logs` tablosunda saklanır.
- Bildirim geçmişi `/dashboard/bildirimler` ekranında görünür.
- Windows EXE içinde uygulama açıkken web notification ve taskbar badge sayısı çalışır.

> Not: PC tamamen kapalıysa bildirim alınamaz. Windows uygulaması açık veya arka planda çalışıyorsa bildirim/badge görülebilir.

## Yetki Sistemi

| Rol | Yetki |
| --- | --- |
| Personel | Kendi mesai girişi, kendi mesai takibi, sınırlı şube görünümü. |
| Yönetici | Şube operasyonları, mesai onayı, manuel bildirim, vardiya ve maaş yönetimi. |
| Developer | Yönetici üstü rol; sistem sağlığı, gelişmiş log, izin merkezi, kritik operasyonlar. |

Developer rolü, yönetici hesabından oluşturulamaz. Developer hesabı yönetici ve developer yetkilerini yönetebilir.

## Kurulum

```bash
git clone https://github.com/wasycim/hesap.git
cd hesap
npm install
```

Geliştirme sunucusu:

```bash
npm run dev
```

Production build:

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

VERCEL_PROJECT_ID=...
VERCEL_TEAM_ID=...
VERCEL_TOKEN=...
```

Güvenlik notu: gerçek secret, SMTP şifresi, FCM private key veya Supabase service role key kesinlikle README, issue, commit veya screenshot içine yazılmamalıdır.

## Veritabanı ve Scriptler

Prisma client üret:

```bash
npm run prisma:generate
```

Prisma schema push:

```bash
npm run prisma:push
```

Seed:

```bash
npm run prisma:seed
```

Supabase operasyon şemaları:

```bash
npm run supabase:system-schema
npm run supabase:push-audit-schema
npm run supabase:notification-rules-schema
npm run supabase:advanced-ops-schema
```

Auth redirect ve mail template ayarları:

```bash
npm run supabase:auth-config
```

## Çalıştırma Komutları

| Komut | Açıklama |
| --- | --- |
| `npm run dev` | Local Next.js geliştirme sunucusu. |
| `npm run build` | Prisma generate + Next production build. |
| `npx tsc --noEmit` | TypeScript kontrolü. |
| `npm run desktop:dev` | Electron geliştirme modu. |
| `npm run desktop:dist` | Windows NSIS installer üretir. |
| `npm run desktop:publish` | GitHub Releases için publish akışı. |
| `npm run mobile:sync` | Capacitor Android/iOS asset ve native sync. |
| `npm run mobile:open:android` | Android Studio projesini açar. |
| `npm run mobile:open:ios` | iOS native projeyi açar; Mac gerekir. |

## Windows EXE

Electron uygulaması `wasy.system.hesap` app id ile paketlenir.

Özellikler:

- W logosu ile installer ve uygulama ikonu.
- GitHub Releases üzerinden auto-update.
- Taskbar badge sayısı.
- Native PDF kaydetme/yazdırma köprüsü.
- Uygulama arka planda açıkken desktop notification.
- Hesap ayarlarından otomatik başlatma tercihi.

Build:

```bash
npm run desktop:dist
```

Release:

```bash
npm run desktop:publish
```

## Android ve iOS Hazırlığı

Mobil katman Capacitor kullanır.

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

iOS build için Mac veya Codemagic gibi bulut Mac gerekir. Apple Developer hesabı olmadan App Store/TestFlight dağıtımı yapılamaz.

Native özellikler:

- Push Notifications
- Network status
- Preferences
- Local Notifications
- Haptic feedback
- SplashScreen
- StatusBar
- Native alt menü
- Offline overlay
- PDF indirme akışı

## Production Kontrol Listesi

- [ ] Supabase RLS politikaları aktif.
- [ ] Supabase Auth redirect URL: `https://pamukkaleturizm.info/auth/callback`.
- [ ] SMTP test maili başarılı.
- [ ] FCM provider hazır ve cihaz tokenı kayıtlı.
- [ ] `/status` public durum sayfası çalışıyor.
- [ ] `/dashboard/sistem-sagligi` tüm kritik bileşenleri gösteriyor.
- [ ] Mesai onayı olmadan maaşa fazla mesai eklenmiyor.
- [ ] Reddedilen mesai için red nedeni zorunlu.
- [ ] Gelir tablosu online açıldıktan sonra offline cache ile açılıyor.
- [ ] Offline queue internet gelince senkronize oluyor.
- [ ] Windows EXE auto-update release dosyaları GitHub Releases içinde.

## Rota Haritası

| Rota | Amaç |
| --- | --- |
| `/auth/giris` | Ana giriş ekranı. |
| `/auth/sifremi-unuttum` | TC ile şifre sıfırlama maili. |
| `/auth/sifre-sifirla` | Recovery link ile yeni şifre belirleme. |
| `/terminal` | Sabit terminal QR ekranı. |
| `/mesai-qr` | Personel kamera ile QR okutma ekranı. |
| `/dashboard` | Ana panel. |
| `/dashboard/gelir` | Gelir tablosu. |
| `/dashboard/gider` | Gider tablosu. |
| `/dashboard/vardiya` | Vardiya planlama. |
| `/dashboard/mesai-takip` | Mesai takip, onay, red nedeni, manuel mesai. |
| `/dashboard/maaslar` | Maaş, avans, onaylı mesai. |
| `/dashboard/sistem-sagligi` | Sağlık kontrolleri, FCM, SMTP, yedekleme. |
| `/dashboard/lisanslar` | Lisanslı cihazlar. |
| `/dashboard/operasyon` | Developer operasyon merkezi. |
| `/dashboard/bildirimler` | Kullanıcı bildirim geçmişi. |
| `/status` | Public sistem durumu. |
| `/privacy-policy` | Gizlilik politikası. |
| `/data-deletion` | Veri silme açıklaması. |

## Sorun Giderme

### Mesai onay butonu pasif görünüyor

Yeni akışta onay kaydı daha önce oluşmadıysa buton tıklanınca kayıt otomatik oluşturulur. Reddetme için red nedeni zorunludur.

### Reddedilen mesai maaşa gidiyor mu?

Hayır. Maaş sayfası yalnızca `overtime_approvals.status = approved` olan otomatik veya manuel mesaileri hesaba katar.

### Gelir tablosu offline açılmıyor

İlgili ay ve şube online iken en az bir kez açılmış olmalıdır. İlk online açılıştan sonra API cevabı cache'e düşer.

### FCM cihaz 0 görünüyor

Mobil uygulamada oturum açın, Sistem Sağlığı ekranında `FCM senkronize et` butonuna basın, ardından `Test push gönder` çalıştırın. Android cihazda bildirim izninin açık olduğundan emin olun.

### Şifre sıfırlama linki localhost geliyor

`NEXT_PUBLIC_SITE_URL` ve Supabase Auth redirect ayarları production domaine göre güncellenmelidir.

### EXE güncelleme uyarısı gelmiyor

GitHub Release içinde installer ve `latest.yml` doğru sürümle publish edilmiş olmalıdır. Uygulama eski sürümle açıldığında auto-updater GitHub release feed'ini kontrol eder.

## Lisans

Bu proje özeldir ve `UNLICENSED` olarak tutulur.

Kod, installer, APK, veritabanı şeması ve görsel varlıklar Wasy Systems izni olmadan kopyalanamaz, dağıtılamaz veya yeniden yayınlanamaz.
