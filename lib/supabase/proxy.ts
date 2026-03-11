import { NextResponse, type NextRequest } from 'next/server'

/**
 * Session update is skipped in Edge middleware because supabase.auth.getUser()
 * triggers a fetch that often fails or times out in the Edge runtime (fetch failed).
 * Session refresh happens in Node.js when Server Components or API routes run.
 * This just passes the request through.
 */
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
