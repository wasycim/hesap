# iOS TestFlight Yayın Akışı

Bu repo, GitHub Actions üzerinden iOS `.ipa` üretip TestFlight'a yükleyecek şekilde hazırlanmıştır.

## Sabit uygulama bilgileri

- App adı: `Hesap`
- Bundle ID: `wasy.system.hesap`
- SKU önerisi: `hesap-ios`
- Minimum iOS: 15+

## Apple tarafında bir kere yapılacaklar

1. Apple Developer hesabında `wasy.system.hesap` Bundle ID oluştur.
2. App Store Connect'te `Hesap` için iOS app kaydı aç.
3. App Store Connect API key oluştur:
   - Key ID
   - Issuer ID
   - `.p8` private key
4. `wasy.system.hesap` için Apple Distribution sertifikası ve App Store provisioning profile oluştur.

## GitHub secrets

Repository → Settings → Secrets and variables → Actions → New repository secret alanına şunları ekle:

| Secret | Açıklama |
| --- | --- |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect Issuer ID |
| `APP_STORE_CONNECT_API_PRIVATE_KEY_BASE64` | `AuthKey_XXXX.p8` dosyasının base64 hali |
| `IOS_TEAM_ID` | Apple Developer Team ID |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Apple Distribution `.p12` dosyasının base64 hali |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | `.p12` export şifresi |
| `IOS_PROVISIONING_PROFILE_BASE64` | App Store `.mobileprovision` dosyasının base64 hali |

PowerShell ile dosyayı base64'e çevirme:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_XXXX.p8")) | Set-Clipboard
```

macOS terminal ile:

```bash
base64 -i AuthKey_XXXX.p8 | pbcopy
```

## TestFlight'a gönderme

GitHub → Actions → `Publish iOS TestFlight` → `Run workflow`.

- `version` boş bırakılırsa `package.json` versiyonu kullanılır.
- `changelog` TestFlight tester notu olarak gider.
- Build number otomatik olarak GitHub run number'dan gelir ve her çalıştırmada artar.

