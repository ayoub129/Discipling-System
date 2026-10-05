import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
export async function GET(request: Request) {
  const url = new URL(request.url)
  const next = url.searchParams.get('next') === '/auth/reset-password' ? '/auth/reset-password' : '/system-panel'
  const supabase = await createClient()
  const code = url.searchParams.get('code')
  const hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type')
  let success = false
  if (code) { const { error } = await supabase.auth.exchangeCodeForSession(code); success = !error }
  else if (hash && (type === 'signup' || type === 'recovery' || type === 'email')) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: hash, type: type as EmailOtpType }); success = !error
  }
  return NextResponse.redirect(new URL(success ? next : '/auth/login?error=link-expired', url.origin))
}
