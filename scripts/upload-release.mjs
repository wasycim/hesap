import fs from "fs"
import path from "path"

const BASE_URL = "https://pamukkaleturizm.info/api/admin/updates/upload"
const FILE_PATH = path.join(process.cwd(), "public", "updates", "Hesap-Setup-9.9.5.exe")
const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || ""
const CHUNK_SIZE = 8 * 1024 * 1024 // 8 MB (strictly below 10MB reverse proxy limit)

async function upload() {
  if (!fs.existsSync(FILE_PATH)) {
    console.error("Dosya bulunamadi:", FILE_PATH)
    process.exit(1)
  }

  const stat = fs.statSync(FILE_PATH)
  const totalSize = stat.size
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE)
  console.log(`Dosya: Hesap-Setup-9.9.5.exe (${(totalSize / (1024 * 1024)).toFixed(2)} MB / ${totalSize} bytes) - Toplam ${totalChunks} parca halinde yuklenecek.`)

  const fd = fs.openSync(FILE_PATH, "r")
  const buffer = Buffer.alloc(CHUNK_SIZE)
  let lastServerSize = 0

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const bytesToRead = Math.min(CHUNK_SIZE, totalSize - start)
    const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, start)
    const chunkData = buffer.subarray(0, bytesRead)

    const url = `${BASE_URL}?filename=Hesap-Setup-9.9.5.exe&chunk=${i}&totalChunks=${totalChunks}`
    process.stdout.write(`[${i + 1}/${totalChunks}] Parca yukleniyor (${(bytesRead / (1024 * 1024)).toFixed(2)} MB)... `)

    let success = false
    let retries = 3
    while (!success && retries > 0) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SECRET}`,
            "Content-Type": "application/octet-stream",
          },
          body: chunkData,
        })

        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`HTTP ${res.status}: ${errText}`)
        }

        const json = await res.json()
        lastServerSize = json.currentSize
        console.log(`Tamam! (Sunucudaki toplam boyut: ${(json.currentSize / (1024 * 1024)).toFixed(2)} MB / ${json.currentSize} bytes)`)
        success = true
      } catch (err) {
        retries--
        console.warn(`Hata: ${err.message}. Yeniden deneniyor (${retries} hak kaldi)...`)
        if (retries === 0) throw err
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  fs.closeSync(fd)

  if (lastServerSize === totalSize) {
    console.log(`\n>>> BASARILI! Dosya boyutu birebir eslesti: ${lastServerSize} bytes (222.35 MB) <<<`)
  } else {
    console.error(`\n>>> UYARI: Dosya boyutu uyusmuyor! Yerel: ${totalSize}, Sunucu: ${lastServerSize} <<<`)
    process.exit(1)
  }
}

upload().catch((err) => {
  console.error("Yukleme hatasi:", err)
  process.exit(1)
})
