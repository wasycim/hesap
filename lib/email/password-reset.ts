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
  <body style="margin:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe3ef;box-shadow:0 16px 44px rgba(15,23,42,.12);">
            <tr>
              <td style="height:5px;background:#10b981;line-height:5px;font-size:1px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:28px 28px 12px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:58px;vertical-align:top;">
                      <div style="display:inline-block;background:#111827;color:#ffffff;border-radius:14px;padding:11px 15px;font-size:23px;font-weight:900;letter-spacing:.03em;">W</div>
                    </td>
                    <td style="vertical-align:middle;padding-left:14px;">
                      <p style="margin:0;color:#10b981;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;">Hesap Rapor Sistemi</p>
                      <h1 style="margin:6px 0 0 0;font-size:26px;line-height:1.25;color:#111827;">Şifreni yenile</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 6px 28px;">
                <p style="margin:0;color:#526176;font-size:15px;line-height:1.7;">
                  Hesabın için güvenli bir şifre sıfırlama bağlantısı hazırlandı. Yeni şifreni belirlemek için aşağıdaki butonu kullan.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 18px 28px;">
                <a href="${resetUrl}" style="display:block;text-align:center;background:#10b981;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;border-radius:12px;padding:15px 18px;">
                  Şifremi sıfırla
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;">
                  <tr>
                    <td style="padding:16px 18px;color:#64748b;font-size:13px;line-height:1.65;">
                      Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin. Şifren değişmez ve hesabın aynı şekilde kalır.
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;word-break:break-all;">
                  Buton çalışmazsa bu bağlantıyı tarayıcıya yapıştır:<br />
                  ${resetUrl}
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;padding:16px 28px;color:#64748b;font-size:12px;line-height:1.6;">
                Hesap, Wasy Systems tarafından işletilen şirket içi rapor ve mesai takip sistemidir.<br />
                <a href="https://pamukkaleturizm.info/privacy-policy" style="color:#0f766e;text-decoration:none;">Gizlilik Politikası</a>
                &nbsp;|&nbsp;
                <a href="https://pamukkaleturizm.info/mobile-support" style="color:#0f766e;text-decoration:none;">Destek</a>
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
    "Gizlilik Politikası: https://pamukkaleturizm.info/privacy-policy",
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
