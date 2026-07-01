import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options: CookieOptions
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some(cookie => (
    cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')
  ))
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (!hasSupabaseAuthCookie(request)) {
    if (pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/giris'
      return NextResponse.redirect(url)
    }

    if (pathname.startsWith('/auth/giris') || pathname === '/maintenance') {
      return NextResponse.next({ request })
    }
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getUser() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    // if the user is not logged in and the dashboard path is accessed, redirect to the login page
    request.nextUrl.pathname.startsWith('/dashboard') &&
    !user
  ) {
    // no user, redirect to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/auth/giris'
    return NextResponse.redirect(url)
  }

  // If user is logged in and trying to access auth pages, redirect to dashboard
  if (
    user &&
    request.nextUrl.pathname.startsWith('/auth/giris')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  if (
    !request.nextUrl.pathname.startsWith('/api') &&
    !request.nextUrl.pathname.startsWith('/auth/giris') &&
    request.nextUrl.pathname !== '/maintenance' &&
    request.nextUrl.pathname !== '/status'
  ) {
    const { data: maintenance } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle()

    const maintenanceValue = maintenance?.value as { enabled?: boolean; allowDeveloper?: boolean } | null
    if (maintenanceValue?.enabled) {
      let isDeveloper = false
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('is_developer, dashboard_access')
          .eq('user_id', user.id)
          .maybeSingle()
        isDeveloper = Boolean(profile?.is_developer && profile.dashboard_access !== false)
      }

      if (!isDeveloper) {
        const url = request.nextUrl.clone()
        url.pathname = '/maintenance'
        return NextResponse.redirect(url)
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
