# Hesap Windows Uygulamasi

Bu klasor Hesap web uygulamasini Windows `.exe` olarak paketlemek icin kullanilir.

## Mantik

Windows uygulamasi Electron tabanli ince bir kabuktur. Uygulama acildiginda `https://pamukkaleturizm.info` adresini yukler. Bu yuzden web sitesinde yapilan normal guncellemeler, kullanici uygulamayi actiginda otomatik olarak gorunur.

Masaustu kabugunda yeni bir degisiklik yapildiginda ise GitHub Releases uzerinden otomatik guncelleme calisir.

## Lokal Test

```bash
npm run desktop:dev
```

Lokal Next.js sunucusunu acip masaustu uygulamasinda onu test etmek icin:

```powershell
$env:HESAP_DESKTOP_URL="http://localhost:3000"; npm run desktop:dev
```

## .exe Uretme

```bash
npm run desktop:dist
```

Installer dosyasi su klasore cikar:

```text
desktop/release/
```

## Otomatik Guncelleme

Otomatik guncelleme `electron-updater` ve GitHub Releases ile calisir.

Yeni bir masaustu surumu yayinlamak icin:

1. `package.json` icindeki `version` degerini artirin.
2. GitHub token tanimlayin.
3. Publish komutunu calistirin.

```powershell
$env:GH_TOKEN="github_token_degeri"; npm run desktop:publish
```

Kullanici `.exe` uygulamasini actiginda yeni release varsa:

1. "Yeni guncelleme var" mesaji gorur.
2. "Guncelle" butonuna tiklar.
3. Yeni installer indirilir.
4. Uygulama yeniden baslar ve guncelleme kurulur.
