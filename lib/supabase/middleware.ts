import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { deviceTrustCookieName, verifyDeviceTrustToken } from "@/lib/security/device-trust"

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => (
    cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token")
  ))
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const nativePlatform = request.cookies.get("hesap-native-platform")?.value

  if (
    nativePlatform === "ios" &&
    pathname.startsWith("/api/") &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    !pathname.startsWith("/api/auth/") &&
    pathname !== "/api/mobile/register-device" &&
    pathname !== "/api/devices/register" &&
    pathname !== "/api/security-events"
  ) {
    return NextResponse.json({ error: "iOS uygulaması salt okunur modda çalışır." }, { status: 403 })
  }

  if (!hasSupabaseAuthCookie(request)) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/mobile")) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/giris"
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith("/auth/giris") || pathname === "/maintenance") {
      return NextResponse.next({ request })
    }
  }

  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    },
  )

  // Supabase oturum yenilemesi ile yönlendirme arasına başka işlem eklenmemelidir.
  const { data: { user } } = await supabase.auth.getUser()
  const trust = user
    ? await verifyDeviceTrustToken(request.cookies.get(deviceTrustCookieName)?.value, user.id)
    : null

  if (user && (pathname.startsWith("/dashboard") || pathname.startsWith("/mobile")) && !trust) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/cihaz-dogrulama"
    url.search = ""
    url.searchParams.set("next", pathname + request.nextUrl.search)
    return redirectWithSession(url, supabaseResponse)
  }

  if ((pathname.startsWith("/dashboard") || pathname.startsWith("/mobile")) && !user) {
    const url = request.nextUrl.clone()
    url.pathname = "/auth/giris"
    return redirectWithSession(url, supabaseResponse)
  }

  if (user && pathname.startsWith("/auth/giris")) {
    const url = request.nextUrl.clone()
    url.pathname = trust ? (nativePlatform === "ios" ? "/mobile" : "/dashboard") : "/auth/cihaz-dogrulama"
    url.search = ""
    if (!trust) url.searchParams.set("next", nativePlatform === "ios" ? "/mobile" : "/dashboard")
    return redirectWithSession(url, supabaseResponse)
  }

  if (user && trust && nativePlatform === "ios" && pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone()
    url.pathname = "/mobile"
    url.search = ""
    return redirectWithSession(url, supabaseResponse)
  }

  if (
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/auth/giris") &&
    pathname !== "/maintenance" &&
    pathname !== "/status"
  ) {
    const { data: maintenance } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle()

    const maintenanceValue = maintenance?.value as { enabled?: boolean } | null
    if (maintenanceValue?.enabled) {
      let isDeveloper = false
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("is_developer, dashboard_access")
          .eq("user_id", user.id)
          .maybeSingle()
        isDeveloper = Boolean(profile?.is_developer && profile.dashboard_access !== false)
      }

      if (!isDeveloper) {
        const url = request.nextUrl.clone()
        url.pathname = "/maintenance"
        return redirectWithSession(url, supabaseResponse)
      }
    }
  }

  return supabaseResponse
}

function redirectWithSession(url: URL, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(url)
  for (const cookie of sessionResponse.cookies.getAll()) response.cookies.set(cookie)
  return response
}
