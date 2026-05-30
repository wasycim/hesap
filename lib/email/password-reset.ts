import nodemailer from "nodemailer"

type PasswordResetMail = {
  to: string
  resetUrl: string
}

function env(name: string) {
  return process.env[name]?.trim()
}

export function isPasswordResetSmtpConfigured() {
  return Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS"))
}

function smtpPort() {
  const parsed = Number(env("SMTP_PORT") || "587")
  return Number.isFinite(parsed) ? parsed : 587
}

function smtpSecure() {
  const explicit = env("SMTP_SECURE")?.toLowerCase()
  if (explicit === "true") return true
  if (explicit === "false") return false
  return smtpPort() === 465
}

function fromAddress() {
  return env("SMTP_FROM") || env("MAIL_FROM") || "Hesap Rapor Sistemi <system@pamukkaleturizm.tr>"
}

function buildPasswordResetHtml(resetUrl: string) {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Hesap şifre sıfırlama</title>
  </head>
  <body style="margin:0;background:#0b1220;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1220;padding:34px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e5e7eb;box-shadow:0 22px 70px rgba(0,0,0,.28);">
            <tr>
              <td style="padding:30px 30px 8px 30px;background:linear-gradient(135deg,#0f172a 0%,#111827 58%,#064e3b 100%);">
                <div style="display:inline-block;background:#ffffff;color:#0f172a;border-radius:16px;padding:10px 15px;font-size:24px;font-weight:900;letter-spacing:.04em;box-shadow:0 10px 24px rgba(0,0,0,.18);">W</div>
                <p style="margin:20px 0 0 0;color:#6ee7b7;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;">Hesap Rapor Sistemi</p>
                <h1 style="margin:8px 0 0 0;font-size:30px;line-height:1.2;color:#ffffff;">Şifreni yenile</h1>
                <p style="margin:10px 0 18px 0;color:#cbd5e1;font-size:15px;line-height:1.65;">Hesabın için güvenli bir şifre sıfırlama bağlantısı hazırlandı.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 30px 8px 30px;">
                <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">
                  Yeni şifreni belirlemek için aşağıdaki butona tıkla. Bu bağlantı yalnızca kısa süre geçerlidir ve güvenli şekilde pamukkaleturizm.info üzerinde açılır.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px;">
                <a href="${resetUrl}" style="display:block;text-align:center;background:#10b981;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;border-radius:14px;padding:16px 18px;box-shadow:0 12px 24px rgba(16,185,129,.28);">
                  Şifremi sıfırla
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 28px 30px;">
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.65;">
                  Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Şifren değişmez ve hesabın aynı şekilde kalır.
                </p>
                <p style="margin:18px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;word-break:break-all;">
                  Buton çalışmazsa bu bağlantıyı tarayıcıya yapıştır:<br />
                  ${resetUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:18px 30px;color:#64748b;font-size:12px;line-height:1.5;">
                Hesap, Wasy Systems tarafından işletilen şirket içi rapor ve mesai takip sistemidir.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildPasswordResetText(resetUrl: string) {
  return [
    "Hesap şifreni yenile",
    "",
    "Hesabın için şifre sıfırlama bağlantısı hazırlandı.",
    "Yeni şifreni belirlemek için aşağıdaki bağlantıyı aç:",
    resetUrl,
    "",
    "Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.",
  ].join("\n")
}

export async function sendPasswordResetEmail({ to, resetUrl }: PasswordResetMail) {
  if (!isPasswordResetSmtpConfigured()) {
    throw new Error("SMTP ayarları eksik.")
  }

  const transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port: smtpPort(),
    secure: smtpSecure(),
    auth: {
      user: env("SMTP_USER"),
      pass: env("SMTP_PASS"),
    },
  })

  await transport.sendMail({
    to,
    from: fromAddress(),
    subject: "Hesap şifreni yenile",
    html: buildPasswordResetHtml(resetUrl),
    text: buildPasswordResetText(resetUrl),
  })
}
