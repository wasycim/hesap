import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthSession } from "@/lib/qr-attendance/auth"
import { createDynamicQrPayload } from "@/lib/qr-attendance/qr"
import { getShiftLabel } from "@/lib/qr-attendance/time"

export async function GET() {
  const session = await getAuthSession()

  if (!session) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 })
  }

  const user = await prisma.user.findFirst({
    where: { id: session.id, isActive: true },
    include: { shift: true },
  })

  if (!user) {
    return NextResponse.json({ error: "Personel bulunamadı." }, { status: 404 })
  }

  const dynamicQr = createDynamicQrPayload(user)

  return NextResponse.json({
    qr: dynamicQr.qr,
    expiresAt: dynamicQr.expiresAt,
    ttlSeconds: dynamicQr.ttlSeconds,
    user: {
      id: user.id,
      name: user.name,
      tcKimlik: user.tcKimlik,
      role: user.role,
      shift: user.shift ? { name: user.shift.name, label: getShiftLabel(user.shift) } : null,
    },
  })
}
