const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

function loadEnvFile(fileName) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^"|"$/g, "");
    if (!process.env[key] && value) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

if (!process.env.DATABASE_URL && (process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL)) {
  process.env.DATABASE_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
}

const prisma = new PrismaClient();

async function main() {
  console.log("Executing SQL migration via Prisma...");
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.kargo_prim_kayitlari 
    ADD COLUMN IF NOT EXISTS secili_personeller JSONB DEFAULT NULL;
  `);
  console.log("Migration successful: secili_personeller column added!");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
