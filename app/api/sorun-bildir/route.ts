import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendIssueReportEmail } from "@/lib/email/issue-report"

export async function POST(request: NextRequest) {
  try {
    // 1. Oturum kontrolü (Giriş yapmak zorunludur)
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sorun bildirmek için giriş yapmanız zorunludur." },
        { status: 401 }
      )
    }

    // 2. İstek gövdesini doğrula
    const body = await request.json().catch(() => ({}))
    const baslik = String(body.baslik || "").trim()
    const detay = String(body.detay || "").trim()
    const pageUrl = String(body.pageUrl || "").trim()
    const userAgent = String(body.userAgent || request.headers.get("user-agent") || "").trim()

    if (!baslik || baslik.length < 2) {
      return NextResponse.json(
        { error: "Lütfen sorunun konu başlığını yazınız." },
        { status: 400 }
      )
    }

    if (!detay || detay.length < 5) {
      return NextResponse.json(
        { error: "Lütfen sorun hakkında en az birkaç cümle detay belirtiniz." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 3. Bildiren kullanıcının profilini al
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id, user_id, display_name, email, sube_id, is_admin, is_developer, subeler:sube_id(ad)")
      .eq("user_id", user.id)
      .maybeSingle()

    const reporterName = profile?.display_name || user.email?.split("@")[0] || "Kullanıcı"
    const reporterEmail = user.email || profile?.email || ""
    const reporterRole = profile?.is_developer
      ? "Geliştirici (Developer)"
      : profile?.is_admin
      ? "Yönetici (Admin)"
      : "Kullanıcı"

    let subeName = "Belirtilmemiş"
    if (profile?.subeler && typeof profile.subeler === "object" && "ad" in profile.subeler) {
      subeName = (profile.subeler as { ad: string }).ad || "Belirtilmemiş"
    }

    // 4. Sadece developer hesaplarının e-postalarını çek
    const { data: devProfiles, error: devError } = await admin
      .from("user_profiles")
      .select("user_id, email, display_name, is_developer")
      .eq("is_developer", true)

    if (devError) {
      console.error("[sorun-bildir] Developer profilleri sorgulanırken hata:", devError)
    }

    const devEmailSet = new Set<string>()

    for (const p of devProfiles || []) {
      if (p.email && p.email.includes("@")) {
        devEmailSet.add(p.email.trim().toLowerCase())
      }
    }

    // Profilde e-posta yoksa auth üzerinden almayı dene
    if (devEmailSet.size === 0 && devProfiles && devProfiles.length > 0) {
      for (const p of devProfiles) {
        try {
          const { data: authUser } = await admin.auth.admin.getUserById(p.user_id)
          if (authUser?.user?.email && authUser.user.email.includes("@")) {
            devEmailSet.add(authUser.user.email.trim().toLowerCase())
          }
        } catch (e) {
          console.warn("[sorun-bildir] Auth kullanıcı e-postası çekilemedi:", p.user_id, e)
        }
      }
    }

    // Eğer veritabanında developer e-postası bulunamadıysa garanti olarak ana developer hesabına yönlendir
    if (devEmailSet.size === 0) {
      devEmailSet.add("ykacaran480@gmail.com")
    }

    const developerEmails = Array.from(devEmailSet)

    // 5. Sorun bildirimini veritabanına kaydet
    try {
      await admin.from("sorun_bildirimleri").insert({
        user_id: user.id,
        user_email: reporterEmail,
        user_name: reporterName,
        baslik,
        detay,
        sayfa_url: pageUrl,
        cihaz_bilgisi: userAgent,
        durum: "yeni",
      })
    } catch (dbErr) {
      console.error("[sorun-bildir] DB kayıt hatası:", dbErr)
      // E-posta gönderimini engelleme, devam et
    }

    // 6. E-postayı SADECE developer hesaplarına anında gönder
    try {
      await sendIssueReportEmail({
        developerEmails,
        reporterName,
        reporterEmail,
        reporterRole,
        subeName,
        title: baslik,
        details: detay,
        pageUrl,
        userAgent,
        createdAt: new Date(),
      })
    } catch (mailErr: any) {
      console.error("[sorun-bildir] Mail gönderim hatası:", mailErr)
      return NextResponse.json(
        {
          error:
            "Sorun bildiriminiz kaydedildi ancak developer e-posta bildiriminde geçici bir hata oluştu: " +
            (mailErr?.message || "E-posta gönderilemedi"),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Sorun bildiriminiz developer ekibine e-posta olarak anında iletildi.",
    })
  } catch (error: any) {
    console.error("[sorun-bildir] Beklenmeyen hata:", error)
    return NextResponse.json(
      { error: error?.message || "İşlem sırasında beklenmeyen bir hata oluştu." },
      { status: 500 }
    )
  }
}
