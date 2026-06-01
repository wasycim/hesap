# Mac olmadan iPhone'da test etme

Bu proje iOS tarafinda Capacitor kullanir. Mac bilgisayar olmadan gercek iPhone'da test etmek icin en temiz yol Codemagic uzerinden bulut Mac build alip App Store Connect/TestFlight'a yuklemektir.

## Sonuc

Akis su sekilde calisir:

1. Kod GitHub'da durur.
2. Codemagic repo'yu alir.
3. Bulut Mac uzerinde iOS `.ipa` build eder.
4. `.ipa` App Store Connect'e yuklenir.
5. iPhone'da TestFlight uygulamasindan Hesap'i kurarsin.

Bu yontemde lokal Mac gerekmez.

## Sende gerekli olanlar

- Apple Developer Program hesabi.
- App Store Connect'te `Hesap` app kaydi.
- Bundle ID: `wasy.system.hesap`
- Codemagic hesabi.
- Codemagic'e baglanmis GitHub repo: `wasycim/hesap`
- Codemagic iOS code signing ayari.
- iPhone'da TestFlight uygulamasi.

## App Store Connect hazirligi

1. App Store Connect'e gir.
2. `Apps > New App` sec.
3. Platform: iOS
4. Name: `Hesap`
5. Primary language: Turkish veya English
6. Bundle ID: `wasy.system.hesap`
7. SKU: `wasy-system-hesap`
8. App kaydini olustur.

Olusan Apple ID degerini not al. Bu degeri Codemagic'te `APP_STORE_APP_ID` olarak ekleyeceksin.

## App Store Connect API key

1. App Store Connect > Users and Access > Integrations > App Store Connect API.
2. Yeni key olustur.
3. Role: `App Manager`
4. `.p8` dosyasini indir.
5. Key ID ve Issuer ID degerlerini not al.

## Codemagic ortam degiskenleri

Codemagic'te uygulamaya gir:

`App settings > Environment variables`

`app_store_connect` adinda bir grup olustur ve sunlari ekle:

```text
APP_STORE_CONNECT_PRIVATE_KEY
APP_STORE_CONNECT_KEY_IDENTIFIER
APP_STORE_CONNECT_ISSUER_ID
APP_STORE_APP_ID
```

Aciklama:

- `APP_STORE_CONNECT_PRIVATE_KEY`: indirdigin `.p8` dosyasinin tum icerigi.
- `APP_STORE_CONNECT_KEY_IDENTIFIER`: Key ID.
- `APP_STORE_CONNECT_ISSUER_ID`: Issuer ID.
- `APP_STORE_APP_ID`: App Store Connect'teki Hesap uygulamasinin Apple ID degeri.

## Codemagic iOS imzalama

iOS uygulama gercek iPhone'da calismak icin Apple tarafindan imzalanmis olmalidir. Bu yuzden Codemagic'te su imzalama ayarini da yap:

1. Codemagic > Team settings > `codemagic.yaml settings > Code signing identities` alanina gir.
2. `iOS certificates` bolumunde Apple Distribution sertifikasini ekle veya Apple Developer Portal'dan fetch et.
3. `iOS provisioning profiles` bolumunde `wasy.system.hesap` Bundle ID icin App Store profile ekle veya fetch et.
4. Sertifika ve profil ayni Apple Team'e ait olmali.
5. Codemagic uygulama ayarlarinda Apple Developer Portal / App Store Connect entegrasyonunun aktif oldugunu kontrol et.

Bu proje kokundeki `codemagic.yaml`, `ios_signing` ayariyla `wasy.system.hesap` icin App Store imzalama dosyalarini kullanacak sekilde hazirlandi.

## Codemagic build calistirma

1. Codemagic'te `wasycim/hesap` reposunu ekle.
2. Branch olarak `main` sec.
3. Workflow olarak `iOS TestFlight - Hesap` sec.
4. Build baslat.

Build sonunda:

- Artifact olarak `.ipa` uretilir.
- App Store Connect'e yuklenir.
- Build TestFlight tarafinda processing'e girer.

## iPhone'da kurma

1. iPhone'a TestFlight uygulamasini indir.
2. App Store Connect > TestFlight > Internal Testing bolumune kendi Apple ID e-postani ekle.
3. Build processing tamamlaninca TestFlight'ta Hesap gorunur.
4. `Install` diyerek telefona kur.

## Neden bu yontem

- iOS uygulama gercek cihazda calismak icin Apple imzasi ister.
- Apple imzali `.ipa` uretmek icin Xcode/macOS gerekir.
- Codemagic bu macOS build ortamlarini bulutta verir.
- TestFlight, kendi iPhone'unda en problemsiz ve Apple'in resmi test yoludur.

## Notlar

- `codemagic.yaml` repo kokunde hazirdir.
- iOS project: `ios/App/App.xcodeproj`
- Scheme: `App`
- Bundle ID: `wasy.system.hesap`
- Workflow, internal TestFlight icin `testFlightInternalTestingOnly` export ayarini kullanir.
- Ilk upload sonrasi App Store Connect'te gizlilik, kategori ve ekran goruntusu alanlarini manuel tamamlaman gerekebilir.

## Faydali resmi dokumanlar

- Codemagic Ionic/Capacitor build: https://docs.codemagic.io/yaml-quick-start/building-an-ionic-app/
- Codemagic iOS signing: https://docs.codemagic.io/yaml-code-signing/signing-ios/
- Codemagic App Store Connect publishing: https://docs.codemagic.io/yaml-publishing/app-store-connect/
