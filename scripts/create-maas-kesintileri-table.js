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
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.maas_kesintileri (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        personel_id UUID NOT NULL REFERENCES public.personeller(id) ON DELETE CASCADE,
        sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
        tutar NUMERIC(12, 2) NOT NULL DEFAULT 0,
        aciklama TEXT NOT NULL DEFAULT '',
        tarih DATE NOT NULL DEFAULT CURRENT_DATE,
        ay_yil VARCHAR(50) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log("Table public.maas_kesintileri created or verified successfully!")
  } catch (err) {
    console.error("Error creating maas_kesintileri table:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
