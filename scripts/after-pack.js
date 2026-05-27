const fs = require("fs")
const path = require("path")

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return

  const projectDir = context.projectDir || context.packager?.projectDir || process.cwd()
  const iconPath = path.join(projectDir, "desktop", "build", "icon.ico")
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)

  if (!fs.existsSync(iconPath)) {
    throw new Error(`Windows ikon dosyasi bulunamadi: ${iconPath}`)
  }

  if (!fs.existsSync(exePath)) {
    throw new Error(`Paketlenen exe bulunamadi: ${exePath}`)
  }

  const { rcedit } = await import("rcedit")
  const appVersion = context.packager.appInfo.version

  await rcedit(exePath, {
    icon: iconPath,
    "file-version": appVersion,
    "product-version": appVersion,
    "version-string": {
      CompanyName: "Hesap",
      FileDescription: "Hesap",
      ProductName: "Hesap",
      OriginalFilename: "Hesap.exe",
      InternalName: "Hesap",
    },
  })

  console.log(`Windows W ikonu exe icine islendi: ${exePath}`)
}
