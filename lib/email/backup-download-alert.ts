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
  const smtpTo = process.env.SMTP_USER
  if (!smtpTo || !process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP credentials not fully configured, skipping backup download alert email.")
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
    to: smtpTo,
    subject: `🚨 Kritik İşlem: Yedek Dosyası İndirildi - Hesap App`,
    text: [
      `Kritik İşlem Bildirimi:`,
      `Hesap App veritabanı yedeği manuel olarak indirildi.`,
      `İndiren Kullanıcı: ${userEmail}`,
      `IP Adresi: ${ipAddress}`,
      `Tarih Aralığı Filtresi: ${filterRange}`,
      `Tarayıcı Cihaz Bilgisi: ${userAgent}`,
      `Tarih: ${timeString}`,
    ].join("\n"),
    html: `
      <div style="margin:0;padding:30px;background:#fff1f2;font-family:Arial,sans-serif;color:#0f172a">
        <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #fda4af;border-radius:22px;background:#fff;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1)">
          <div style="padding:26px;background:#e11d48;color:#fff">
            <div style="color:#ffe4e6;font-size:12px;font-weight:900;letter-spacing:.1em">KRİTİK İŞLEM UYARISI</div>
            <h1 style="margin:9px 0 0;font-size:24px;font-weight:bold">Yedek Dosyası İndirildi</h1>
          </div>
          <div style="padding:26px">
            <p style="margin:0 0 16px;color:#334155;line-height:1.7;font-size:15px">
              Hesap App veritabanına ait yedek dosyası manuel olarak dışa aktarılmıştır (indirildi).
            </p>
            <div style="border-radius:14px;background:#fff1f2;border:1px solid #fecdd3;padding:18px;color:#9f1239;font-size:13px;line-height:1.8">
              <b>İndiren Yönetici:</b> ${userEmail}<br>
              <b>IP Adresi:</b> ${ipAddress}<br>
              <b>Tarih Filtresi:</b> ${filterRange}<br>
              <b>Cihaz Detayı:</b> ${userAgent}<br>
              <b>Tarih/Saat:</b> ${timeString} (TSİ)
            </div>
            <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.6">
              Bu işlem sizin bilginiz dışında gerçekleştiyse, lütfen derhal şifrenizi sıfırlayın ve erişim yetkilerini inceleyin.
            </p>
          </div>
        </div>
      </div>`,
  })
}
