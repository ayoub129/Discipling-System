'use client'
import {useState} from 'react'
import Link from 'next/link'
import {createClient} from '@/lib/supabase/client'
import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {CheckCircle} from 'lucide-react'
export default function SignupSuccessPage(){
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 const resend=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage('');setError('');try{const {error}=await createClient().auth.resend({type:'signup',email,options:{emailRedirectTo:`${window.location.origin}/auth/callback`}});if(error)throw error;setMessage('If your account is waiting for verification, a fresh link is on its way.')}catch(e){setError(e instanceof Error?e.message:'Could not send the link. Please retry.')}finally{setBusy(false)}}
 return <main className="min-h-screen grid place-items-center p-6"><Card className="w-full max-w-md p-8 space-y-6"><CheckCircle className="text-accent" size={32}/><div><h1 className="text-2xl font-semibold">Check your inbox</h1><p className="text-muted-foreground mt-3">Use the confirmation link in your email to finish setting up your account. Check your spam folder too.</p></div><form onSubmit={resend} className="space-y-3"><Label htmlFor="verification-email">Need another link? Enter your email</Label><Input id="verification-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/><Button variant="outline" disabled={busy} className="w-full">{busy?'Sending…':'Resend verification link'}</Button>{message&&<p role="status" className="text-sm text-accent">{message}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}</form><Button asChild className="w-full"><Link href="/auth/login">Back to sign in</Link></Button></Card></main>
}
