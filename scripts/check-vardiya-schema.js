const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.$queryRawUnsafe("select to_regclass('public.vardiya_planlari')::text as table_name")
  console.log(JSON.stringify(result))
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
