const fs = require("fs")
const path = require("path")
const pngToIcoModule = require("png-to-ico")
const pngToIco = pngToIcoModule.default || pngToIcoModule

async function main() {
  const root = path.resolve(__dirname, "..")
  const sourcePng = path.join(root, "public", "apple-icon.png")
  const outputDir = path.join(root, "desktop", "build")
  const outputPng = path.join(outputDir, "icon.png")
  const outputIco = path.join(outputDir, "icon.ico")

  if (!fs.existsSync(sourcePng)) {
    throw new Error(`Logo bulunamadi: ${sourcePng}`)
  }

  fs.mkdirSync(outputDir, { recursive: true })
  fs.copyFileSync(sourcePng, outputPng)

  const ico = await pngToIco(sourcePng)
  fs.writeFileSync(outputIco, ico)

  console.log(`Desktop icon olusturuldu: ${outputIco}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
