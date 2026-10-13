const fs = require("fs")
const path = require("path")
const pngToIcoModule = require("png-to-ico")
const sharp = require("sharp")
const pngToIco = pngToIcoModule.default || pngToIcoModule

async function main() {
  const root = path.resolve(__dirname, "..")
  const sourcePng = path.join(root, "public", "iconw.png")
  const outputDir = path.join(root, "desktop", "build")
  const outputPng = path.join(outputDir, "icon.png")
  const outputIco = path.join(outputDir, "icon.ico")
  const appIcon = path.join(root, "app", "icon.png")
  const appAppleIcon = path.join(root, "app", "apple-icon.png")

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Logo bulunamadi: ${sourcePng}`)
  }

  fs.mkdirSync(outputDir, { recursive: true })

  const iconBuffer = await sharp(sourcePng)
    .extract({ left: 202, top: 250, width: 620, height: 620 })
    .resize(1024, 1024, {
      fit: "cover",
      kernel: "lanczos3",
    })
    .png()
    .toBuffer()

  fs.writeFileSync(outputPng, iconBuffer)
  fs.writeFileSync(appIcon, iconBuffer)
  fs.writeFileSync(appAppleIcon, iconBuffer)

  const ico = await pngToIco(iconBuffer)
  fs.writeFileSync(outputIco, ico)

  console.log(`Desktop icon olusturuldu: ${outputIco}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
