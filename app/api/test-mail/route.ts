import { NextRequest, NextResponse } from "next/server"
import nodemailer from "nodemailer"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const logs: string[] = []
  
  // Custom logger for Nodemailer
  const customLogger = {
    info: (msg: string, ...args: any[]) => logs.push(`[INFO] ${msg} ${args.map(a => JSON.stringify(a)).join(" ")}`),
    warn: (msg: string, ...args: any[]) => logs.push(`[WARN] ${msg} ${args.map(a => JSON.stringify(a)).join(" ")}`),
    error: (msg: string, ...args: any[]) => logs.push(`[ERROR] ${msg} ${args.map(a => JSON.stringify(a)).join(" ")}`),
  }

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return NextResponse.json({ error: "SMTP credentials not defined in environment variables." })
  }

  try {
    logs.push("Initializing transporter...")
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
      auth: { user, pass },
      debug: true,
      logger: customLogger as any
    })

    logs.push("Verifying connection...")
    await transporter.verify()
    logs.push("Connection verified. Sending test mail...")

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || user,
      to: "ykacaran480@gmail.com",
      subject: "Hesap App - E-Posta Gönderim Testi",
      text: "Eğer bu e-postayı okuyabiliyorsanız, SMTP bağlantısı ve e-posta gönderimi başarıyla tamamlanmıştır! Lütfen bu e-postanın Gereksiz (Spam) klasörüne düşüp düşmediğini kontrol edin.",
      html: "<p>Eğer bu e-postayı okuyabiliyorsanız, SMTP bağlantısı ve e-posta gönderimi başarıyla tamamlanmıştır! Lütfen bu e-postanın Gereksiz (Spam) klasörüne düşüp düşmediğini kontrol edin.</p>"
    })

    logs.push(`Mail sent successfully! Message-ID: ${info.messageId}`)
    logs.push(`Accepted: ${JSON.stringify(info.accepted)}`)
    logs.push(`Rejected: ${JSON.stringify(info.rejected)}`)

    return NextResponse.json({
      ok: true,
      message: "Test mail attempted.",
      messageId: info.messageId,
      logs
    })
  } catch (err: any) {
    logs.push(`Failed with error: ${err.message}`)
    return NextResponse.json({
      ok: false,
      error: err.message,
      stack: err.stack,
      logs
    })
  }
}
