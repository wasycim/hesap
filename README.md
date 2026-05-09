# Hesap Rapor Sistemi

Hesap Rapor Sistemi, sube bazli gelir, gider, kargo cari, corba, ortak/personel payi, kullanici ve guvenlik takibi yapan bir Next.js uygulamasidir. Uygulama Supabase Auth, Supabase Postgres, Row Level Security politikalar, Vercel deployment ve responsive dashboard yapisi uzerine kuruludur.

Bu dokuman projeyi sifirdan kurmak, gelistirmek, veritabani scriptlerini dogru sirayla calistirmak, kullanici/rol mantigini anlamak ve uygulamanin sayfalarini yonetmek icin hazirlanmistir.

## Icerik

- [Teknik Ozet](#teknik-ozet)
- [Proje Yapisi](#proje-yapisi)
- [Kurulum](#kurulum)
- [Ortam Degiskenleri](#ortam-degiskenleri)
- [Supabase Veritabani Kurulumu](#supabase-veritabani-kurulumu)
- [Calistirma Komutlari](#calistirma-komutlari)
- [Kimlik Dogrulama ve Yetkiler](#kimlik-dogrulama-ve-yetkiler)
- [Sube Sistemi](#sube-sistemi)
- [Sayfalar ve Moduller](#sayfalar-ve-moduller)
- [Gelir Tablosu](#gelir-tablosu)
- [Gider Tablosu](#gider-tablosu)
- [Kargo Cari](#kargo-cari)
- [Corbalar](#corbalar)
- [Ayarlar](#ayarlar)
- [Sutun Ayarlari](#sutun-ayarlari)
- [Gorunum Ayarlari](#gorunum-ayarlari)
- [Guvenlik Ayarlari](#guvenlik-ayarlari)
- [Admin Ayarlari](#admin-ayarlari)
- [Mobil ve PWA Davranisi](#mobil-ve-pwa-davranisi)
- [Onemli Is Kurallari](#onemli-is-kurallari)
- [Deployment](#deployment)
- [Dogrulama ve Test](#dogrulama-ve-test)
- [Bakim ve Gelistirme Notlari](#bakim-ve-gelistirme-notlari)
- [Sorun Giderme](#sorun-giderme)

## Teknik Ozet

| Alan | Teknoloji |
| --- | --- |
| Framework | Next.js 16 App Router |
| UI | React 19, Tailwind CSS 4, shadcn/ui tabanli Radix componentleri |
| Auth | Supabase Auth |
| Veritabani | Supabase Postgres |
| Realtime | Supabase realtime kanallari |
| Ikonlar | lucide-react |
| Bildirimler | sonner |
| PWA | `app/manifest.ts`, viewport ve Apple web app ayarlari |
| Deployment | Vercel uyumlu |
| Dil | Uygulama arayuzu Turkce |

## Proje Yapisi

```text
app/
  api/
    admin/
      branch-shift-warnings/   Admin vardiya uyarilari API rotasi
      users/                   Admin kullanici yonetimi API rotasi
    security-events/           Guvenlik olaylari API rotasi
  auth/
    giris/                     Giris sayfasi
    callback/                  Supabase auth callback rotasi
    error/                     Auth hata sayfasi
  dashboard/
    page.tsx                   Ana genel bakis ekrani
    gelir/                     Gelir tablosu sayfasi
    gider/                     Gider tablosu sayfasi
    corbalar/                  Corba takip sayfasi
    kargo-cari/                Kargo cari ozet ve firma detay sayfalari
    ayarlar/                   Ortak, personel ve kargo firma ayarlari
    sutun-ayarlar/             Gelir/gider sutun gorunumu ve siralama
    gorunum-ayarlar/           Sube bazli menu gorunurlugu
    guvenlik-ayarlar/          Guvenlik olaylari ve risk gorunumu
    admin-ayarlar/             Kullanici, sube, rol, vardiya ve IP yonetimi
components/
  dashboard/
    sidebar.tsx                Sol menu, sube secimi, kargo cari alt menusu
    gelir-spreadsheet.tsx      Gelir tablosu is mantigi
    gider-spreadsheet.tsx      Gider tablosu is mantigi
  ui/                          Ortak UI componentleri
contexts/
  sube-context.tsx             Sube, admin ve vardiya context'i
  unsaved-changes-context.tsx  Kaydedilmemis degisiklikleri takip eder
lib/
  supabase/                    Client, server ve admin Supabase clientleri
  date-navigation.ts           Ay/yil ve tarih yardimcilari
  table-column-settings.ts     Varsayilan kolonlar ve kolon ayarlari
  audit-log.ts                 Guvenlik olay kaydi yardimcisi
scripts/
  001_create_tables.sql        Eski/ana tablo kurulum scripti
  002_column_settings.sql      Sube, kolon, kargo cari, corba RLS ve index scripti
  003_security_admin_settings.sql Admin, gorunum ve guvenlik tablolarinin scripti
public/
  iconw.png, iconw2.png        PWA ve mobil iconlar
  w-logo-*.svg                 Tema uyumlu logo dosyalari
```

## Kurulum

### Gereksinimler

- Node.js 20 veya daha yeni bir surum
- npm
- Supabase projesi
- Vercel hesabi, production deployment icin
- Git, kodu GitHub'a gondermek icin

### Depoyu klonlama

```bash
git clone https://github.com/wasycim/hesap.git
cd hesap
```

### Bagimliliklari kurma

```bash
npm install
```

### Lokal gelistirme sunucusu

```bash
npm run dev
```

Varsayilan adres:

```text
http://localhost:3000
```

## Ortam Degiskenleri

Proje Supabase clientlerini hem browser hem server tarafinda kullandigi icin public ve server-only degiskenlere ihtiyac duyar.

Kok dizinde `.env` veya Vercel ortam degiskenlerinde en az su degerler bulunmalidir:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Alternatif olarak admin client su degiskenleri de okuyabilir:

```env
SUPABASE_SECRET_KEY=
```

### Degiskenlerin Kullanildigi Yerler

| Degisken | Kullanim |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser ve server Supabase clientleri |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kullanici oturumu ve RLS uyumlu sorgular |
| `SUPABASE_URL` | Admin API rotalari icin server-side Supabase URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API rotalarinda service role yetkisi |
| `SUPABASE_SECRET_KEY` | `SUPABASE_SERVICE_ROLE_KEY` yerine fallback |

### Guvenlik Notu

`SUPABASE_SERVICE_ROLE_KEY` ve `SUPABASE_SECRET_KEY` kesinlikle client tarafina acilmamalidir. Bu degerler yalnizca server-side API route'larda kullanilir.

## Supabase Veritabani Kurulumu

SQL scriptleri Supabase SQL Editor icinde sirayla calistirilmalidir.

### 1. Ana Tablolar

```sql
scripts/001_create_tables.sql
```

Bu script eski/ana hesap tablolarini olusturur:

- `companies`
- `partners`
- `records`
- `company_amounts`
- `partner_shares`
- `record_summary`

### 2. Sube, Kolon, Kargo Cari ve Corba Ayarlari

```sql
scripts/002_column_settings.sql
```

Bu script modern dashboard yapisi icin kritik eklemeleri yapar:

- `kolon_ayarlari` tablosu
- `custom_values` JSONB alanlari
- `sube_id` alanlari
- kargo cari tablolarinin sube bazli benzersizlikleri
- corba tablosu sube baglantisi
- RLS politikalar
- performans indexleri

### 3. Admin, Gorunum ve Guvenlik

```sql
scripts/003_security_admin_settings.sql
```

Bu script sunlari ekler:

- `user_profiles.email`
- `user_profiles.updated_at`
- `sube_menu_izinleri`
- `security_events`
- gorunum ayarlari RLS politikasi
- guvenlik olaylari RLS politikasi
- adminlerin sube yonetebilmesi icin RLS politikasi

### RLS Mantigi

Uygulama Supabase Row Level Security ile calisir.

- Admin kullanici tum subeleri ve yonetim sayfalarini gorebilir.
- Normal kullanici kendi subesine ait verileri gorebilir.
- Normal kullanicilar genelde sadece kendi vardiyasi veya bugunun satirlari uzerinden calisir.
- Admin API rotalari service role key kullanir, ancak once oturumdaki kullanicinin admin olup olmadigini kontrol eder.

## Calistirma Komutlari

```bash
npm run dev
```

Lokal gelistirme sunucusunu baslatir.

```bash
npm run build
```

Production build olusturur. Deployment oncesi calistirilmasi onerilir.

```bash
npm run start
```

Build edilmis uygulamayi production modda baslatir.

```bash
npx tsc --noEmit
```

TypeScript tip kontrolu yapar.

### Lint Notu

`package.json` icinde `npm run lint` scripti vardir, ancak projede `eslint` paketi dev dependency olarak tanimli degilse bu komut calismaz. Su an ana dogrulama komutlari:

```bash
npx tsc --noEmit
npm run build
```

## Kimlik Dogrulama ve Yetkiler

Uygulama Supabase Auth kullanir.

### Giris Akisi

- Giris sayfasi: `/auth/giris`
- Auth callback: `/auth/callback`
- Dashboard korumasi: `middleware.ts` ve `app/dashboard/layout.tsx`

Kullanici giris yapmadiysa `/dashboard` altindaki sayfalara erisemez ve `/auth/giris` sayfasina yonlendirilir.

### Kullanici Profili

Uygulama yetki ve sube bilgisini `user_profiles` tablosundan okur.

Temel alanlar:

- `user_id`
- `email`
- `is_admin`
- `sube_id`
- `vardiya`
- `created_at`
- `updated_at`

### Roller

| Rol | Aciklama |
| --- | --- |
| Admin | Tum subeleri gorebilir, ayarlar ve admin sayfalarina erisir |
| Normal kullanici | Kendi subesine ve kendi vardiya/sayfa izinlerine gore calisir |

### Vardiya Degerleri

| Deger | Anlam |
| --- | --- |
| `S` | Sabah |
| `A` | Aksam |
| `T` | Tek vardiya veya tum vardiyalar |

Admin Ayarlari sayfasindan kullaniciya vardiya atanabilir.

## Sube Sistemi

Sube bilgisi `contexts/sube-context.tsx` icinde yonetilir.

Context su bilgileri saglar:

- `subeler`
- `currentSube`
- `userSube`
- `isAdmin`
- `currentUserId`
- `refreshKey`
- `userVardiya`

Admin kullanici sol menuden sube degistirebilir. Secilen sube `localStorage` icinde `current_sube_id` anahtari ile saklanir.

Normal kullanici kendi profilinde tanimli subeye sabitlenir.

## Sayfalar ve Moduller

| Route | Sayfa | Yetki |
| --- | --- | --- |
| `/dashboard` | Genel Bakis | Giris yapmis kullanici |
| `/dashboard/gelir` | Gelir Tablosu | Menu iznine gore |
| `/dashboard/gider` | Gider Tablosu | Menu iznine gore |
| `/dashboard/corbalar` | Corbalar | Menu iznine gore |
| `/dashboard/kargo-cari` | Kargo Cari Borc Ozeti | Admin |
| `/dashboard/kargo-cari/[firmaId]` | Firma bazli kargo cari | Menu iznine gore |
| `/dashboard/ayarlar` | Ortak, personel, kargo firma | Admin |
| `/dashboard/sutun-ayarlar` | Gelir/gider sutun ayarlari | Admin |
| `/dashboard/gorunum-ayarlar` | Sube bazli menu gorunurlugu | Admin |
| `/dashboard/guvenlik-ayarlar` | Guvenlik olaylari | Admin |
| `/dashboard/admin-ayarlar` | Kullanici ve sube yonetimi | Admin |
| `/dashboard/hesap` | Hesap ayarlari | Giris yapmis kullanici |

## Gelir Tablosu

Dosya:

```text
components/dashboard/gelir-spreadsheet.tsx
```

Gelir tablosu sube ve ay/yil bazli kayit tutar.

Baslica ozellikler:

- Ay/yil secimi
- Sabah/aksam vardiya destegi
- Tek vardiyali sube destegi
- Dinamik sutun ayarlari
- Realtime veri yenileme
- Gunluk gelir kalemleri
- Toplam ve kalan hesaplama
- Normal kullanicilar icin bugun ve kendi vardiya siniri

Gelir tablosu `gelir_kayitlari` tablosu uzerinden calisir.

## Gider Tablosu

Dosya:

```text
components/dashboard/gider-spreadsheet.tsx
```

Gider tablosu gelir tablosuna benzer sekilde sube, ay/yil ve vardiya bazli calisir.

Baslica ozellikler:

- Ortak paylari
- Personel paylari
- Dinamik kolon gruplari
- Ozel kolonlar
- Kargo cari gider kalemi
- Banka, bilet, yemek, iade vb. sabit gider kalemleri
- Genel toplam hesaplama
- Gelir tablosundaki `giderler` alanini ayni tarih/vardiya uzerinden guncelleme

Gider tablosu `gider_kayitlari` tablosu uzerinden calisir.

## Kargo Cari

Kargo cari iki ana bolumden olusur.

### Kargo Cari Borc Ozeti

Route:

```text
/dashboard/kargo-cari
```

Dosya:

```text
app/dashboard/kargo-cari/page.tsx
```

Admin kullanicilar tum aktif kargo cari firmalarinin:

- toplam borcunu
- odenen tutarini
- kalan borcunu

tek ekranda gorebilir.

Odemeler `kargo_cari_odemeler` tablosuna `sube_id + firma_id` benzersizligi ile kaydedilir.

### Firma Detay Sayfasi

Route:

```text
/dashboard/kargo-cari/[firmaId]
```

Dosya:

```text
app/dashboard/kargo-cari/[firmaId]/page.tsx
```

Firma detay sayfasinda her satir su alanlari tutar:

- tarih
- fis no
- gonderilen yer
- alinan tutar
- satilan tutar
- kalan kar

`kalan_kar = alinan_tutar - satilan_tutar`

### Kargo Cari Tarih Kurali

Kargo cari satir ekleme islemi klasik takvim gunune gore degil, is gunu kuralina gore tarih atar.

Kural:

- Saat `00:00` ile `03:30` dahil arasinda satir eklenirse bir onceki gunun tarihi kullanilir.
- Saat `03:31` ve sonrasinda satir eklenirse icinde bulunulan gunun tarihi kullanilir.
- Ayni anda tekrar tekrar satir eklenirse son tarihe `+1 gun` verilmez; her yeni satir ayni is gunu tarihini alir.

Ornekler:

| Islem zamani | Satira yazilan tarih |
| --- | --- |
| `09.05.2026 16:00` | `09.05.2026` |
| `10.05.2026 03:30` | `09.05.2026` |
| `10.05.2026 03:31` | `10.05.2026` |

Bu kural tum kargo cari firmalarinda gecerlidir.

## Corbalar

Route:

```text
/dashboard/corbalar
```

Dosya:

```text
app/dashboard/corbalar/page.tsx
```

Corbalar sayfasi personel bazli gunluk corba takibi icin kullanilir.

Baslica ozellikler:

- Ay/yil bazli listeleme
- Personel kolonlari
- Gunluk satir ekleme
- Toplam hesaplama
- Normal kullanici icin bugun siniri
- Realtime veri yenileme

Corbalar gorunum ayarlarindan gizlenirse:

- Sol menude gorunmez.
- Ana ekrandaki hizli erisim kutusu da gorunmez.
- Ana ekranda kalan kutular otomatik genisler ve ortalanir.

## Ayarlar

Route:

```text
/dashboard/ayarlar
```

Dosya:

```text
app/dashboard/ayarlar/page.tsx
```

Admin kullanicilar su listeleri yonetir:

- ortaklar
- personeller
- kargo cari firmalar

### Ortaklar

Ortaklar sube bazli listelenir. Bu sayede gider tablosunda gorunen ortaklar Ayarlar sayfasinda da yonetilebilir.

Ortak islemleri:

- yeni ortak ekleme
- aktif/pasif yapma
- silme

### Personeller

Personeller sube bazli listelenir.

Personel islemleri:

- yeni personel ekleme
- aktif/pasif yapma
- silme

### Kargo Cari Firmalar

Kargo cari firmalar sube bazli listelenir ve sol menude Kargo Cari altinda gorunur.

Firma islemleri:

- yeni firma ekleme
- aktif/pasif yapma
- firmayi ve kayitlarini silme

## Sutun Ayarlari

Route:

```text
/dashboard/sutun-ayarlar
```

Dosya:

```text
app/dashboard/sutun-ayarlar/page.tsx
```

Gelir ve gider tablolarindaki sutunlar admin tarafindan ayarlanabilir.

Ozellikler:

- Gelir tablosu sutunlari
- Gider tablosu sutunlari
- Sutun siralamasi
- Drag/drop siralama
- Sutun rengi secimi
- Sutun gizleme/gosterme
- Ozel sutun ekleme
- Ortaklar ve personeller icin grup sutunlari

Varsayilan kolonlar `lib/table-column-settings.ts` icinde tanimlidir.

Dinamik kayitlar `kolon_ayarlari` tablosunda saklanir.

## Gorunum Ayarlari

Route:

```text
/dashboard/gorunum-ayarlar
```

Dosya:

```text
app/dashboard/gorunum-ayarlar/page.tsx
```

Gorunum ayarlari sube bazli menu izinlerini yonetir.

Yonetilebilen menu anahtarlari:

- `dashboard`
- `gelir`
- `gider`
- `corbalar`
- `kargo_cari`

Kayitlar `sube_menu_izinleri` tablosunda tutulur.

### Gorunum Ayarinin Etkiledigi Yerler

Bir menu gizlendiginde:

- Sol menuden kaldirilir.
- Ana ekrandaki ilgili hizli erisim karti kaldirilir.
- Ana ekrandaki kart grid'i kalan kart sayisina gore yeniden dengelenir.

Ornek:

Corbalar gizlenirse ana ekranda Corbalar kutusu gorunmez. Gelir ve Gider kutulari iki kolon halinde genisler ve ortali bir gorunum alir.

## Guvenlik Ayarlari

Route:

```text
/dashboard/guvenlik-ayarlar
```

Dosya:

```text
app/dashboard/guvenlik-ayarlar/page.tsx
```

Guvenlik ayarlari adminlerin sistem olaylarini incelemesini saglar.

Kayitlar `security_events` tablosundan gelir.

Takip edilen olay tipleri:

- login
- logout
- password_change
- row_delete
- kargo_cari_delete
- ortak_delete
- person_delete
- user_create
- user_update
- user_delete
- branch_create
- visibility_update
- column_hide
- column_delete

### Guvenilir IP

Admin Ayarlari sayfasindan kullaniciya guvenilir IP listesi atanabilir.

Guvenilir IP listesi:

- kullanici metadata alaninda tutulur
- virgul, bosluk veya yeni satir ile ayrilabilir
- Guvenlik Ayarlari sayfasinda ilgili IP "Guvenli" etiketiyle gosterilir
- farkli IP risk analizinde guvenilir IP'ler dikkate alinmaz

## Admin Ayarlari

Route:

```text
/dashboard/admin-ayarlar
```

Dosya:

```text
app/dashboard/admin-ayarlar/page.tsx
```

Admin Ayarlari sayfasinda:

- kullanici eklenir
- kullanici silinir
- kullanici subesi degistirilir
- kullanici admin yapilir veya adminlik kaldirilir
- vardiya atanir
- gorunen ad duzenlenir
- guvenilir IP listesi duzenlenir
- yeni sube eklenir

Admin API rotasi:

```text
app/api/admin/users/route.ts
```

Yeni kullanici olusturuldugunda varsayilan sifre:

```text
123456
```

Production kullanimda kullanicidan ilk giristen sonra sifresini degistirmesi istenmelidir.

## Mobil ve PWA Davranisi

Uygulama mobil cihazlara ve PWA kullanima hazirlanmistir.

Ilgili dosyalar:

```text
app/layout.tsx
app/manifest.ts
public/iconw.png
public/iconw2.png
public/w-logo-light.svg
public/w-logo-dark.svg
```

Ozellikler:

- `viewportFit: "cover"`
- `themeColor` light/dark tema destegi
- Apple web app meta ayarlari
- `manifest.webmanifest`
- `standalone` display modu
- maskable icon destegi

Manifest icon yapisinda normal ve maskable iconlar ayri kayit olarak tutulur.

## Onemli Is Kurallari

### Kaydedilmemis Degisiklikler

`contexts/unsaved-changes-context.tsx` tablo sayfalarinda kaydedilmemis degisiklikleri takip eder.

Kaydetme handler'lari ilgili sayfalarda register edilir.

### Realtime Yenileme

Gelir, gider, corba ve kargo cari gibi sayfalar Supabase realtime kanallari ile veriyi yeniler.

### Sube Bazli Veri Ayrimi

Modern tablolar `sube_id` ile ayrilir:

- gelir kayitlari
- gider kayitlari
- ortaklar
- personeller
- kargo cari firmalar
- kargo cari kayitlar
- kargo cari odemeler
- corbalar
- kolon ayarlari
- menu izinleri

### Normal Kullanici Kisitlari

Normal kullanicilar:

- kendi subesine baglidir
- kendi vardiyasina gore islem yapar
- genellikle bugunun satirlarini duzenleyebilir
- admin sayfalarina erisemez

### Admin Kisitlari

Admin kullanicilar:

- tum subeleri gorebilir
- sube degistirebilir
- ayarlari yonetebilir
- kullanici yonetebilir
- guvenlik olaylarini inceleyebilir

## Deployment

Proje Vercel ile uyumludur.

### Vercel Ortam Degiskenleri

Vercel Project Settings altinda su degiskenler tanimlanmalidir:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Build Komutu

```bash
npm run build
```

### Output

Next.js App Router varsayilan output kullanilir. Ek bir export ayari yoktur.

### Google Fonts Notu

`app/layout.tsx` icinde `next/font/google` kullanilir. Build sirasinda Google Fonts'a erisim gerekir. Ag kapaliysa build font indirme adiminda hata verebilir.

## Dogrulama ve Test

Degisikliklerden sonra onerilen kontroller:

```bash
npx tsc --noEmit
npm run build
```

Basarili build su anlama gelir:

- Next.js production derlemesi tamamlandi
- App route'lari generate edildi
- Manifest route'u olustu
- Server/client import hatasi yok

Tip kontrolu su anlama gelir:

- TypeScript tipleri uyumlu
- Manifest gibi strict tipli alanlarda hata yok

## Bakim ve Gelistirme Notlari

### Git Akisi

Degisiklik yapmadan once:

```bash
git pull --ff-only origin main
```

Degisiklikten sonra:

```bash
npx tsc --noEmit
npm run build
git status
git add .
git commit -m "Aciklayici commit mesaji"
git push origin main
```

### Yeni Sayfa Eklerken

Yeni dashboard sayfasi eklenirse:

1. `app/dashboard/...` altina route eklenir.
2. Sol menude gorunecekse `components/dashboard/sidebar.tsx` icindeki menu listesine eklenir.
3. Gorunum ayarlarindan kontrol edilecekse `app/dashboard/gorunum-ayarlar/page.tsx` icindeki `MENU_OPTIONS` listesine eklenir.
4. Ana ekranda karti olacaksa `app/dashboard/page.tsx` icinde `canSeeMenu` ile baglanir.
5. Veritabani tablosu gerekiyorsa yeni SQL migration scripti eklenir.
6. RLS politikasi unutulmaz.

### Yeni Kolon Eklerken

Sabit kolon eklenecekse:

```text
lib/table-column-settings.ts
```

guncellenmelidir.

Tabloda deger tutulacaksa ilgili Supabase tablosuna kolon eklenmeli veya `custom_values` icinde saklanmalidir.

### Yeni Guvenlik Olayi Eklerken

1. `lib/audit-log.ts` event type listesi guncellenir.
2. Olayin yazildigi yerde `logSecurityEvent` cagrilir.
3. `app/dashboard/guvenlik-ayarlar/page.tsx` icinde label, icon ve ozet gerekiyorsa eklenir.

## Sorun Giderme

### Kullanici dashboard'a giremiyor

Kontrol edilecekler:

- Supabase Auth kullanicisi var mi?
- `user_profiles` kaydi var mi?
- `user_profiles.sube_id` dogru mu?
- Sube aktif mi?
- Middleware cookie yenileyebiliyor mu?

### Admin sayfalari gorunmuyor

Kontrol edilecekler:

- `user_profiles.is_admin = true` mi?
- Kullanici tekrar giris yapti mi?
- RLS politikalar calisti mi?

### Menu gizledim ama dashboard'da kutu duruyor

Beklenen davranis:

- Sol menu ve ana ekran kartlari `sube_menu_izinleri` tablosuna bakar.
- Degisiklikten sonra sayfa yenilenmeli veya sube context'i yeniden yuklenmelidir.
- Admin kullanicilar sol menude tum menu kalemlerini gorebilir; ana ekran kartlari secili sube gorunum ayarlarina gore davranir.

### Kargo cari tarih bekledigim gibi degil

Kargo cari satir tarihi sunu kullanir:

- `00:00` ile `03:30` dahil: onceki gun
- `03:31` ve sonrasi: bugun

Bilgisayar veya sunucu saatinin dogru oldugundan emin olun.

### Build Google Fonts hatasi veriyor

`next/font/google` build sirasinda font dosyalarina erisir. Internet kapaliysa veya Google Fonts engelliyse build hata verebilir.

Cozum:

- Ag erisimini acin.
- Gerekirse fontlari lokal self-host edecek sekilde degistirin.

### `npm run lint` calismiyor

`package.json` icinde lint scripti vardir, ancak `eslint` paketi dev dependency olarak ekli degilse komut bulunamaz.

Gecici ana kontrol:

```bash
npx tsc --noEmit
npm run build
```

Kalici cozum:

```bash
npm install -D eslint
```

Sonra proje icin uygun ESLint config'i eklenmelidir.

### Supabase admin islemleri hata veriyor

Kontrol edilecekler:

- `SUPABASE_SERVICE_ROLE_KEY` tanimli mi?
- Vercel ortam degiskenlerinde production icin ekli mi?
- API route server tarafinda mi calisiyor?
- Kullanici admin mi?

## Kisa Operasyon Rehberi

Yeni sube acmak:

1. Admin Ayarlari sayfasina gir.
2. Yeni sube ekle.
3. Kullaniciya sube ata.
4. Gerekirse Gorunum Ayarlari'ndan menu izinlerini duzenle.
5. Ayarlar sayfasindan ortak, personel ve kargo firmalarini ekle.
6. Sutun Ayarlari'ndan gelir/gider tablo duzenini ayarla.

Yeni kullanici acmak:

1. Admin Ayarlari sayfasina gir.
2. E-posta, gorunen ad, sube, rol ve vardiya sec.
3. Gerekirse guvenilir IP ekle.
4. Kullanici varsayilan `123456` sifresiyle girer.
5. Kullanici sifresini degistirmelidir.

Kargo cari firmasi eklemek:

1. Ayarlar sayfasina gir.
2. Kargo Cari Firmalar bolumunden firma ekle.
3. Firma aktifse sol menude Kargo Cari altinda gorunur.
4. Firma detayina girip satir ekle.
5. Kargo cari ozetinden odenen tutari takip et.

Corbalari bir subede kapatmak:

1. Gorunum Ayarlari sayfasina gir.
2. Ilgili subeyi sec.
3. Corbalar isaretini kaldir.
4. Kaydet.
5. Sol menu ve ana ekran kartlari buna gore guncellenir.

## Lisans

Bu proje MIT lisansi ile lisanslanmistir. Detaylar icin `LICENSE` dosyasina bakin.
