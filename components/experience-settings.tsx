'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
export function ExperienceSettings({onSaved}:{onSaved?:(settings:any)=>void}){
 const [settings,setSettings]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{fetch('/api/user-settings').then(async res=>{if(!res.ok)throw new Error('Could not load experience settings');setSettings(await res.json())}).catch(e=>setError(e.message))},[])
 const save=async()=>{if(!settings)return;setBusy(true);try{
  if(settings.notifications_enabled&&'Notification' in window&&Notification.permission==='default')await Notification.requestPermission()
  const res=await fetch('/api/user-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)})
  const data=await res.json();if(!res.ok)throw new Error(data.error)
  localStorage.setItem('discipline:sounds',String(data.sounds_enabled));localStorage.setItem('discipline:effects',String(data.effects_enabled));window.dispatchEvent(new Event('discipline:settings'));onSaved?.(data);toast.success('Experience preferences saved')
 }catch(e){toast.error(e instanceof Error?e.message:'Could not save preferences')}finally{setBusy(false)}}
 return <Card className="p-6 space-y-5"><div><h2 className="text-lg font-semibold">Make it your own</h2><p className="text-sm text-muted-foreground mt-1">Gentle feedback, with you in control. Sounds are off by default.</p></div>{error?<p role="alert">{error}</p>:!settings?<p role="status">Loading preferences…</p>:<><div className="flex justify-between gap-4"><Label htmlFor="sounds">Completion sounds</Label><Switch id="sounds" checked={settings.sounds_enabled} onCheckedChange={v=>setSettings({...settings,sounds_enabled:v})}/></div><div className="flex justify-between gap-4"><Label htmlFor="effects">Celebration effects</Label><Switch id="effects" checked={settings.effects_enabled} onCheckedChange={v=>setSettings({...settings,effects_enabled:v})}/></div><div className="flex justify-between gap-4"><Label htmlFor="reminders">Reminders while the app is open</Label><Switch id="reminders" checked={settings.notifications_enabled} onCheckedChange={v=>setSettings({...settings,notifications_enabled:v})}/></div><div><Label htmlFor="timezone">Your timezone</Label><Input id="timezone" className="mt-2" placeholder="Africa/Casablanca" value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})}/><Button className="mt-2" variant="ghost" size="sm" onClick={()=>setSettings({...settings,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})}>Use this device’s timezone</Button></div><p className="text-xs text-muted-foreground">Browser notifications require permission. Reminders run while this app is open; background email and push delivery are not enabled. Effects also respect your device’s reduced-motion preference.</p><Button disabled={busy} onClick={save}>{busy?'Saving…':'Save experience preferences'}</Button></>}</Card>
}
