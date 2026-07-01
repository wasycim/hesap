import nodemailer from "nodemailer"

export async function sendDeviceVerificationEmail({
  to,
  code,
  deviceLabel,
}: {
  to: string
  code: string
  deviceLabel: string
}) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP ayarları eksik.")
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  const safeDevice = escapeHtml(deviceLabel)
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: "Hesap yeni cihaz doğrulama kodu",
    text: `Yeni cihaz doğrulama kodunuz: ${code}\nCihaz: ${deviceLabel}\nKod 10 dakika geçerlidir. Bu giriş size ait değilse kodu paylaşmayın.`,
    html: `
      <div style="margin:0;padding:32px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;color:#0f172a">
        <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #dbe3ee;border-radius:24px;background:#fff">
          <div style="padding:28px;background:#0f172a;color:#fff">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#6ee7b7">HESAP GÜVENLİK</div>
            <h1 style="margin:10px 0 0;font-size:27px">Yeni cihaz doğrulaması</h1>
          </div>
          <div style="padding:28px">
            <p style="margin:0;color:#475569;line-height:1.7">${safeDevice} cihazından giriş yapılmak isteniyor.</p>
            <div style="margin:24px 0;border:1px solid #a7f3d0;border-radius:18px;background:#ecfdf5;padding:22px;text-align:center;font-size:36px;font-weight:900;letter-spacing:.22em;color:#065f46">${code}</div>
            <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7">Kod 10 dakika geçerlidir. Bu giriş size ait değilse kodu hiç kimseyle paylaşmayın.</p>
          </div>
        </div>
      </div>`,
  })
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

