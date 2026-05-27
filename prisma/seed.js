const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const shifts = [
    { name: "Sabah Vardiyasi", startMinute: 6 * 60, endMinute: 16 * 60 },
    { name: "Aksam Vardiyasi", startMinute: 16 * 60, endMinute: 2 * 60 },
    { name: "Ara Vardiya", startMinute: 11 * 60, endMinute: 21 * 60 },
  ]

  for (const shift of shifts) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      create: shift,
      update: shift,
    })
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
