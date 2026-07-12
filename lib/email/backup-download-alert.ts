import nodemailer from "nodemailer"

export async function sendBackupDownloadedEmail({
  userEmail,
  ipAddress,
  userAgent,
  filterRange,
}: {
  userEmail: string
  ipAddress: string
  userAgent: string
  filterRange: string
}) {
  if (!userEmail || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials or admin email missing, skipping backup download alert email.")
    return
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  const timeString = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: userEmail,
    subject: `Hesap App - Yedek Dosyası İndirildi`,
    text: [
      `Bilgi Bildirimi:`,
      `Hesap App veritabanı yedek dosyası indirildi.`,
      `İşlemi Yapan Yönetici: ${userEmail}`,
      `IP Adresi: ${ipAddress}`,
      `Tarih Aralığı Filtresi: ${filterRange}`,
      `Tarayıcı Cihaz Bilgisi: ${userAgent}`,
      `Tarih: ${timeString}`,
    ].join("\n"),
    html: `
      <div style="margin:0;padding:30px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:600px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#fff;box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">
          <div style="padding:22px;background:#0f172a;color:#fff">
            <div style="color:#38bdf8;font-size:11px;font-weight:800;letter-spacing:.05em">SİSTEM BİLDİRİMİ</div>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:bold">Yedek İndirme İşlemi</h1>
          </div>
          <div style="padding:24px">
            <p style="margin:0 0 16px;color:#475569;line-height:1.6;font-size:14px">
              Hesap App veritabanına ait yedek dosyası manuel olarak indirilmiştir.
            </p>
            <div style="border-radius:12px;background:#f1f5f9;border:1px solid #e2e8f0;padding:16px;color:#334155;font-size:13px;line-height:1.8">
              <b>İşlemi Yapan Yönetici:</b> ${userEmail}<br>
              <b>IP Adresi:</b> ${ipAddress}<br>
              <b>Tarih Filtresi:</b> ${filterRange}<br>
              <b>Cihaz Detayı:</b> ${userAgent}<br>
              <b>İşlem Zamanı:</b> ${timeString}
            </div>
            <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;line-height:1.5">
              Bu e-posta, sistem güvenliği kapsamında otomatik bilgilendirme amacıyla gönderilmiştir.
            </p>
          </div>
        </div>
      </div>`,
  })
}
