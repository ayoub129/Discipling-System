'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
export function PasswordForm({ reset = false }: { reset?: boolean }) {
  const [value, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const supabase = createClient()
      if (reset) {
        if (value.length < 8 || value !== confirm) throw new Error('Use at least 8 characters and matching passwords.')
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('This link has expired. Request a new password reset.')
        const { error } = await supabase.auth.updateUser({ password: value })
        if (error) throw error
        window.location.assign('/system-panel')
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(value, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password` })
        if (error) throw error
        setDone(true)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again') } finally { setBusy(false) }
  }
  return <main className="min-h-screen grid place-items-center p-6"><Card className="w-full max-w-md p-8 space-y-6"><div><p className="text-primary text-sm mb-2">Discipline</p><h1 className="text-2xl font-bold">{reset ? 'Choose a new password' : 'Reset your password'}</h1><p className="text-muted-foreground mt-2">{reset ? 'Use a unique password with at least 8 characters.' : 'We’ll email you a link to get back into your account.'}</p></div>{done ? <p role="status">If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.</p> : <form onSubmit={submit} className="space-y-4"><Label htmlFor="recovery">{reset ? 'New password' : 'Email'}</Label><Input id="recovery" type={reset ? 'password' : 'email'} autoComplete={reset ? 'new-password' : 'email'} required minLength={reset ? 8 : undefined} value={value} onChange={e => setValue(e.target.value)} />{reset && <><Label htmlFor="confirmation">Confirm password</Label><Input id="confirmation" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></>}{error && <p role="alert" className="text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy ? 'Please wait…' : reset ? 'Save password' : 'Send reset link'}</Button></form>}<Link href="/auth/login" className="block text-sm text-primary">Back to sign in</Link></Card></main>
}
