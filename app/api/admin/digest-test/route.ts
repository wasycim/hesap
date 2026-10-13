import { NextRequest, NextResponse } from "next/server"
import { requireDashboardAdmin } from "@/lib/admin/require-admin"
import { createAdminClient } from "@/lib/supabase/admin"
import { canSendAdminDigestEmail, sendAdminDigestEmail } from "@/lib/email/admin-digest"

export async function POST(request: NextRequest) {
  const adminGuard = await requireDashboardAdmin()
  if (!adminGuard.ok) return adminGuard.response

  const body = await request.json().catch(() => ({}))
  const targetEmail = String(body.email || adminGuard.profile?.email || adminGuard.user.email || "").trim()

  if (!targetEmail) {
    return NextResponse.json({ error: "Test maili için e-posta gerekli." }, { status: 400 })
  }

  if (!canSendAdminDigestEmail()) {
    return NextResponse.json({ ok: false, error: "SMTP ayarları yok. Otomatik rapor gönderimi için SMTP_HOST, SMTP_USER ve SMTP_PASS gerekli." }, { status: 202 })
  }

  await sendAdminDigestEmail({
    to: targetEmail,
    title: "Hesap otomatik rapor testi",
    subtitle: "Bu e-posta günlük/haftalık yönetici rapor altyapısının çalıştığını doğrulamak için gönderildi.",
    metrics: [
      { label: "Rapor tipi", value: "Test" },
      { label: "Durum", value: "Hazır" },
      { label: "Zaman", value: new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date()) },
    ],
    details: [
      "Günlük ve haftalık özetler admin ayarlarında seçilen yöneticilere gönderilir.",
      "Bu test, gerçek cron rapor akışından farklı olarak yalnızca seçili e-posta adresine gider.",
    ],
  })

  await createAdminClient().from("security_events").insert({
    user_id: adminGuard.user.id,
    user_email: adminGuard.profile?.email || adminGuard.user.email || null,
    event_type: "admin_digest_test_sent",
    details: { target_email: targetEmail },
  })

  return NextResponse.json({ ok: true, sent: 1, email: targetEmail })
}
