# Hesap ve QR Mesai Takip Sistemi

Hesap, sube bazli gelir gider takibi ile QR destekli personel mesai takibini ayni panelde birlestiren production odakli bir Next.js uygulamasidir. Sistem Supabase Postgres, Prisma, JWT, RLS politikalar, vardiya planlama, PDF raporlama ve Vercel deployment akisi uzerine kuruludur.

Bu dokuman projeyi calistirmak, veritabani yapisini kurmak, QR mesai akisini anlamak, vardiya planlamak, yetkileri yonetmek ve production sorunlarini hizli cozmek icin hazirlanmistir.

## Icindekiler

- [Teknoloji Ozeti](#teknoloji-ozeti)
- [Ana Moduller](#ana-moduller)
- [QR Mesai Akisi](#qr-mesai-akisi)
- [Sayfalar](#sayfalar)
- [Veritabani Yapisi](#veritabani-yapisi)
- [Vardiya Sistemi](#vardiya-sistemi)
- [Kurulum](#kurulum)
- [Ortam Degiskenleri](#ortam-degiskenleri)
- [Veritabani Kurulumu](#veritabani-kurulumu)
- [Calistirma Komutlari](#calistirma-komutlari)
- [Guvenlik](#guvenlik)
- [Lisans ve Dagitim](#lisans-ve-dagitim)
- [PDF ve Raporlama](#pdf-ve-raporlama)
- [Deployment](#deployment)
- [Test ve Dogrulama](#test-ve-dogrulama)
- [Proje Yapisi](#proje-yapisi)
- [Sorun Giderme](#sorun-giderme)

## Teknoloji Ozeti

| Alan | Teknoloji |
| --- | --- |
| Framework | Next.js App Router |
| Dil | TypeScript |
| UI | React, TailwindCSS, shadcn/ui, Radix UI |
| Veritabani | PostgreSQL, Supabase Postgres |
| ORM | Prisma |
| Auth | Supabase Auth, JWT, HTTP-only cookie |
| QR | `qrcode`, `html5-qrcode` |
| Sifreleme | bcrypt password hash |
| Raporlama | Tarayici ve masaustu uygulama icinden PDF cikti akisi |
| Deployment | Vercel |
| Tema | Responsive tasarim, dark mode |

> Not: Proje mevcut kod tabanindaki Next.js surumuyle calisir. Paketlerdeki gercek surumleri `package.json` dosyasindan kontrol edin.

## Ana Moduller

### Hesap Dashboard

Sube bazli gelir, gider, corba, kargo cari ve kullanici yonetimi icin ana paneldir.

- Sube secimi
- Gelir tablosu
- Gider tablosu
- Kargo cari
- Corba takibi
- Guvenlik olaylari
- Admin ayarlari
- Gorunum ve kolon ayarlari

### QR Mesai Takip

Personellerin giris cikisini sabit terminal QR'i ile takip eder.

- Personel TC ve sifre ile giris yapar.
- Personel kendi cihazinin kamerasini acar.
- Sabit `/terminal` ekranindaki dinamik QR'i okutur.
- Acik mesai yoksa check-in olusturulur.
- Acik mesai varsa check-out yapilir.
- Islem basarili oldugunda sesli bildirim verilir.
- Islem basarili olduktan sonra personelin kamerasi otomatik kapatilir.

### Vardiya Planlama

`/dashboard/vardiya` sayfasi, personellerin gunluk vardiyalarini takvim uzerinden planlamak icin kullanilir.

- Gunluk vardiya atama
- Sube bazli personel listesi
- Sabit vardiya sutunu
- Vardiya tanimlari
- Vardiya ikon ayarlari
- Tarih araligi secimi
- PDF cikti destegi

### Mesai Takip

`/dashboard/mesai-takip` sayfasi, sube sube personel mesai performansini takip eder.

- Sube bazli ozet
- Personel bazli check-in ve check-out
- Gec kalma
- Fazla mesai
- Eksik cikislar
- Tarih araligi filtreleme
- PDF raporlama

## QR Mesai Akisi

Sistemin temel farki sudur: QR personelde sabit kalmaz. Guvenlik icin sabit terminal ekranindaki QR 30 saniyede bir yenilenir.

1. Sabit ekranda `/terminal` sayfasi acik kalir.
2. Bu sayfa 30 saniyede bir yeni QR uretir.
3. Personel `/login` sayfasindan TC ve sifre ile giris yapar.
4. Basarili giristen sonra personel `/mesai-qr` sayfasina yonlenir.
5. Personelin kamerasi acilir.
6. Personel, kendi kamerasi ile terminaldeki QR'i okutur.
7. `/api/personel/scan-terminal` QR tokenini dogrular.
8. Personelin acik mesaisi yoksa giris kaydi acilir.
9. Acik mesaisi varsa cikis saati yazilir ve kayit kapanir.
10. Basarili islemde kamera otomatik kapatilir.

Bu yapi sayesinde terminaldeki QR kopyalansa bile kisa surede gecersiz olur.

## Sayfalar

| Route | Aciklama | Yetki |
| --- | --- | --- |
| `/` | Oturum durumuna gore giris veya dashboard yonlendirmesi | Herkes |
| `/auth/giris` | Ana dashboard girisi | Herkes |
| `/dashboard` | Hesap genel bakis paneli | Giris yapmis kullanici |
| `/dashboard/vardiya` | Modern vardiya takvimi | Yonetici |
| `/dashboard/mesai-takip` | Sube bazli mesai takip paneli | Yonetici |
| `/dashboard/ayarlar` | Ortak, personel ve kargo firma ayarlari | Yonetici |
| `/dashboard/admin-ayarlar` | Kullanici, sube, rol ve guvenlik ayarlari | Yonetici |
| `/dashboard/guvenlik-ayarlar` | Guvenlik olaylari | Yonetici |
| `/personel-mesai` | Mesai admin paneli | Yonetici |
| `/login` | Personel mesai girisi | Personel |
| `/mesai-qr` | Personelin terminal QR okutma ekrani | Personel |
| `/terminal` | Sabit terminal QR ekrani | Terminal |

## Veritabani Yapisi

QR mesai sistemi Prisma tarafinda uc ana tablo uzerine kuruludur.

### `users`

Personel ve yonetici hesaplarini tutar.

Baslica alanlar:

- `id`
- `tc_kimlik`
- `name`
- `password_hash`
- `role`
- `qr_token`
- `shift_id`
- `is_active`
- `created_at`
- `updated_at`

### `shifts`

Mesai vardiyalarinin baslangic ve bitis saatlerini dakika cinsinden tutar.

Baslica alanlar:

- `id`
- `name`
- `start_minute`
- `end_minute`
- `created_at`
- `updated_at`

### `attendance_logs`

Personel giris cikis kayitlarini tutar.

Baslica alanlar:

- `id`
- `user_id`
- `shift_id`
- `check_in_at`
- `check_out_at`
- `work_date`
- `status`
- `late_minutes`
- `overtime_minutes`
- `created_at`
- `updated_at`

## Vardiya Sistemi

Varsayilan vardiyalar:

| Kod | Vardiya | Saat |
| --- | --- | --- |
| `S` | Sabah | 06:00 - 16:00 |
| `A` | Aksam | 16:00 - 02:00 |
| `R` | Ara | 11:00 - 21:00 |
| `OFF` | Izin | Calisma yok |

Ek vardiya tipleri ayarlardan tanimlanabilir. Ornek:

| Vardiya Adi | Saat |
| --- | --- |
| Carsi Vardiya | 09:00 - 19:00 |
| Destek Vardiya | 12:00 - 22:00 |

### Gunluk Plan Mantigi

Vardiyalar gunluk olarak atanir. Personelin bir sabit vardiyasi olabilir, fakat yonetici takvim uzerinden belirli gunleri degistirebilir.

Oncelik sirasi:

1. Takvimde o gun icin atanmis vardiya
2. Personelin sabit vardiya sutunundaki deger
3. Prisma `users.shift_id` fallback degeri

Bu sayede normal gunler sabit vardiyadan akar, istisna gunler takvimden kolayca degistirilir.

## Kurulum

### Gereksinimler

- Node.js 20 veya ustu
- npm
- PostgreSQL veya Supabase Postgres
- Vercel CLI, production deploy icin
- Git

### Depoyu Klonlama

```bash
git clone https://github.com/wasycim/hesap.git
cd hesap
```

### Paketleri Kurma

```bash
npm install
```

### Lokal Sunucu

```bash
npm run dev
```

Varsayilan adres:

```text
http://localhost:3000
```

## Ortam Degiskenleri

Kok dizinde `.env` dosyasi olusturun.

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_SECRET_KEY=

DATABASE_URL=
DIRECT_URL=

JWT_SECRET=
AUTH_SECRET=
NEXTAUTH_SECRET=

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Zorunlu Degiskenler

| Degisken | Aciklama |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser tarafindaki Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser tarafindaki Supabase anon key |
| `SUPABASE_URL` | Server tarafindaki Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API islemleri icin service role key |
| `DATABASE_URL` | Prisma pooled PostgreSQL baglantisi |
| `DIRECT_URL` | Prisma migration ve direct PostgreSQL baglantisi |

### JWT Secret

Mesai auth cookie ve terminal QR dogrulamasi icin en az bir guclu secret gerekir.

Onerilen:

```env
JWT_SECRET=minimum-32-karakter-uzun-guclu-bir-secret
```

Fallback olarak su degiskenlerden biri kullanilabilir:

- `AUTH_SECRET`
- `NEXTAUTH_SECRET`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_SECRET_KEY`

Production icin en temiz cozum her zaman ayri bir `JWT_SECRET` tanimlamaktir.

## Veritabani Kurulumu

### Prisma

Prisma client uretimi:

```bash
npm run prisma:generate
```

Seed data:

```bash
npm run prisma:seed
```

Seed dosyasi varsayilan vardiyalari ekler:

- Sabah Vardiyasi
- Aksam Vardiyasi
- Ara Vardiya

### SQL Scriptleri

Supabase SQL Editor veya migration akisi uzerinden scriptleri uygulayin.

| Dosya | Gorev |
| --- | --- |
| `scripts/001_create_tables.sql` | Ana hesap tablolarini olusturur |
| `scripts/002_column_settings.sql` | Kolon ve sube ayarlarini ekler |
| `scripts/003_security_admin_settings.sql` | Admin, gorunum ve guvenlik tablolarini ekler |
| `scripts/012_qr_attendance_prisma_tables.sql` | QR mesai tablolarini ekler |
| `scripts/013_vardiya_planlari.sql` | Vardiya planlama tablolarini ekler |
| `supabase/migrations/20260527130000_enable_rls_for_attendance_and_shifts.sql` | Mesai ve vardiya tablolarinda RLS politikalarini etkinlestirir |

Yardimci scriptler:

```bash
node scripts/apply-vardiya-schema.js
node scripts/check-vardiya-schema.js
node scripts/apply-rls-policies.js
```

## Calistirma Komutlari

```bash
npm run dev
```

Lokal gelistirme sunucusunu baslatir.

```bash
npm run build
```

Prisma client uretir ve production build alir.

```bash
npm run start
```

Build edilmis uygulamayi production modda calistirir.

```bash
npx tsc --noEmit
```

TypeScript tip kontrolu yapar.

```bash
npm run prisma:push
```

Prisma schema degisikliklerini veritabanina uygular.

## Guvenlik

### Auth Katmanlari

Sistemde iki farkli giris akisi vardir.

| Akis | Route | Kullanici |
| --- | --- | --- |
| Dashboard Auth | `/auth/giris` | Yonetici ve dashboard kullanicilari |
| Mesai Auth | `/login` | Personel QR mesai kullanicilari |

Mesai girisi basarili olunca HTTP-only `mesai_auth` cookie yazilir. Bu cookie JWT ile imzalanir.

### QR Guvenligi

Terminal QR payload'i imzali ve surelidir.

```json
{
  "terminalId": "fixed-terminal",
  "token": "jwt-token"
}
```

JWT token icinde terminal tipi, nonce, issuer, audience, subject ve expiry bilgisi bulunur.

```json
{
  "typ": "terminal-attendance-qr",
  "nonce": "random-value",
  "sub": "fixed-terminal",
  "iss": "hesap-mesai",
  "aud": "hesap-mesai-personnel",
  "exp": 1710000030
}
```

QR 30 saniyede bir yenilenir. Eski QR okutulursa API reddeder.

### Kamera Guvenligi

Personel QR'i basariyla okuttugunda:

- API check-in veya check-out islemini tamamlar.
- Sesli basari bildirimi verilir.
- `html5-qrcode` scanner durdurulur.
- Kamera stream'i temizlenir.
- Ekranda kameranin otomatik kapatildigi bilgisi gosterilir.

### RLS

Supabase tarafinda kritik public tablolar icin Row Level Security aciktir.

Kritik tablolar:

- `public.shifts`
- `public.users`
- `public.attendance_logs`
- `public.vardiya_tanimlari`
- `public.vardiya_sabit_ayarlari`

RLS kapali olursa Supabase guvenlik paneli kritik uyari verir. Bu durumda migration dosyasini tekrar uygulayin:

```text
supabase/migrations/20260527130000_enable_rls_for_attendance_and_shifts.sql
```

## Lisans ve Dagitim

Bu proje kapali kaynak ve ozel lisanslidir. Kod, installer, guncelleme dosyalari, veritabani semasi, dokumantasyon ve logo dosyalari proje sahibinden yazili izin alinmadan kopyalanamaz, indirilemez, kullanilamaz, paylasilamaz veya yeniden dagitilamaz.

Uygulama paketinde lisans degeri `UNLICENSED` olarak tutulur ve `LICENSE` dosyasi tum haklarin sakli oldugunu belirtir.

Indirme kontrolu icin onemli kural:

- GitHub reposu veya GitHub Release public kalirsa `.exe` dosyasini teknik olarak herkes indirebilir.
- Yetkisiz indirmeyi engellemek icin repo private olmali veya installer dosyasi sadece yetkili kisilere verilen kapali bir depoda tutulmalidir.
- Uygulamayi kullanacak kisiye installer dosyasini proje sahibi paylasir; kullanici bu dosyayi baska kisiye dagitamaz.
- Masaustu otomatik guncelleme private release kullaniyorsa GitHub yetkisi olan kullanicilar veya proje sahibinin belirledigi dagitim kanali uzerinden calistirilmalidir.

Mevcut yasal lisans bu projeyi izinsiz kullanima ve dagitima kapatir. Gercek anlamda kisi bazli aktivasyon istenirse ayrica lisans anahtari sunucusu ve uygulama acilisinda online dogrulama katmani eklenmelidir.

## PDF ve Raporlama

CSV export yerine PDF cikti akisi tercih edilir.

PDF alinabilen ana alanlar:

- `/dashboard/vardiya`
- `/dashboard/mesai-takip`
- `/personel-mesai`

Tarih filtreleri:

- Gunluk
- Haftalik
- Aylik
- Manuel baslangic ve bitis tarihi

PDF raporlar aktif filtreye gore hazirlanir. Ornegin haftalik filtre seciliyse sadece o haftanin vardiya veya mesai verileri yazdirilir.

Masaustu `.exe` icinde PDF butonlari uygulamanin kendi yazdirma penceresini acar. PDF akisi `about:blank` penceresini Windows'a dis baglanti olarak gondermez; bu nedenle "Bu uygulama baglantisini acmak icin 'about' edinin" hatasi beklenmez.

## Deployment

Production deploy Vercel uzerinden yapilir.

### Vercel Ortam Degiskenleri

Vercel Project Settings altinda su degiskenleri tanimlayin:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
JWT_SECRET=
```

Supabase Vercel entegrasyonu bazen `POSTGRES_PRISMA_URL` ve `POSTGRES_URL_NON_POOLING` uretir. Prisma build ve runtime icin bunlarin aliaslari da gerekir.

| Supabase/Vercel Degeri | Uygulamadaki Deger |
| --- | --- |
| `POSTGRES_PRISMA_URL` | `DATABASE_URL` |
| `POSTGRES_URL_NON_POOLING` | `DIRECT_URL` |

Bu aliaslar eksikse login veya QR API route'lari production'da 500 hatasi verebilir.

### Deploy Komutlari

```bash
npm run build
npx vercel deploy --prod
```

Domain alias gerekiyorsa:

```bash
npx vercel alias set <deployment-url> pamukkaleturizm.info
```

## Windows .exe Uygulamasi

Proje Electron ile Windows masaustu uygulamasi olarak da paketlenebilir. Masaustu uygulamasi `https://pamukkaleturizm.info` adresini yukleyen guvenli bir kabuk olarak calisir; bu sayede web sitesindeki normal guncellemeler kullanici uygulamayi actiginda otomatik gorunur.

Masaustu ve web ikon kaynagi `public/iconw.png` dosyasidir. `npm run desktop:icons` komutu bu logodan `desktop/build/icon.ico`, `desktop/build/icon.png`, `app/icon.png` ve `app/apple-icon.png` dosyalarini uretir. Windows installer ve `Hesap.exe` ikonu paket sonunda ayni W logosuyla islenir.

`.exe` olusturmak:

```bash
npm run desktop:dist
```

Installer su klasore cikar:

```text
desktop/release/
```

Lokal Next.js sunucusunu masaustu uygulamasinda denemek:

```powershell
$env:HESAP_DESKTOP_URL="http://localhost:3000"; npm run desktop:dev
```

Masaustu kabugunun kendisi guncellenecekse `package.json` icindeki `version` artirilir ve GitHub Releases'a publish edilir:

```powershell
$env:GH_TOKEN="github_token_degeri"; npm run desktop:publish
```

Kullanici uygulamayi actiginda yeni release varsa "Yeni guncelleme var" mesaji gorur. "Guncelle" butonuna tikladiginda installer indirilir, uygulama yeniden baslar ve yeni surum otomatik kurulur.

Normal web sitesi degisiklikleri icin kullanicinin `.exe` dosyasini tekrar kurmasi gerekmez; uygulama siteyi actigi anda son web surumunu gorur. Electron kabugu, ikon, otomatik guncelleme veya PDF pencere davranisi gibi masaustu tarafina ait degisikliklerde yeni installer release edilir ve uygulama acilista bunu otomatik kontrol eder.

Otomatik guncelleme GitHub Release uzerinden calisir. Repo private oldugunda release dosyalari yalnizca yetkili GitHub erisimi veya proje sahibinin kapali dagitim kanali ile indirilebilir.

## Test ve Dogrulama

Degisikliklerden sonra minimum kontroller:

```bash
npx tsc --noEmit
npm run build
```

QR mesai smoke testi:

```bash
node scripts/smoke-qr-attendance.js
```

Manuel kontrol listesi:

- `/` adresi login akisini dogru yonlendiriyor mu?
- `/auth/giris` dashboard girisi calisiyor mu?
- `/login` TC ve sifre ile mesai girisi yapiyor mu?
- `/terminal` QR uretiyor mu?
- `/mesai-qr` kamera aciyor mu?
- Basarili okutma sonrasi kamera kapaniyor mu?
- `/dashboard/vardiya` personelleri ve vardiyalari gosteriyor mu?
- `/dashboard/mesai-takip` sube bazli veriyi getiriyor mu?
- PDF cikti aktif filtreye uyuyor mu?

## Proje Yapisi

```text
app/
  api/
    auth/                         Mesai auth API route'lari
    terminal/qr/                  Dinamik terminal QR API route'u
    personel/scan-terminal/       QR okutma ve check-in/check-out route'u
    dashboard/vardiya/            Vardiya planlama API route'u
    dashboard/mesai-takip/        Mesai takip API route'u
    personel-mesai/               Mesai admin API route'lari
  auth/giris/                     Dashboard girisi
  dashboard/
    vardiya/                      Vardiya takvimi
    mesai-takip/                  Sube bazli mesai takip
    ayarlar/                      Personel ve sistem ayarlari
  login/                          Personel mesai girisi
  mesai-qr/                       Personel kamera ile terminal QR okutma
  terminal/                       Sabit terminal QR ekrani
  personel-mesai/                 Admin personel mesai paneli

components/
  mesai/
    login-form.tsx                Personel TC ve sifre girisi
    terminal-dynamic-qr.tsx        Terminal QR ekrani
    personnel-terminal-scanner.tsx Personel kamera tarayicisi
    admin-attendance-dashboard.tsx Mesai admin paneli
  dashboard/
    vardiya-settings-card.tsx      Vardiya ayarlari
    sidebar.tsx                   Dashboard menusu

lib/
  qr-attendance/
    auth.ts                       JWT ve mesai session yardimcilari
    qr.ts                         QR imzalama ve dogrulama
    time.ts                       Vardiya saat ve mesai hesaplari
    dashboard-vardiya.ts          Dashboard vardiya planlariyla entegrasyon
    sync-users.ts                 Dashboard personelinden mesai kullanicisi eslestirme
  prisma.ts                       Prisma client

prisma/
  schema.prisma                   Prisma modelleri
  seed.js                         Varsayilan vardiya seed'i

scripts/
  apply-rls-policies.js           RLS policy uygulama yardimcisi
  apply-vardiya-schema.js         Vardiya schema uygulama yardimcisi
  check-vardiya-schema.js         Vardiya schema kontrolu
  smoke-qr-attendance.js          QR mesai smoke testi

supabase/
  migrations/                     Supabase migration dosyalari
```

## Sorun Giderme

### `/terminal` QR uretmiyor

Kontrol edin:

- `JWT_SECRET` veya fallback secret tanimli mi?
- `/api/terminal/qr` 200 donuyor mu?
- Vercel production env degiskenleri dogru mu?
- Deploy sonrasinda production yeniden baslatildi mi?

### Login "giris yapilmadi" diyor

Kontrol edin:

- `DATABASE_URL` tanimli mi?
- `DIRECT_URL` tanimli mi?
- Prisma client production build sirasinda uretildi mi?
- Personel `users` tablosunda aktif mi?
- TC 11 haneli ve sifre dogru mu?

### Supabase RLS kritik uyari veriyor

Su migration'i tekrar uygulayin:

```text
supabase/migrations/20260527130000_enable_rls_for_attendance_and_shifts.sql
```

Ardindan Supabase Security Advisor ekranindan tekrar kontrol edin.

### Vercel deployment failed

Loglari inceleyin:

```bash
npx vercel inspect <deployment-id> --logs
```

En sik nedenler:

- `DATABASE_URL` eksik
- `DIRECT_URL` eksik
- `JWT_SECRET` eksik
- Supabase service role key eksik
- Prisma schema ile veritabani uyumsuz

### Kamera acilmiyor

Kontrol edin:

- Tarayici kamera izni verildi mi?
- Sayfa HTTPS uzerinden mi calisiyor?
- Mobil cihazda arka kamera kullanilabilir mi?
- Baska bir sekme kamerayi kullaniyor mu?

### Kamera basarili okutma sonrasi kapanmiyor

Beklenen davranis basarili QR okutma sonrasi kameranin kapanmasidir. Kod yolu:

```text
components/mesai/personnel-terminal-scanner.tsx
```

Basarili API cevabindan sonra `html5-qrcode` scanner durdurulur ve temizlenir.

### Vardiya sayfasinda personeller gorunmuyor

Kontrol edin:

- Personeller dashboard ayarlarinda ekli mi?
- Personellerin sube bilgisi var mi?
- `/api/dashboard/vardiya` veri donduruyor mu?
- Vardiya planlari tablosu uygulanmis mi?
- RLS politikalar API tarafindaki service role sorgularini engellemiyor mu?

### PDF hatali tarih araligini aliyor

Kontrol edin:

- Baslangic tarihi ve bitis tarihi ayri secildi mi?
- Gunluk, haftalik, aylik veya manuel filtre aktif mi?
- PDF almadan once filtre UI'i guncellendi mi?

### `.exe` PDF butonunda "about edinin" penceresi aciyor

Bu hata eski masaustu kabugunda PDF icin acilan `about:blank` yazdirma penceresinin Windows'a dis baglanti gibi gonderilmesinden kaynaklanir. Cozum: `v0.1.4` veya daha yeni masaustu surumune guncelleyin. Bu surum PDF penceresini uygulama icinde acar.

## Operasyon Rehberi

### Yeni Personel Ekleme

1. Dashboard ayarlarindan personeli ilgili subeye ekleyin.
2. Mesai kullanicisi gerekiyorsa TC ve sifre tanimini yapin.
3. Sabit vardiya sutunundan varsayilan vardiyasini secin.
4. Gerekirse `/dashboard/vardiya` takviminden gunluk istisnalari girin.

### Yeni Vardiya Tanimlama

1. `/dashboard/vardiya` sayfasina girin.
2. Vardiya ayarlari bolumunu acin.
3. Vardiya adini, saat araligini ve simgesini belirleyin.
4. Kaydedin.
5. Takvimde personellere atayin.

### Gunluk Mesai Kontrolu

1. `/terminal` sayfasini sabit ekranda acin.
2. Personellerin `/login` uzerinden giris yapmasini saglayin.
3. Personeller `/mesai-qr` ekraninda terminal QR'ini okutsun.
4. Yonetici `/dashboard/mesai-takip` ekranindan gec kalanlari ve fazla mesaileri kontrol etsin.
5. Gerekirse PDF rapor alin.

## Lisans

Bu proje kapali kaynak/proprietary lisanslidir. Izinsiz indirme, kullanim, kopyalama, degistirme, yayinlama ve yeniden dagitim yasaktir. Detaylar icin `LICENSE` dosyasina bakin.
