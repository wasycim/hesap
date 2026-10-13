const fs = require("fs")
const path = require("path")
const { Client } = require("pg")

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName)
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (!match) continue

    const key = match[1].trim()
    const value = match[2].trim().replace(/^"|"$/g, "")
    if (!process.env[key] && value) process.env[key] = value
  }
}

async function main() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  const connectionString =
    process.env.DIRECT_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const sql = fs.readFileSync(path.join(process.cwd(), "scripts", "026_personel_giris_cikis_gecmisi.sql"), "utf8")
    await client.query(sql)
    console.log("Personel giris cikis gecmisi schema applied successfully.")
  } catch (err) {
    console.error("Schema application failed:", err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
