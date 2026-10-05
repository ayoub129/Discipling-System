'use client'
import { useEffect,useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
export default function Series(){const [series,setSeries]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState<string|null>(null)
 useEffect(()=>{fetch('/api/series').then(async r=>{if(!r.ok)throw Error('Could not load recurring quests');setSeries((await r.json()).series)}).catch(e=>setError(e.message))},[])
 const toggle=async(s:any)=>{setBusy(s.id);try{const r=await fetch('/api/series',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id,active:!s.active})});const d=await r.json();if(!r.ok)throw Error(d.error);setSeries(v=>v.map(x=>x.id===s.id?{...x,active:!s.active}:x));toast.success(s.active?'Series paused; future pending occurrences removed':'Series resumed')}catch(e){toast.error(e instanceof Error?e.message:'Could not update series')}finally{setBusy(null)}}
 return <div><Sidebar/><div className="md:ml-64"><Header/><main className="max-w-4xl mx-auto p-4 md:p-8"><h1 className="text-3xl font-bold mb-2">Recurring quests</h1><p className="text-muted-foreground mb-8">Your routine continues even when a day is missed. Editing a quest changes only that occurrence; pause a series to stop future tasks.</p>{error&&<p role="alert">{error}</p>}{!error&&series.length===0&&<p className="text-muted-foreground">Create a recurring quest from the Quests page to start a routine.</p>}<div className="space-y-3">{series.map(s=><Card key={s.id} className="p-5 flex gap-4 items-center"><div className="flex-1"><h2 className="font-semibold">{s.template.title}</h2><p className="text-sm text-muted-foreground">{s.frequency.toLowerCase()} · {s.timezone} · {s.active?'Active':'Paused'}</p></div><Button variant="outline" disabled={busy!==null} onClick={()=>toggle(s)}>{busy===s.id?'Saving…':s.active?'Pause series':'Resume series'}</Button></Card>)}</div></main></div></div>
}
