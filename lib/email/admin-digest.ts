import nodemailer from "nodemailer"

type DigestMailInput = {
  to: string
  title: string
  subtitle: string
  metrics: Array<{ label: string; value: string }>
  details?: string[]
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

export function canSendAdminDigestEmail() {
  return smtpConfigured()
}

export async function sendAdminDigestEmail({ to, title, subtitle, metrics, details = [] }: DigestMailInput) {
  if (!smtpConfigured()) {
    throw new Error("SMTP ayarları tanımlı değil.")
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
    : ""

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: title,
    html: `
      <div style="margin:0;padding:32px;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;border-radius:22px;overflow:hidden;background:#ffffff;border:1px solid #dbe3ee;">
          <div style="padding:28px;background:#0f172a;color:#ffffff;">
            <table role="presentation" width="52" height="52" cellspacing="0" cellpadding="0" style="width:52px;height:52px;border-collapse:separate;border-radius:16px;background:#111827;">
              <tr>
                <td align="center" valign="middle" style="width:52px;height:52px;padding:0;">
                  <img src="https://pamukkaleturizm.info/mail-logo.png" width="46" height="46" alt="Hesap" style="display:block;width:46px;height:46px;max-width:46px;max-height:46px;border:0;outline:none;text-decoration:none;object-fit:contain;border-radius:12px;" />
                </td>
              </tr>
            </table>
            <h1 style="margin:18px 0 0;font-size:28px;line-height:1.15;">${escapeHtml(title)}</h1>
            <p style="margin:10px 0 0;color:#cbd5e1;line-height:1.6;">${escapeHtml(subtitle)}</p>
          </div>
          <div style="padding:24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${metricHtml}</tr></table>
            ${detailHtml}
            <p style="margin-top:22px;color:#64748b;font-size:13px;line-height:1.6;">
              Bu özet, Hesap yönetim panelindeki seçili yöneticilere otomatik gönderilir.
            </p>
          </div>
        </div>
      </div>
    `,
    text: [
      title,
      subtitle,
      ...metrics.map((metric) => `${metric.label}: ${metric.value}`),
      ...details,
    ].join("\n"),
  })
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
