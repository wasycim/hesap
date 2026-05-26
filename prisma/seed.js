const { PrismaClient, Role } = require("@prisma/client")
const bcrypt = require("bcryptjs")
const crypto = require("crypto")

const prisma = new PrismaClient()

function qrToken() {
  return crypto.randomBytes(32).toString("base64url")
}

async function main() {
  const shifts = [
    { name: "Sabah Vardiyası", startMinute: 6 * 60, endMinute: 16 * 60 },
    { name: "Akşam Vardiyası", startMinute: 16 * 60, endMinute: 2 * 60 },
    { name: "Ara Vardiya", startMinute: 11 * 60, endMinute: 21 * 60 },
  ]

  for (const shift of shifts) {
    await prisma.shift.upsert({
      where: { name: shift.name },
      create: shift,
      update: shift,
    })
  }

  const morning = await prisma.shift.findUniqueOrThrow({ where: { name: "Sabah Vardiyası" } })
  const evening = await prisma.shift.findUniqueOrThrow({ where: { name: "Akşam Vardiyası" } })
  const defaultPassword = await bcrypt.hash("123456", 12)

  const users = [
    { tcKimlik: "10000000146", name: "Admin Kullanıcı", role: Role.ADMIN, shiftId: morning.id },
    { tcKimlik: "10000000154", name: "Ayşe Yılmaz", role: Role.PERSONNEL, shiftId: morning.id },
    { tcKimlik: "10000000162", name: "Mehmet Demir", role: Role.PERSONNEL, shiftId: evening.id },
    { tcKimlik: "10000000170", name: "Zeynep Kaya", role: Role.PERSONNEL, shiftId: morning.id },
  ]

  for (const user of users) {
    await prisma.user.upsert({
      where: { tcKimlik: user.tcKimlik },
      create: {
        ...user,
        passwordHash: defaultPassword,
        qrToken: qrToken(),
      },
      update: {
        name: user.name,
        role: user.role,
        shiftId: user.shiftId,
        isActive: true,
      },
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
