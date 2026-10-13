const fs = require("fs")
const path = require("path")

const releaseDir = path.join(__dirname, "..", "desktop", "release")
const targetUpdatesDir = path.join(__dirname, "..", "public", "updates")

if (!fs.existsSync(targetUpdatesDir)) {
  fs.mkdirSync(targetUpdatesDir, { recursive: true })
}

if (!fs.existsSync(releaseDir)) {
  console.error("❌ desktop/release klasörü bulunamadı. Önce 'npm run desktop:dist' komutunu çalıştırın.")
  process.exit(1)
}

const files = fs.readdirSync(releaseDir)
const updateFiles = files.filter(f => f.endsWith(".yml") || f.endsWith(".exe") || f.endsWith(".blockmap"))

if (updateFiles.length === 0) {
  console.log("⚠️ Yayınlanacak güncelleme dosyası bulunamadı.")
  process.exit(0)
}

console.log(`📦 Güncelleme dosyaları kopyalanıyor (${updateFiles.length} dosya)...`)

for (const file of updateFiles) {
  const src = path.join(releaseDir, file)
  const dest = path.join(targetUpdatesDir, file)
  fs.copyFileSync(src, dest)
  console.log(`   ✓ ${file} -> public/updates/${file}`)
}

console.log("\n✅ Güncelleme dosyaları public/updates/ içine kopyalandı!")
console.log("   Artık bu değişiklikleri git push yaparak sunucunuza aktarabilirsiniz.")
console.log("   Masaüstü uygulamaları otomatik olarak https://pamukkaleturizm.info/updates üzerinden güncellenecektir.")
