import { createClient } from '@/lib/supabase/server'
import {
  createPasswordRecoveryToken,
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
} from '@/lib/auth/password-recovery'
import { publicAppOrigin, shouldForcePublicOrigin } from '@/lib/public-app-url'
import { NextRequest, NextResponse } from 'next/server'

function redirectWithRecoveryCookie(url: string, userId: string) {
  const response = NextResponse.redirect(url)
  response.cookies.set(
    passwordRecoveryCookieName,
    createPasswordRecoveryToken(userId),
    passwordRecoveryCookieOptions(),
  )
  return response
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const appOrigin = publicAppOrigin()

  if (shouldForcePublicOrigin(origin)) {
    return NextResponse.redirect(`${appOrigin}${request.nextUrl.pathname}${request.nextUrl.search}`)
  }

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const userId = data.user?.id
      if (next === '/auth/sifre-sifirla' && userId) {
        return redirectWithRecoveryCookie(`${appOrigin}${next}`, userId)
      }

      return NextResponse.redirect(`${appOrigin}${next}`)
    }
  }

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    })

    if (!error) {
      const userId = data.user?.id
      if (next === '/auth/sifre-sifirla' && userId) {
        return redirectWithRecoveryCookie(`${appOrigin}${next}`, userId)
      }

      return NextResponse.redirect(`${appOrigin}${next}`)
    }
  }

  return NextResponse.redirect(`${appOrigin}/auth/error`)
}
