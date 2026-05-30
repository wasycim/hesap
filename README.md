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
- [Sistem Operasyonlari](#sistem-operasyonlari)
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
- `Ctrl+K` ile hizli sayfa komutlari
- `Ctrl+S` ile aktif sayfadaki kaydetme islemini calistirma

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
- Erken giris, gec kalma, mesai sonrasi sure ve net fazla mesai ayrimi
- Eksik cikislar
- Tarih araligi filtreleme
- Modern popover takvim ile baslangic ve bitis tarihi secimi
- Sifir dakika kapanmis hatali kayitlari ve aktif personele baglanmayan eski demo kayitlarini gizleme
- PDF raporlama

### Maaslar

`/dashboard/maaslar` sayfasi personel maaslarini, avanslari ve mesai ucretlerini sadece maas hesabinda toplar.

- Aylik maas ve avans takibi
- Mesai Takip ekranindaki net fazla mesaileri secili ay/sube icin otomatik okuma
- Fazla mesai tutarini `net fazla mesai suresi x personel saatlik mesai ucreti` formuluyle hesaplama
- Sureleri ondalikli saat yerine okunur bicimde gosterme: `8 sa 37 dk x 116,77 TL`
- Manuel gider tablosu mesaileri ile QR mesai takip mesailerini ayri kaynak olarak gosterme
- Personel PDF'inde kaynak, sure, saatlik ucret ve tutar detaylarini yazdirma

> Not: Otomatik fazla mesai hesabi gelir veya gider tablosuna kayit yazmaz. Sadece maaslar sayfasinda personelin net kalan maasina eklenir.

## QR Mesai Akisi

Sistemin temel farki sudur: QR personelde sabit kalmaz. Guvenlik icin sabit terminal ekranindaki QR 30 saniyede bir yenilenir.

1. Sabit ekranda `/terminal` sayfasi acik kalir.
2. Bu sayfa 30 saniyede bir yeni QR uretir.
3. Personel `/auth/giris` sayfasindan TC ve sifre ile giris yapar.
4. Sadece mesai yetkisi varsa personel otomatik `/mesai-qr` sayfasina yonlenir.
5. Dashboard yetkisi de varsa paneldeki `Mesai` menusunden QR okutma ekranini acar.
6. Personelin kamerasi acilir.
7. Personel, kendi kamerasi ile terminaldeki QR'i okutur.
8. `/api/personel/scan-terminal` QR tokenini dogrular.
9. Personelin acik mesaisi yoksa giris kaydi acilir.
10. Acik mesaisi varsa cikis saati yazilir ve kayit kapanir.
11. Basarili islemde kamera otomatik kapatilir.

Bu yapi sayesinde terminaldeki QR kopyalansa bile kisa surede gecersiz olur.

## Sayfalar

| Route | Aciklama | Yetki |
| --- | --- | --- |
| `/` | Oturum durumuna gore giris veya dashboard yonlendirmesi | Herkes |
| `/auth/giris` | Ana dashboard girisi | Herkes |
| `/auth/sifremi-unuttum` | TC ile sifre sifirlama e-postasi isteme | Herkes |
| `/auth/sifre-sifirla` | E-postadaki linkten yeni sifre belirleme | Sifre sifirlama linki |
| `/dashboard` | Hesap genel bakis paneli | Giris yapmis kullanici |
| `/dashboard/vardiya` | Modern vardiya takvimi | Yonetici |
| `/dashboard/mesai` | Dashboard icinden terminal QR okutma ekrani | Dashboard kullanicisi |
| `/dashboard/mesai-takip` | Sube bazli mesai takip paneli | Yonetici |
| `/dashboard/maaslar` | Maas, avans ve fazla mesai hesap paneli | Yonetici |
| `/dashboard/ayarlar` | Ortak, personel ve kargo firma ayarlari | Yonetici |
| `/dashboard/admin-ayarlar` | Kullanici, sube, rol ve guvenlik ayarlari | Yonetici |
| `/dashboard/guvenlik-ayarlar` | Guvenlik olaylari | Yonetici |
| `/personel-mesai` | Mesai admin paneli | Yonetici |
| `/login` | Eski mesai girisi; `/auth/giris` sayfasina yonlendirir | Herkes |
| `/mesai-qr` | Personelin terminal QR okutma ekrani | Personel |
| `/terminal` | Sabit terminal QR ekrani | Terminal |
| `/privacy-policy` | Mobil/web gizlilik politikasi | Herkes |
| `/mobile-support` | Mobil uygulama destek sayfasi | Herkes |
| `/data-deletion` | Veri silme ve duzeltme talep sureci | Herkes |
| `/status` | Public sistem sagligi sayfasi | Herkes |
| `/dashboard/sistem-sagligi` | Terminal cihaz onayi, yedekleme, reset gecmisi, ozet mail ve sistem sagligi | Yonetici |

Auth ekranlarinda herkese acik kayit ol secenegi yoktur. Giris, sifremi unuttum, sifre sifirlama ve auth hata ekranlarinin altinda gizlilik politikasi, veri silme ve destek linkleri kucuk bilgi alani olarak gosterilir; ayni sayfalar iOS/Android WebView icinde de gorunur.

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

Vardiyalar gunluk olarak atanir. Takvimdeki `Sabit` sutunu kalici personel ayari degildir; o anda secili tarih araligindaki tum gunleri ayni vardiya ile dolduran hizli toplu atama kontroludur.

Ornek:

- Haftalik filtrede `Sabit -> Aksam` secilirse yalnizca o hafta tum gunler aksam vardiyasi olur.
- Sonraki hafta `Sabit -> Sabah` secilirse yalnizca o hafta sabah vardiyasi olur.
- Aylik veya ozel tarih araliginda secim yapilirsa sadece gorunen aralik doldurulur.

Kaydedilen veri gun gun `vardiya_planlari` kaydi olarak tutulur. Bu sayede birinci hafta full aksam, ikinci hafta full sabah gibi farkli planlar korunur.

Oncelik sirasi:

1. Takvimde o gun icin atanmis vardiya
2. Prisma `users.shift_id` fallback degeri

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

NEXT_PUBLIC_APP_URL=https://pamukkaleturizm.info
PASSWORD_RESET_BASE_URL=https://pamukkaleturizm.info
PASSWORD_RESET_DELIVERY=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Hesap Rapor Sistemi <system@pamukkaleturizm.tr>"
SUPABASE_ACCESS_TOKEN=
```

Production icin `NEXT_PUBLIC_APP_URL` ve `PASSWORD_RESET_BASE_URL` degerleri `https://pamukkaleturizm.info` olmalidir. Sifre sifirlama route'u localhost veya local IP gelse bile link tabanini production domain'e sabitler. Supabase Auth redirect allow-list icinde su URL'ler bulunmalidir:

```text
https://pamukkaleturizm.info/auth/callback
https://pamukkaleturizm.info/auth/sifre-sifirla
```

`PASSWORD_RESET_DELIVERY=smtp` sifre sifirlama mailini Supabase default template'i yerine uygulamanin kendi Turkce HTML mailiyle gonderir. Bunun icin `SMTP_*` degerleri Vercel Production ortaminda tanimli olmalidir. `SUPABASE_ACCESS_TOKEN` sadece Supabase Auth URL/template ayarlarini Management API ile otomatik guncellemek icin kullanilir. Bu token Supabase Dashboard > Account > Access Tokens ekranindan uretilir ve git'e eklenmez.

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
| `scripts/015_system_operations.sql` | Terminal cihazlari, mobil cihaz tokenlari, bildirimler, tema tercihi ve ozet mail tablolarini ekler |

Yardimci scriptler:

```bash
node scripts/apply-vardiya-schema.js
node scripts/check-vardiya-schema.js
node scripts/apply-rls-policies.js
npm run supabase:system-schema
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
| Mesai Auth | `/auth/giris` | Personel QR mesai kullanicilari |

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

### Sifre Sifirlama

Kullanici `/auth/sifremi-unuttum` ekraninda TC kimlik numarasini girer. Sistem TC'yi `user_profiles.tc_kimlik` alanindan bulur, kullaniciya bagli gercek e-postayi cozer ve Supabase Auth ile sifre sifirlama e-postasi gonderir.

Akis:

1. `/api/auth/forgot-password` TC'yi dogrular.
2. Profil veya Supabase Auth metadata uzerinden e-posta bulunur.
3. SMTP ayarlari varsa Supabase `generateLink` ile recovery token uretir ve uygulamanin kendi Turkce HTML maili gonderilir.
4. SMTP ayarlari yoksa sistem Supabase `resetPasswordForEmail` fallback akisini kullanir; bu durumda mail tasarimi Supabase Dashboard > Email Templates ekranindaki sablona baglidir.
5. Reset mail kullaniciyi dogrudan `https://pamukkaleturizm.info/auth/callback?next=/auth/sifre-sifirla&token_hash=...&type=recovery` adresine yollar; URL'de `localhost`, `access_token` veya `refresh_token` gorunmez.
6. Callback `token_hash` degerini server tarafinda dogrular ve kullaniciyi yeni sifre ekranina tasir.
7. `/auth/sifre-sifirla` ekrani gerekirse `code`, `token_hash` veya eski hash token formatlarini da yakalayip yeni sifreyi kaydeder.

Notlar:

- Sifre sifirlama maili icin kullanicinin gercek e-postasi kayitli olmalidir.
- `personel-<tc>@pamukkaleturizm.info` gibi otomatik uretilen mesai-only e-postalar mail alamaz; bu kullanicilar icin admin panelinden gercek e-posta tanimlanmalidir.
- Supabase Auth > URL Configuration icinde Site URL `https://pamukkaleturizm.info` olmalidir.
- Supabase Auth > URL Configuration icinde `https://pamukkaleturizm.info/auth/callback` ve `https://pamukkaleturizm.info/auth/sifre-sifirla` redirect URL olarak eklenmelidir.
- Supabase Auth > Email Templates > Reset Password icin Turkce HTML sablonu `docs/supabase-password-reset-email.html` dosyasindadir. Subject: `Hesap şifreni yenile`.
- Supabase Management API token varsa URL ve mail sablonunu otomatik uygulamak icin `npm run supabase:auth-config` calistirilir.
- Supabase default mailini tamamen devreden cikarmak icin Vercel Production ortaminda `PASSWORD_RESET_DELIVERY=smtp` ve `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` degerleri tanimli olmalidir.
- Production icin Supabase SMTP ayari tanimlanmalidir; aksi halde varsayilan e-posta limitlerine takilabilirsiniz.
- `/auth/sifre-sifirla` sayfasi normal oturumla kullanilamaz. Sifre guncelleme API'si sadece e-postadaki recovery linki callback tarafinda dogrulandiktan sonra verilen kisa sureli, imzali cookie ile calisir.

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
- `public.terminal_devices`
- `public.user_devices`
- `public.app_notifications`
- `public.admin_digest_subscribers`

RLS kapali olursa Supabase guvenlik paneli kritik uyari verir. Bu durumda migration dosyasini tekrar uygulayin:

```text
supabase/migrations/20260527130000_enable_rls_for_attendance_and_shifts.sql
scripts/015_system_operations.sql
```

## Sistem Operasyonlari

### Terminal cihaz eslestirme

`/terminal` artik her cihazda otomatik QR uretmez. Terminal ekrani ilk acildiginda browser local storage icinde benzersiz bir terminal cihaz anahtari olusturur ve `public.terminal_devices` tablosuna bekleyen cihaz olarak kaydeder.

Yonetici `/dashboard/sistem-sagligi` ekranindan cihazı onaylar. Yalnizca `approved=true` olan cihazlar `/api/terminal/qr` uzerinden 30 saniyelik QR alabilir. Onay kaldirilirsa terminal ekrani QR uretmeyi durdurur.

### Offline mod ve senkronizasyon

Web, iOS, Android ve masaustu uygulamada global offline ekran vardir. Internet yokken kullaniciya "Internet baglantisi yok" sayfasi ve `Yeniden yukle` butonu gosterilir. Guvenlik kaydi gibi kucuk mutasyonlar baglanti yoksa local queue icine alinir; baglanti geri geldiginde otomatik tekrar gonderilir.

Mesai QR islemi guvenlik nedeniyle offline tamamlanmaz; terminal QR'i sureli JWT oldugu icin gercek check-in/check-out sunucu baglantisi varken yapilir.

### Sistem sagligi ve status sayfasi

`/status` herkese acik durum sayfasidir. Web uygulamasi, PostgreSQL ve Supabase API durumunu canli kontrol eder.

`/dashboard/sistem-sagligi` yonetici ekraninda su alanlar vardir:

- Canli sistem kontrolleri
- Bekleyen/onayli terminal cihazlari
- Sifre sifirlama talep gecmisi
- Yedek indir ve JSON yedekten geri yukle
- Gunluk/haftalik yonetici ozet mail alicilari

### Bildirimler

Dashboard icinde sag ustte bildirim merkezi vardir. Kullaniciya ozel gec kalma ve fazla mesai uyarilari son mesai kayitlarindan otomatik uretilir. Mobil kabuk push notification izin ve token kaydi altyapisini hazirlar; `public.user_devices` tablosu cihaz tokenlarini saklar.

### Kullanici bazli tema

Dark/light tema tercihi artik kullanici profilinde `user_profiles.theme_preference` alaninda saklanir. Kullanici farkli cihazdan giris yaptiginda tema tercihi yeniden uygulanir.

### Fazla mesai yuvarlama

Mesai takip ekrani gercek net fazla mesai dakikasini korur; maas hesabina ise odeme kuralina gore yuvarlanmis sure gider:

- 1 sa 15 dk veya 1 sa 30 dk gercekte aynen gosterilir, maasa 1 saat islenir.
- 1 sa 45 dk ve uzeri bir sonraki saate yuvarlanir, maasa 2 saat islenir.
- 60 dakikadan kisa ama pozitif fazla mesai maas detayinda 1 saat olarak islenir.

Personel maas PDF'inde "gercek sure" ve "maasa islenen sure" ayrimi aciklamada gorunur.

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

Internet yokken masaustu uygulamasi bos Chromium hata sayfasi yerine kendi baglanti uyarisi ekranini acar. Bu ekranda "Yeniden yukle" butonu bulunur; baglanti geri geldiginde butona basildiginda uygulama ana siteyi tekrar yukler. Bu davranis `v0.1.5` ve sonraki masaustu surumlerinde vardir.

## iOS ve Android Mobil Uygulama

Mobil uygulama Capacitor tabanlidir ve `wasy.system.hesap` bundle/package id degeriyle hazirlanmistir. Uygulama production web adresi olan `https://pamukkaleturizm.info` uzerinden calisir; ancak yalnizca bos bir WebView paketi degildir. Native mobil kabuk su ozellikleri ekler:

- Native alt menü: Panel, Mesai, Takip, Vardiya ve Maas ekranlarina hizli gecis
- Internet yokken uygulama ici offline ekran ve `Yeniden yukle` butonu
- Baglanti geri geldiginde bekleyen guvenlik kayitlarini otomatik senkronize etme
- Push notification izin, cihaz token kaydi ve bildirim aksiyonu altyapisi
- Local notification altyapisi
- PDF rapor butonlari mobilde de rapor/print akisini acar; iOS/Android paylas veya yazdir ekranindan PDF olarak kaydedilebilir
- Kamera izni ve terminal QR okutma akisi
- Haptic geri bildirim
- Native splash screen ve status bar ayarlari
- iOS ve Android app iconlari icin W logosu
- Android backup kapali, cleartext HTTP kapali
- Sifre sifirlama, gizlilik politikasi, destek ve veri silme sayfalari

Mobil komutlar:

```bash
npm run mobile:assets
npm run mobile:sync
npm run mobile:open:android
npm run mobile:open:ios
```

Android debug/release build icin makinede JDK 17+ ve Android SDK kurulu olmali, `JAVA_HOME` ile `ANDROID_HOME` tanimli olmalidir:

```powershell
cd android
.\gradlew.bat assembleDebug
```

iOS build ve App Store upload icin macOS + Xcode gerekir:

```bash
npm run mobile:open:ios
```

Xcode icinde:

1. Team secilir.
2. Bundle identifier `wasy.system.hesap` olarak korunur.
3. Signing & Capabilities altinda Push Notifications etkinlestirilir.
4. Gerekirse Background Modes > Remote notifications acilir.
5. Archive alinir ve App Store Connect'e yuklenir.

Android Play Store upload icin:

1. Play Console hesabi: `Wasy Systems`.
2. Paket adi/applicationId: `wasy.system.hesap`.
3. Release imzasi `android/keystore.properties` uzerinden okunur; keystore ve sifre dosyalari git'e eklenmez.
4. AndroidManifest uzerinde kamera, internet ve bildirim izinleri tanimlidir.
5. Hassas is verileri icin Android backup kapali, cleartext HTTP kapali tutulur.
6. AAB uretmek icin:

```powershell
cd android
.\gradlew.bat bundleRelease
```

Uretilen dosya:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

Bu AAB Play Console'da yeni uygulama surumu olarak yuklenir.

### Mobil Magaza Bilgileri

Gizlilik politikasi:

```text
https://pamukkaleturizm.info/privacy-policy
```

Destek URL:

```text
https://pamukkaleturizm.info/mobile-support
```

Veri silme URL:

```text
https://pamukkaleturizm.info/data-deletion
```

Sifre sifirlama URL:

```text
https://pamukkaleturizm.info/auth/sifremi-unuttum
```

Magaza aciklamasi, veri guvenligi onerileri, App Store inceleme notlari ve ekran goruntusu listesi:

```text
docs/store-listing.md
```

App Store ve Play Store'a gondermeden once mutlaka bir inceleme test hesabi olusturun ve magaza notlarina ekleyin. Apple, hesaba dayali uygulamalarda inceleme ekibinin tum ozelliklere erisebilmesini ister.

Play Console zorunlu kontrol listesi:

- Privacy Policy: `https://pamukkaleturizm.info/privacy-policy`
- Data deletion/account deletion: `https://pamukkaleturizm.info/data-deletion`
- App access: test TC, sifre ve rol bilgisi
- Data Safety: isim, e-posta, TC, finansal kayitlar, mesai/vardiya verileri, push tokeni ve uygulama aktivitesi isaretlenir
- Permissions: Camera, Notifications, Internet
- Ads: uygulamada reklam yoksa "No" secilir
- Target audience: sirket ici is uygulamasi olarak cocuklara yonelik degil

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
- `/auth/giris` TC ve sifre ile dashboard veya mesai akisini dogru yonlendiriyor mu?
- `/auth/sifremi-unuttum` TC ile reset maili istegini aliyor mu?
- `/auth/sifre-sifirla` e-posta linkinden gelen kullaniciya yeni sifre kaydettiriyor mu?
- `/privacy-policy`, `/mobile-support`, `/data-deletion` public olarak 200 donuyor mu?
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
    auth/                         Mesai auth ve sifre sifirlama API route'lari
    terminal/qr/                  Dinamik terminal QR API route'u
    personel/scan-terminal/       QR okutma ve check-in/check-out route'u
    dashboard/vardiya/            Vardiya planlama API route'u
    dashboard/mesai-takip/        Mesai takip API route'u
    personel-mesai/               Mesai admin API route'lari
  auth/giris/                     Dashboard girisi
  auth/sifremi-unuttum/           TC ile sifre sifirlama istegi
  auth/sifre-sifirla/             E-postadan yeni sifre belirleme
  dashboard/
    vardiya/                      Vardiya takvimi
    mesai-takip/                  Sube bazli mesai takip
    ayarlar/                      Personel ve sistem ayarlari
  login/                          Eski route; auth/giris sayfasina yonlendirir
  dashboard/mesai/                Dashboard icinden QR okutma
  mesai-qr/                       Personel kamera ile terminal QR okutma
  terminal/                       Sabit terminal QR ekrani
  personel-mesai/                 Admin personel mesai paneli
  privacy-policy/                 Gizlilik politikasi
  mobile-support/                 Mobil destek sayfasi
  data-deletion/                  Veri silme talebi sayfasi

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

### `.exe` internet yokken beyaz hata sayfasi aciyor

`v0.1.5` ve sonraki surumlerde masaustu uygulamasi internet yokken kendi "Internet baglantisi yok" ekranini acar. Baglanti geri geldiginde "Yeniden yukle" butonuna tiklayin. Eski surumlerde bu ekran yoksa yeni installer release'ine guncelleyin.

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
2. Personellerin `/auth/giris` uzerinden giris yapmasini saglayin.
3. Personeller `/mesai-qr` ekraninda terminal QR'ini okutsun.
4. Yonetici `/dashboard/mesai-takip` ekranindan gec kalanlari ve fazla mesaileri kontrol etsin.
5. Gerekirse PDF rapor alin.

### Fazla Mesaiyi Maasa Yansitma

1. Personelin ayarlar ekraninda `saatlik_mesai_ucreti` degerini girin.
2. Personel QR mesai sistemiyle giris cikis yaptikca Mesai Takip ekraninda net fazla mesai olusur.
3. `/dashboard/maaslar` sayfasinda ilgili ay ve subeyi acin.
4. Sistem net fazla mesai dakikasini ekranda aynen gosterir, maasa ise odeme kuralina gore yuvarlanmis saati ekler.
5. Personel PDF'i alin; PDF'de mesai kaynagi, gercek sure, maasa islenen sure, saatlik ucret ve tutar gorunur.

Hesap ornegi:

```text
8 sa 37 dk = 517 dakika
517 dakika ekranda 8 sa 37 dk gorunur
37 dk, 45 dk altinda kaldigi icin maasa 8 saat islenir
8 x 116,77 TL = fazla mesai tutari
```

Ekranda sure `8 sa 37 dk` olarak gosterilir; tutar hesabi maas kuralindaki saat yuvarlamasiyla yapilir. `8 sa 45 dk` olsaydi maasa `9 saat` islenirdi.

## Lisans

Bu proje kapali kaynak/proprietary lisanslidir. Izinsiz indirme, kullanim, kopyalama, degistirme, yayinlama ve yeniden dagitim yasaktir. Detaylar icin `LICENSE` dosyasina bakin.
