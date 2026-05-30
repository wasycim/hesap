# Hesap Mobil Magaza Yayin Metinleri

Son guncelleme: 30 Mayis 2026

## Uygulama Adi

Hesap

## Paket / Bundle

- Android package id: `wasy.system.hesap`
- iOS bundle id: `wasy.system.hesap`
- Play Console hesabi: `Wasy Systems`

## Kisa Aciklama

Sube, rapor, vardiya, QR mesai ve maas takibini tek uygulamada yonetin.

## Uzun Aciklama

Hesap; isletmelerin sube bazli finansal kayitlarini, personel vardiyalarini, QR destekli mesai giris cikislarini ve maas hesaplarini tek panelden yonetmesi icin gelistirilmis guvenli bir is uygulamasidir.

Uygulama yalnizca bir web sitesini gostermek icin tasarlanmamistir. iOS ve Android surumleri native alt menu, offline baglanti ekrani, baglanti geri geldiginde senkronizasyon, push bildirim altyapisi, yerel bildirimler, haptic geri bildirim, kamera ile QR okuma, sifre sifirlama ve cihaz durumuna gore guvenli yeniden yukleme akisi icerir.

One cikan ozellikler:

- TC ve sifre ile guvenli giris
- TC ile e-posta uzerinden sifre sifirlama
- Sabit terminal QR kodu ile personel mesai giris/cikis
- Yalnizca onayli terminal cihazlarinda QR uretme
- Sube bazli mesai takip ekrani
- Gunluk, haftalik, aylik ve ozel aralik vardiya planlama
- Fazla mesai, gec kalma ve vardiya oncesi mesai hesaplari
- Maas ekraninda fazla mesai tutarlarini otomatik hesaplama
- PDF raporlama
- Public sistem durum sayfasi ve yonetici sistem sagligi paneli
- Yedekleme ve geri yukleme paneli
- Native mobil alt menu
- Internet yokken offline sayfa ve yeniden yukleme
- Push ve yerel bildirim altyapisi
- Kamera ile QR okutma
- Koyu/acik tema ve responsive tasarim

## Anahtar Kelimeler

mesai, vardiya, personel, maas, QR, sube, rapor, cari, gider, gelir, isletme

## Kategori

Business / Is

## Yas Derecelendirme Notu

Uygulama cocuklara yonelik degildir. Sirket ici is verileri, personel bilgileri ve finansal kayitlar icerir.

## URL'ler

Gizlilik politikasi:

```text
https://pamukkaleturizm.info/privacy-policy
```

Destek:

```text
https://pamukkaleturizm.info/mobile-support
```

Veri silme / hesap silme talebi:

```text
https://pamukkaleturizm.info/data-deletion
```

Sifre sifirlama:

```text
https://pamukkaleturizm.info/auth/sifremi-unuttum
```

## Google Play Data Safety Onerisi

Uygulama veri toplar:

- Personal info: isim, e-posta, TC kimlik
- Financial info: maas, avans, gelir/gider kayitlari
- App activity: mesai giris cikis, rapor ve guvenlik olaylari
- Device or other IDs: push bildirim tokeni
- Device or other IDs: terminal cihaz eslestirme anahtari

Kullanim amaclari:

- App functionality
- Account management
- Analytics / internal operational reporting
- Fraud prevention, security, and compliance

Veriler sifreli aktarilir. Kullanici verileri uygulama islevi, hesap yonetimi ve guvenlik icin islenir. Veriler reklam takibi icin kullanilmaz ve satilmaz.

## Android Izinleri

- Internet: uygulama API ve Supabase servislerine baglanir.
- Camera: personel terminal QR kodunu okutur.
- Notifications: mesai, rapor ve guvenlik bildirimleri icin kullanilir.

AndroidManifest ayarlari:

- `android:allowBackup="false"`
- `android:usesCleartextTraffic="false"`
- Package id: `wasy.system.hesap`

## Apple App Privacy Onerisi

Toplanan veri kategorileri:

- Contact Info: e-posta ve ad soyad
- Identifiers: kullanici id, TC kimlik, push token
- User Content: finansal kayitlar, rapor kayitlari
- Diagnostics: hata ve guvenlik olaylari
- Other Data: vardiya, mesai ve sube kayitlari

Kullanim amaclari:

- App Functionality
- Account Management
- Analytics / internal operational reporting
- Fraud Prevention, Security, and Compliance

Veriler ucuncu taraf reklam takibi icin kullanilmaz.

## Inceleme Notlari

Apple/Google incelemesi icin test hesabi olusturulmali ve su bilgiler App Store Connect / Play Console notlarina eklenmelidir:

```text
Test kullanici:
TC:
Sifre:
Rol: Yonetici

Test akisi:
1. /auth/giris uzerinden giris yapin.
2. Mobil alt menuden Mesai, Mesai Takip, Vardiya ve Maas ekranlarini acin.
3. Internet kapatildiginda offline ekrani ve yeniden yukle butonunu kontrol edin.
4. Kamera izniyle QR okutma ekranini acin.
5. Bildirim izni istendiginde izin vererek native bildirim akisini dogrulayin.
6. /auth/sifremi-unuttum ekraninda TC ile sifre sifirlama istegini kontrol edin.
7. /privacy-policy, /mobile-support, /data-deletion ve /status sayfalarinin acildigini kontrol edin.
```

## Gerekli Gorsel Varliklar

- App icon: `public/iconw.png`
- iOS screenshots: 6.7", 6.5" ve 5.5" ekranlar
- Android screenshots: phone ve tablet
- Feature graphic: 1024x500
