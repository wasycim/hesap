const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS public.vardiya_tanimlari (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
      ad TEXT NOT NULL,
      simge TEXT NOT NULL DEFAULT '',
      baslangic TEXT NOT NULL,
      bitis TEXT NOT NULL,
      aktif BOOLEAN NOT NULL DEFAULT true,
      sira INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vardiya_tanimlari_sube_aktif
      ON public.vardiya_tanimlari (sube_id, aktif, sira)`,
    `ALTER TABLE public.vardiya_tanimlari
      ADD COLUMN IF NOT EXISTS simge TEXT NOT NULL DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS public.vardiya_sabit_ayarlari (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
      kod TEXT NOT NULL CHECK (kod IN ('S', 'A', 'R', 'I')),
      ad TEXT NOT NULL,
      simge TEXT NOT NULL DEFAULT '',
      baslangic TEXT,
      bitis TEXT,
      aktif BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (sube_id, kod)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vardiya_sabit_ayarlari_sube
      ON public.vardiya_sabit_ayarlari (sube_id, kod)`,
    `CREATE TABLE IF NOT EXISTS public.vardiya_planlari (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      sube_id UUID NOT NULL REFERENCES public.subeler(id) ON DELETE CASCADE,
      personel_id UUID NOT NULL REFERENCES public.personeller(id) ON DELETE CASCADE,
      tarih DATE NOT NULL,
      vardiya TEXT NOT NULL,
      notlar TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (sube_id, personel_id, tarih)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_vardiya_planlari_sube_tarih
      ON public.vardiya_planlari (sube_id, tarih)`,
    `CREATE INDEX IF NOT EXISTS idx_vardiya_planlari_personel_tarih
      ON public.vardiya_planlari (personel_id, tarih)`,
    `ALTER TABLE public.personeller
      ADD COLUMN IF NOT EXISTS sabit_vardiya TEXT`,
    `ALTER TABLE public.personeller
      DROP CONSTRAINT IF EXISTS personeller_sabit_vardiya_check`,
    `ALTER TABLE public.vardiya_planlari
      DROP CONSTRAINT IF EXISTS vardiya_planlari_vardiya_check`,
  ]

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
