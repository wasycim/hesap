import nodemailer from "nodemailer"

export type IssueReportEmailParams = {
  developerEmails: string[]
  reporterName: string
  reporterEmail: string
  reporterRole?: string
  subeName?: string
  title: string
  details: string
  pageUrl?: string
  userAgent?: string
  createdAt?: Date
}

function escapeHtml(text: string) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatNewlines(text: string) {
  return escapeHtml(text).replace(/\n/g, "<br/>")
}

export async function sendIssueReportEmail({
  developerEmails,
  reporterName,
  reporterEmail,
  reporterRole = "Kullanıcı",
  subeName = "Belirtilmemiş",
  title,
  details,
  pageUrl,
  userAgent,
  createdAt = new Date(),
}: IssueReportEmailParams) {
  if (!developerEmails || developerEmails.length === 0) {
    throw new Error("Geliştirici e-posta adresi bulunamadı.")
  }

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP yapılandırması eksik (SMTP_HOST, SMTP_USER veya SMTP_PASS).")
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  const timeString = createdAt.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const html = `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sistem Sorun Bildirimi</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;">
    <div style="max-width:640px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:18px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
      
      <!-- HEADER -->
      <div style="padding:28px 24px;background:linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%);border-bottom:1px solid #374151;">
        <div style="display:inline-block;padding:4px 10px;background:rgba(239,68,68,0.25);border:1px solid #ef4444;border-radius:999px;color:#fca5a5;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">
          🚨 DEVELOPER ACİL BİLDİRİM
        </div>
        <h1 style="margin:14px 0 0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3;">
          Yeni Sorun Bildirimi
        </h1>
        <p style="margin:6px 0 0;font-size:13px;color:#cbd5e1;">
          Hesap Sistemi içerisinden bir kullanıcı tarafından iletildi.
        </p>
      </div>

      <!-- BODY CONTENT -->
      <div style="padding:28px 24px;">
        
        <!-- BAŞLIK KARTI -->
        <div style="margin-bottom:20px;padding:16px 18px;background:#1f2937;border:1px solid #374151;border-left:4px solid #ef4444;border-radius:10px;">
          <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">
            SORUN KONUSU
          </div>
          <div style="margin-top:6px;font-size:17px;font-weight:700;color:#f9fafb;line-height:1.4;">
            ${escapeHtml(title)}
          </div>
        </div>

        <!-- DETAY METNİ -->
        <div style="margin-bottom:24px;padding:18px 20px;background:#182234;border:1px solid #253349;border-radius:12px;">
          <div style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
            AÇIKLAMA / HATA DETAYLARI
          </div>
          <div style="font-size:14px;line-height:1.7;color:#e2e8f0;white-space:pre-wrap;word-break:break-word;">
            ${formatNewlines(details)}
          </div>
        </div>

        <!-- KULLANICI & SİSTEM BİLGİLERİ -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;border-collapse:collapse;">
          <tr>
            <td style="padding:14px;background:#181e2e;border:1px solid #232d42;border-radius:10px;vertical-align:top;">
              <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:8px;">
                👤 BİLDİREN KULLANICI
              </div>
              <div style="font-size:13px;color:#f8fafc;line-height:1.6;">
                <b>Adı Soyadı:</b> ${escapeHtml(reporterName)}<br/>
                <b>E-Posta:</b> <a href="mailto:${escapeHtml(reporterEmail)}" style="color:#38bdf8;text-decoration:none;">${escapeHtml(reporterEmail)}</a><br/>
                <b>Şube:</b> ${escapeHtml(subeName)}<br/>
                <b>Yetki / Rol:</b> ${escapeHtml(reporterRole)}
              </div>
            </td>
          </tr>
        </table>

        <!-- TEKNİK VERİLER -->
        <div style="padding:14px 16px;background:#0d131f;border:1px solid #1a2333;border-radius:10px;font-size:12px;color:#94a3b8;line-height:1.6;">
          <div style="font-weight:700;color:#64748b;margin-bottom:6px;text-transform:uppercase;font-size:10px;letter-spacing:0.05em;">
            🛠️ TEKNİK PARAMETRELER
          </div>
          ${pageUrl ? `<div><b>Sayfa:</b> <a href="${escapeHtml(pageUrl)}" style="color:#60a5fa;text-decoration:none;">${escapeHtml(pageUrl)}</a></div>` : ""}
          <div><b>Zaman:</b> ${escapeHtml(timeString)} (TSİ)</div>
          ${userAgent ? `<div style="margin-top:4px;word-break:break-all;color:#64748b;font-size:11px;"><b>Tarayıcı / Cihaz:</b> ${escapeHtml(userAgent)}</div>` : ""}
        </div>

        <!-- YANITLA DÜĞMESİ -->
        <div style="margin-top:28px;text-align:center;">
          <a href="mailto:${escapeHtml(reporterEmail)}?subject=${encodeURIComponent(`Re: [Hesap Sorun Bildirimi] ${title}`)}" 
             style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;border-radius:10px;box-shadow:0 4px 12px rgba(37,99,235,0.3);">
            ✉️ Bildiren Kullanıcıya E-Posta ile Yanıt Ver
          </a>
        </div>

      </div>

      <!-- FOOTER -->
      <div style="padding:16px 24px;background:#0d1117;border-top:1px solid #1f2937;text-align:center;font-size:11px;color:#6b7280;">
        Bu e-posta Hesap Otomasyon Sistemi tarafından doğrudan sistem geliştirici hesaplarına otomatik olarak gönderilmiştir.
      </div>
    </div>
  </body>
</html>`

  const text = [
    `🚨 [HESAP SİSTEMİ - SORUN BİLDİRİMİ]`,
    `Tarih: ${timeString}`,
    ``,
    `KONU: ${title}`,
    `--------------------------------------------------`,
    `DETAY:`,
    details,
    `--------------------------------------------------`,
    `BİLDİREN BİLGİLERİ:`,
    `- Kullanıcı: ${reporterName}`,
    `- E-Posta: ${reporterEmail}`,
    `- Şube: ${subeName}`,
    `- Yetki: ${reporterRole}`,
    `- Sayfa: ${pageUrl || "Belirtilmemiş"}`,
    `- Cihaz: ${userAgent || "Belirtilmemiş"}`,
    ``,
    `Bu e-posta sadece developer hesaplarına iletilmiştir.`,
  ].join("\n")

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "Hesap Sistemi <system@pamukkaleturizm.tr>"

  const sendResult = await transporter.sendMail({
    from: fromAddress,
    to: developerEmails,
    replyTo: reporterEmail || undefined,
    subject: `🚨 [Hesap Sorun Bildirimi] ${title}`,
    text,
    html,
  })

  return sendResult
}
