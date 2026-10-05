import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next({ request })
  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data, error } = await supabase.auth.getClaims()
  const authenticated = !error && Boolean(data?.claims?.sub)
  const path = request.nextUrl.pathname
  const publicPath = path.startsWith('/auth/') || path.startsWith('/api/') || path === '/setup'
  let destination: string | null = null
  if (!authenticated && !publicPath) destination = '/auth/login'
  if (authenticated && (path === '/' || path === '/auth/login' || path === '/auth/signup')) destination = '/system-panel'
  if (destination) {
    const target = request.nextUrl.clone()
    target.pathname = destination
    target.search = ''
    const redirect = NextResponse.redirect(target)
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie))
    return redirect
  }
  return response
}
