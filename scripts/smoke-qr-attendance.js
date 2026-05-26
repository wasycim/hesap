const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const personnel = await prisma.user.findFirst({
    where: { role: "PERSONNEL" },
    select: { tcKimlik: true },
  })

  if (!personnel) {
    throw new Error("Seed personeli bulunamadı.")
  }

  const operatorLogin = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tcKimlik: "10000000146", password: "123456" }),
  })
  const operatorCookie = operatorLogin.headers.get("set-cookie")

  if (!operatorLogin.ok || !operatorCookie) {
    throw new Error(`Operatör login başarısız: ${operatorLogin.status}`)
  }

  const personnelLogin = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tcKimlik: personnel.tcKimlik, password: "123456" }),
  })
  const personnelCookie = personnelLogin.headers.get("set-cookie")

  if (!personnelLogin.ok || !personnelCookie) {
    throw new Error(`Personel login başarısız: ${personnelLogin.status}`)
  }

  const dynamicQr = await fetch("http://localhost:3000/api/personel/qr", {
    headers: { cookie: personnelCookie },
  })
  const dynamicQrPayload = await dynamicQr.json()

  if (!dynamicQr.ok || !dynamicQrPayload.qr) {
    throw new Error(`Dinamik QR alınamadı: ${dynamicQr.status}`)
  }

  const scan = await fetch("http://localhost:3000/api/terminal/scan", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: operatorCookie,
    },
    body: JSON.stringify({
      qr: dynamicQrPayload.qr,
    }),
  })

  const payload = await scan.json()
  console.log(JSON.stringify({
    status: scan.status,
    action: payload.action,
    user: payload.user?.name,
    shift: payload.shift?.label,
    error: payload.error,
  }))
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
