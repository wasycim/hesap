import nodemailer from "nodemailer"

type DigestMailInput = {
  to: string
  title: string
  subtitle: string
  metrics: Array<{ label: string; value: string }>
  details?: string[]
  attachPdf?: boolean
  attachHtml?: boolean
  reportLabel?: string
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function canSendAdminDigestEmail() {
  return smtpConfigured()
}

export async function sendAdminDigestEmail({
  to,
  title,
  subtitle,
  metrics,
  details = [],
  attachPdf = true,
  attachHtml = true,
  reportLabel = "hesap-rapor",
}: DigestMailInput) {
  if (!smtpConfigured()) {
    throw new Error("SMTP ayarlari tanimli degil.")
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

  const metricHtml = metrics.map((metric) => `
    <td style="padding:10px;width:${Math.floor(100 / Math.max(metrics.length, 1))}%;">
      <div style="border:1px solid #dbeafe;border-radius:14px;padding:14px;background:#f8fafc;">
        <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;">${escapeHtml(metric.label)}</div>
        <div style="margin-top:8px;font-size:22px;font-weight:900;color:#0f172a;">${escapeHtml(metric.value)}</div>
      </div>
    </td>
  `).join("")

  const detailHtml = details.length
    ? `<ul style="margin:18px 0 0;padding-left:20px;color:#334155;line-height:1.7;">${details.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p style="margin:18px 0 0;color:#64748b;line-height:1.7;">Bu rapor icin ek detay kaydi bulunmuyor.</p>`

  const html = `
    <div style="margin:0;padding:32px;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
      <div style="max-width:720px;margin:0 auto;border-radius:24px;overflow:hidden;background:#ffffff;border:1px solid #dbe3ee;">
        <div style="padding:28px;background:linear-gradient(135deg,#0f172a 0%,#0f3f36 100%);color:#ffffff;">
          <table role="presentation" width="58" height="58" cellspacing="0" cellpadding="0" style="width:58px;height:58px;border-collapse:separate;border-radius:18px;background:#ffffff;">
            <tr>
              <td align="center" valign="middle" style="width:58px;height:58px;padding:0;">
                <img src="https://pamukkaleturizm.info/mail-logo.png" width="50" height="50" alt="Hesap" style="display:block;width:50px;height:50px;max-width:50px;max-height:50px;border:0;outline:none;text-decoration:none;object-fit:contain;border-radius:14px;" />
              </td>
            </tr>
          </table>
          <div style="margin-top:18px;font-size:12px;font-weight:900;letter-spacing:.12em;color:#8ff3c5;text-transform:uppercase;">Hesap Rapor Sistemi</div>
          <h1 style="margin:10px 0 0;font-size:30px;line-height:1.15;">${escapeHtml(title)}</h1>
          <p style="margin:10px 0 0;color:#dbeafe;line-height:1.6;">${escapeHtml(subtitle)}</p>
        </div>
        <div style="padding:24px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${metricHtml}</tr></table>
          <div style="margin-top:18px;border:1px solid #e2e8f0;border-radius:16px;padding:18px;background:#ffffff;">
            <div style="font-size:13px;font-weight:900;color:#0f172a;text-transform:uppercase;letter-spacing:.08em;">Detayli Ozet</div>
            ${detailHtml}
          </div>
          <p style="margin-top:22px;color:#64748b;font-size:13px;line-height:1.6;">
            Bu ozet Hesap panelindeki Mail Islemleri ayarlarina gore gonderildi. PDF rapor ve HTML ozet ektedir.
          </p>
        </div>
        <div style="padding:14px 24px;background:#f8fafc;color:#64748b;font-size:12px;">
          Hesap, Wasy Systems tarafindan isletilen sirket ici rapor ve mesai takip sistemidir.
        </div>
      </div>
    </div>
  `

  const attachments = [
    attachHtml ? {
      filename: `${safeFileName(reportLabel)}.html`,
      content: html,
      contentType: "text/html; charset=utf-8",
    } : null,
    attachPdf ? {
      filename: `${safeFileName(reportLabel)}.pdf`,
      content: buildDigestPdf({ title, subtitle, metrics, details }),
      contentType: "application/pdf",
    } : null,
  ].filter(Boolean) as Array<{ filename: string; content: string | Buffer; contentType: string }>

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: title,
    html,
    text: [
      title,
      subtitle,
      ...metrics.map((metric) => `${metric.label}: ${metric.value}`),
      ...details,
    ].join("\n"),
    attachments,
  })
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function safeFileName(value: string) {
  return String(value || "hesap-rapor")
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "hesap-rapor"
}

function normalizePdfText(value: string) {
  return String(value || "")
    .replace(/ğ/g, "g").replace(/Ğ/g, "G")
    .replace(/ü/g, "u").replace(/Ü/g, "U")
    .replace(/ş/g, "s").replace(/Ş/g, "S")
    .replace(/ı/g, "i").replace(/İ/g, "I")
    .replace(/ö/g, "o").replace(/Ö/g, "O")
    .replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/[^\x20-\x7E]/g, " ")
}

function pdfEscape(value: string) {
  return normalizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function buildDigestPdf({
  title,
  subtitle,
  metrics,
  details,
}: {
  title: string
  subtitle: string
  metrics: Array<{ label: string; value: string }>
  details: string[]
}) {
  const lines = [
    title,
    subtitle,
    "",
    "METRIKLER",
    ...metrics.map((metric) => `${metric.label}: ${metric.value}`),
    "",
    "DETAYLAR",
    ...(details.length ? details : ["Detay kaydi yok."]),
    "",
    `Olusturma zamani: ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}`,
  ].flatMap((line) => wrapPdfLine(line, 92))

  const content = [
    "BT",
    "/F1 11 Tf",
    "48 792 Td",
    "16 TL",
    ...lines.slice(0, 45).map((line, index) => {
      const prefix = index === 0 ? "/F1 18 Tf " : index === 1 ? "/F1 10 Tf " : ""
      const suffix = index === 0 ? " /F1 10 Tf" : ""
      return `${prefix}(${pdfEscape(line)}) Tj T*${suffix}`
    }),
    "ET",
  ].join("\n")

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "binary")} >>\nstream\n${content}\nendstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]
  objects.forEach((object, index) => {
    offsets[index + 1] = Buffer.byteLength(pdf, "binary")
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf, "binary")
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`

  return Buffer.from(pdf, "binary")
}

function wrapPdfLine(value: string, width: number) {
  const words = normalizePdfText(value).split(/\s+/)
  const lines: string[] = []
  let line = ""
  for (const word of words) {
    if (!word) continue
    const next = line ? `${line} ${word}` : word
    if (next.length > width) {
      if (line) lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : [""]
}
