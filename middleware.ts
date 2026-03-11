import { updateSession } from '@/lib/supabase/proxy'
import { type NextRequest, NextResponse } from 'next/server'

/** Supabase auth cookie name: sb-{project-ref}-auth-token */
function getSupabaseAuthCookieName(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    const hostname = new URL(url).hostname
    const ref = hostname.replace(/\.supabase\.co$/, '')
    return ref ? `sb-${ref}-auth-token` : null
  } catch {
    return null
  }
}

/** Check if request has a Supabase session cookie (no network call, Edge-safe). */
function hasAuthCookie(request: NextRequest): boolean {
  const name = getSupabaseAuthCookieName()
  if (!name) return false
  const value = request.cookies.get(name)?.value
  return Boolean(value && value.length > 0)
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  const protectedRoutes = [
    '/system-panel',
    '/calendar',
    '/quests',
    '/rewards',
    '/penalties',
    '/progress',
    '/settings',
  ]

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route),
  )

  // Use cookie presence only (no Supabase fetch in Edge – avoids "fetch failed" / timeouts)
  const hasSession = hasAuthCookie(request)

  if (isProtectedRoute && !hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (hasSession && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/system-panel'
    return NextResponse.redirect(url)
  }

  if (hasSession && request.nextUrl.pathname.startsWith('/auth/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/system-panel'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
