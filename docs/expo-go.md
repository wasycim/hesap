# iOS TestFlight

Mobil uygulama TestFlight için EAS production profiliyle hazırlanır.

## Gönderme

```bash
npm run eas:login
npm run eas:testflight
```

Build tamamlanınca App Store Connect tarafında TestFlight processing başlar. Processing bittikten sonra TestFlight uygulamasında `Hesap` görünür.

## Sürüm

Mobil iOS sürümü `2.0.0` olarak ayarlandı. Build numarası EAS tarafından otomatik artırılır.
