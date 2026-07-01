# Expo Go ile iPhone Test

Bu yöntem Apple certificate, provisioning profile ve TestFlight beklemeden hızlı iPhone testi içindir.

## Kullanım

1. iPhone'a App Store'dan **Expo Go** kur.
2. Bu repoda terminal aç.
3. Çalıştır:

```bash
npm install --prefix expo-go
npm run expo:go
```

4. Terminalde çıkan QR kodu Expo Go ile okut.

## Ne test edilir?

- iOS mobil görünüm
- Login
- Yeni cihaz doğrulama kodu
- Salt okunur genel bakış
- Personelin sadece kendi maaşını görmesi

## Sınır

Expo Go yayın sistemi değildir. App Store/TestFlight için Apple Developer imzası yine gerekir. Bu kurulum sadece hızlı test ve demo içindir.

