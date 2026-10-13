const fs = require("fs")
const path = require("path")
const { PrismaClient } = require("@prisma/client")

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
  loadEnvFile(".env")
  loadEnvFile(".env.local")

  process.env.DATABASE_URL ||= process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || ""
  process.env.DIRECT_URL ||= process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL || ""

  const prisma = new PrismaClient()
  try {
    const deleted = await prisma.$executeRawUnsafe(`
      DELETE FROM public.maas_onaylari
      WHERE nakit_odeme_tarihi = '2026-12-15'
         OR ay_yil LIKE '%Ağustos%'
         OR ay_yil LIKE '%Aralık%'
         OR ay_yil LIKE '%12-2026%';
    `)
    console.log(`Deleted ${deleted} test maas_onaylari records.`)
  } catch (err) {
    console.error("Error deleting test approval:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
