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
    // 1. Create maas_zamlari table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.maas_zamlari (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        personel_id UUID REFERENCES public.personeller(id) ON DELETE CASCADE,
        sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
        eski_maas NUMERIC(12, 2) NOT NULL DEFAULT 0,
        zam_orani NUMERIC(6, 2) NOT NULL DEFAULT 0,
        yeni_maas NUMERIC(12, 2) NOT NULL DEFAULT 0,
        yururluk_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
        aciklama TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log("Table public.maas_zamlari created or verified successfully!")

    // 2. Create personel_borc_taksitleri table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.personel_borc_taksitleri (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        personel_id UUID NOT NULL REFERENCES public.personeller(id) ON DELETE CASCADE,
        sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
        toplam_borc NUMERIC(12, 2) NOT NULL DEFAULT 0,
        taksit_sayisi INT NOT NULL DEFAULT 1,
        aylik_taksit NUMERIC(12, 2) NOT NULL DEFAULT 0,
        odenen_taksit_sayisi INT NOT NULL DEFAULT 0,
        baslangic_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
        bitis_tarihi DATE NOT NULL DEFAULT CURRENT_DATE,
        aciklama TEXT NOT NULL DEFAULT '',
        durum VARCHAR(30) NOT NULL DEFAULT 'aktif',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `)
    console.log("Table public.personel_borc_taksitleri created or verified successfully!")
  } catch (err) {
    console.error("Error creating tables:", err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
