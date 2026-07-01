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

## EAS ile TestFlight

Expo hesabına giriş ve Apple eşleştirmesi yapılınca TestFlight'a göndermek için:

```bash
npm run eas:login
npm run eas:init
npm run eas:testflight
```

Eğer build alındı ama submit ayrıca yapılacaksa:

```bash
npm run eas:build:ios
npm run eas:submit:ios
```

İlk çalıştırmada EAS Apple Developer hesabını, takımını, bundle id'yi ve imzalama bilgilerini sorar. Bundle ID `wasy.system.hesap` olarak ayarlandı.
