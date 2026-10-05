'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useUser } from '@/components/user-context'
export function Onboarding() {
 const { user } = useUser()
 const [dismissed,setDismissed]=useState(false)
 if (dismissed || !user || user.currentXP>0 || user.level>1) return null
 return <Card className="m-4 md:m-6 p-6 bg-gradient-to-br from-primary/10 to-secondary/5"><div className="flex items-start gap-4"><Sparkles className="text-primary shrink-0" /><div className="flex-1"><h2 className="text-xl font-semibold">One small win starts your journey.</h2><p className="text-muted-foreground mt-2 max-w-2xl">Create a quest for today, complete it to earn XP, and save your points for a reward you choose. Ranks grow with your level. Your discipline score reflects your completion rate over the last 30 days.</p><div className="flex gap-3 mt-5"><Button asChild><Link href="/quests">Create your first quest <ArrowRight size={16} /></Link></Button><Button variant="ghost" onClick={()=>setDismissed(true)}>Got it</Button></div><p className="text-xs text-muted-foreground mt-3">Rewards are personal commitments—redeeming one records it and spends points. Penalties are optional rules you create.</p></div></div></Card>
}
