# Hesap Expo Go Önizleme

Bu klasör iPhone'da hızlı test için Expo Go istemcisidir. App Store/TestFlight yayını değildir; canlı `pamukkaleturizm.info/mobile` ekranını güvenli mobil kabuk içinde açar.

## Çalıştırma

Ana repo kökünden:

```bash
npm run expo:go
```

veya bu klasörde:

```bash
npm install
npm run start
```

Terminalde çıkan QR kodu iPhone'daki Expo Go uygulamasıyla okut.

## Davranış

- Başlangıç adresi: `https://pamukkaleturizm.info/mobile?native=expo-ios`
- Sunucu `hesap-native-platform=ios` cookie'sini set eder.
- `/dashboard` yönlendirmeleri engellenir, kullanıcı mobil genel bakış ve maaş ekranında tutulur.
- Dış linkler telefon tarayıcısına açılır.

## Not

Expo Go, Expo'nun kendi uygulaması içinde çalışan önizlemedir. Kalıcı iOS dağıtımı için TestFlight/EAS build gerekir.

