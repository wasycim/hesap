import nodemailer from "nodemailer"

export async function sendBackupDeliveryEmail({
  recipients,
  interval,
  fileName,
  file,
  downloadUrl,
  checksum,
  tableCount,
  rowCount,
}: {
  recipients: string[]
  interval: "daily" | "weekly" | "monthly"
  fileName: string
  file?: Buffer
  downloadUrl?: string
  checksum: string
  tableCount: number
  rowCount: number
}) {
  if (!recipients.length) return
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error("SMTP ayarları eksik.")

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
  const label = interval === "daily" ? "Günlük" : interval === "weekly" ? "Haftalık" : "Aylık"
  const deliveryText = file
    ? "Şifreli yedek dosyası ektedir."
    : `Dosya e-posta ek sınırını aştığı için 7 gün geçerli güvenli indirme bağlantısı oluşturuldu: ${downloadUrl}`
  const deliveryHtml = file
    ? `<p style="margin:18px 0 0;color:#334155">Şifreli yedek dosyası bu e-postaya eklendi.</p>`
    : `<p style="margin:18px 0 0"><a href="${downloadUrl}" style="display:inline-block;border-radius:12px;background:#047857;padding:12px 18px;color:#fff;text-decoration:none;font-weight:800">Şifreli yedeği indir</a></p><p style="color:#64748b;font-size:12px">Bağlantı 7 gün geçerlidir.</p>`

  for (const recipient of recipients) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: `${label} Hesap yedeği hazır`,
      text: [
        `${label} Hesap yedeği başarıyla tamamlandı.`,
        deliveryText,
        `Dosya: ${fileName}`,
        `Tablo: ${tableCount}`,
        `Kayıt: ${rowCount}`,
        `SHA-256: ${checksum}`,
        "Dosya AES-256-GCM ile şifrelenmiştir.",
      ].join("\n"),
      html: `
        <div style="margin:0;padding:30px;background:#eef2f7;font-family:Arial,sans-serif;color:#0f172a">
          <div style="max-width:620px;margin:0 auto;overflow:hidden;border:1px solid #dbe3ee;border-radius:22px;background:#fff">
            <div style="padding:26px;background:#0f172a;color:#fff"><div style="color:#6ee7b7;font-size:12px;font-weight:900;letter-spacing:.1em">HESAP YEDEKLEME</div><h1 style="margin:9px 0 0;font-size:27px">${label} yedek tamamlandı</h1></div>
            <div style="padding:26px"><p style="margin:0;color:#475569;line-height:1.7">${tableCount} tablo ve ${rowCount.toLocaleString("tr-TR")} kayıt güvenle dışa aktarıldı.</p>${deliveryHtml}
              <div style="margin-top:20px;border-radius:14px;background:#f8fafc;padding:15px;color:#64748b;font-size:12px;line-height:1.65;word-break:break-all"><b>Dosya:</b> ${fileName}<br><b>SHA-256:</b> ${checksum}<br><b>Şifreleme:</b> AES-256-GCM</div>
            </div>
          </div>
        </div>`,
      attachments: file ? [{ filename: fileName, content: file, contentType: "application/octet-stream" }] : [],
    })
  }
}

