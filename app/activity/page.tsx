'use client'
import { useEffect, useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Gift, TrendingUp, AlertCircle, Clock } from 'lucide-react'
interface Activity { id: string; type: string; title: string; description: string; xp_delta: number; points_delta: number; penalty_delta: number; created_at: string }
export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    fetch(`/api/activity?type=${filter}&page=${page}`, { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Could not load your activity. Please retry.')
      const data = await res.json(); setActivities(data.activities || []); setTotal(data.total)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filter, page, retry])
  return <div className="min-h-screen"><Sidebar /><div className="md:ml-64"><Header /><main className="p-4 md:p-8 max-w-4xl mx-auto"><p className="text-primary text-sm font-medium mb-2">Your journey</p><h1 className="text-3xl font-bold mb-2">Activity</h1><p className="text-muted-foreground mb-8">Every completed quest and earned reward, recorded as it happened.</p><div className="flex gap-2 flex-wrap mb-6">{[['all','All activity'],['quest-completed','Quests'],['reward-redeemed','Rewards'],['level-up','Levels'],['penalty-triggered','Penalties']].map(([key,label]) => <Button key={key} variant={filter === key ? 'default' : 'outline'} onClick={() => { setFilter(key); setPage(1) }}>{label}</Button>)}</div><Card className="divide-y divide-border overflow-hidden">{loading ? <p role="status" className="p-8">Loading activity…</p> : error ? <div className="p-8"><p role="alert">{error}</p><Button onClick={() => setRetry(v => v+1)} className="mt-4">Retry</Button></div> : activities.length === 0 ? <div className="p-12 text-center"><Clock className="mx-auto text-primary mb-4" /><h2 className="font-semibold">Your story starts here</h2><p className="text-muted-foreground mt-2">Complete your first quest to see your progress.</p></div> : activities.map(a => { const Icon = a.type === 'quest-completed' ? CheckCircle2 : a.type === 'reward-redeemed' ? Gift : a.type === 'level-up' ? TrendingUp : AlertCircle; return <article key={a.id} className="p-5 flex gap-4"><div className="p-3 bg-primary/10 rounded-xl h-fit"><Icon size={20} className="text-primary" /></div><div className="flex-1"><h2 className="font-semibold">{a.title}</h2><p className="text-muted-foreground text-sm">{a.description}</p><time className="text-xs text-muted-foreground" dateTime={a.created_at}>{new Date(a.created_at).toLocaleString()}</time></div><div className="text-sm font-medium text-right">{a.xp_delta !== 0 && <p>{a.xp_delta > 0 ? '+' : ''}{a.xp_delta} XP</p>}{a.points_delta !== 0 && <p>{a.points_delta > 0 ? '+' : ''}{a.points_delta} points</p>}{a.penalty_delta !== 0 && <p>{a.penalty_delta > 0 ? '+' : ''}{a.penalty_delta} penalty points</p>}</div></article> })}</Card><div className="mt-6 flex justify-between items-center"><Button variant="outline" disabled={page===1 || loading} onClick={() => setPage(v=>v-1)}>Previous</Button><p className="text-sm text-muted-foreground">Page {page} of {Math.max(1,Math.ceil(total/30))}</p><Button variant="outline" disabled={page*30>=total || loading} onClick={() => setPage(v=>v+1)}>Next</Button></div></main></div></div>
}
