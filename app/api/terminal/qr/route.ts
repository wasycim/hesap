import { NextResponse } from "next/server"
import { createTerminalQrPayload } from "@/lib/qr-attendance/qr"

export async function GET() {
  const terminalQr = createTerminalQrPayload()

  return NextResponse.json({
    qr: terminalQr.qr,
    expiresAt: terminalQr.expiresAt,
    ttlSeconds: terminalQr.ttlSeconds,
  })
}
