const fs = require("fs")
const path = require("path")
const sharp = require("sharp")

const root = path.resolve(__dirname, "..")
const source = path.join(root, "public", "iconw.png")

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true })
}

async function writePng(target, size, options = {}) {
  await ensureDir(path.dirname(target))
  let image = sharp(source).resize(size, size, { fit: "cover" })
  if (options.background) image = image.flatten({ background: options.background })
  if (options.opaque) image = image.flatten({ background: options.opaqueBackground || "#0b0f16" }).removeAlpha()
  await image.png().toFile(target)
}

async function main() {
  await writePng(path.join(root, "mobile-shell", "icon.png"), 1024, { opaque: true })
  await writePng(path.join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"), 1024, { opaque: true })

  const androidIcons = [
    ["mipmap-mdpi", 48],
    ["mipmap-hdpi", 72],
    ["mipmap-xhdpi", 96],
    ["mipmap-xxhdpi", 144],
    ["mipmap-xxxhdpi", 192],
  ]

  for (const [folder, size] of androidIcons) {
    const base = path.join(root, "android", "app", "src", "main", "res", folder)
    await writePng(path.join(base, "ic_launcher.png"), size)
    await writePng(path.join(base, "ic_launcher_round.png"), size)
    await writePng(path.join(base, "ic_launcher_foreground.png"), size)
  }

  const splashTargets = [
    ["drawable", 512],
    ["drawable-land-mdpi", 512],
    ["drawable-land-hdpi", 768],
    ["drawable-land-xhdpi", 1024],
    ["drawable-land-xxhdpi", 1536],
    ["drawable-land-xxxhdpi", 2048],
    ["drawable-port-mdpi", 512],
    ["drawable-port-hdpi", 768],
    ["drawable-port-xhdpi", 1024],
    ["drawable-port-xxhdpi", 1536],
    ["drawable-port-xxxhdpi", 2048],
  ]

  for (const [folder, size] of splashTargets) {
    await writePng(path.join(root, "android", "app", "src", "main", "res", folder, "splash.png"), size)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
