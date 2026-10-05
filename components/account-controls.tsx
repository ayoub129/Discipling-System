'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
export function AccountControls(){
 const [open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[busy,setBusy]=useState(false)
 const remove=async()=>{setBusy(true);try{const res=await fetch('/api/account/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,confirmation})});const data=await res.json();if(!res.ok)throw new Error(data.error);window.location.assign('/auth/login')}catch(e){toast.error(e instanceof Error?e.message:'Could not delete account')}finally{setBusy(false)}}
 return <Card className="p-6"><h2 className="text-lg font-semibold">Your account and data</h2><p className="text-muted-foreground text-sm mt-2 mb-4">Download a copy of your history, change your password, or close your account.</p><div className="flex gap-3 flex-wrap"><Button asChild variant="outline"><a href="/api/account/export">Export my data</a></Button><Button asChild variant="outline"><Link href="/auth/forgot-password">Change password</Link></Button><Button variant="ghost" className="text-destructive" onClick={()=>setOpen(true)}>Delete account</Button></div><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Delete your account permanently?</DialogTitle></DialogHeader><p className="text-muted-foreground">Your quests, rewards, settings, and history will be removed. Export your data first. This cannot be undone.</p><Label htmlFor="delete-password">Current password</Label><Input id="delete-password" autoComplete="current-password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/><Label htmlFor="delete-confirmation">Type DELETE to confirm</Label><Input id="delete-confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/><Button variant="destructive" disabled={busy||confirmation!=='DELETE'||!password} onClick={remove}>{busy?'Deleting…':'Delete my account'}</Button></DialogContent></Dialog></Card>
}
