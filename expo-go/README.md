# Hesap iOS TestFlight

Bu klasör Hesap mobil uygulamasının iOS TestFlight paketini üretmek için kullanılır. Uygulama adı ekranda yalnızca `Hesap` olarak görünür.

## TestFlight'a gönderme

Ana repo kökünden:

```bash
npm run eas:testflight
```

Bu komut iOS production build alır ve bittiğinde App Store Connect / TestFlight tarafına otomatik gönderir.

## Ayrı build ve submit

```bash
npm run eas:build:ios
npm run eas:submit:ios
```

## Sürüm

Mobil iOS sürümü `2.0.0` olarak ayarlandı. EAS build numarası production profilinde otomatik artar.
