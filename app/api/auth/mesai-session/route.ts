import { NextRequest, NextResponse } from "next/server"
import { authCookieName, signAuthToken } from "@/lib/qr-attendance/auth"
import { syncRealProfileToAttendanceUser } from "@/lib/qr-attendance/sync-users"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const nextPath = request.nextUrl.searchParams.get("next") || "/dashboard/mesai"
  const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard/mesai"

  if (!user) {
    return NextResponse.redirect(new URL("/auth/giris", request.url))
  }

  const admin = createAdminClient()
  const { data: profile, error } = await admin
    .from("user_profiles")
    .select("user_id, email, tc_kimlik, is_admin, vardiya")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error || !profile?.tc_kimlik) {
    return NextResponse.redirect(new URL("/auth/giris", request.url))
  }

  const mesaiUser = await syncRealProfileToAttendanceUser(profile, {
    email: user.email || profile.email || undefined,
    user_metadata: user.user_metadata,
  })

  if (!mesaiUser || !mesaiUser.isActive) {
    return NextResponse.redirect(new URL("/auth/giris", request.url))
  }

  const response = NextResponse.redirect(new URL(safeNextPath, request.url))
  response.cookies.set(authCookieName, signAuthToken(mesaiUser), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  })

  return response
}
