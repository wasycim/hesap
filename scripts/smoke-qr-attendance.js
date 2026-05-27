const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const personnel = await prisma.user.findFirst({
    where: { role: "PERSONNEL" },
    select: { tcKimlik: true },
  })

  if (!personnel) {
    throw new Error("Seed personeli bulunamadi.")
  }

  const personnelLogin = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tcKimlik: personnel.tcKimlik, password: "123456" }),
  })
  const personnelCookie = personnelLogin.headers.get("set-cookie")

  if (!personnelLogin.ok || !personnelCookie) {
    throw new Error(`Personel login basarisiz: ${personnelLogin.status}`)
  }

  const terminalQr = await fetch("http://localhost:3000/api/terminal/qr")
  const terminalQrPayload = await terminalQr.json()

  if (!terminalQr.ok || !terminalQrPayload.qr) {
    throw new Error(`Terminal QR alinamadi: ${terminalQr.status}`)
  }

  const scan = await fetch("http://localhost:3000/api/personel/scan-terminal", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: personnelCookie,
    },
    body: JSON.stringify({
      qr: terminalQrPayload.qr,
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
