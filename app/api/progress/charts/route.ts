import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, databaseError } from '@/lib/api'
import { dateKey, addDays, zonedTimeToIso } from '@/lib/time'
export async function GET(request:Request){
 try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const range=new URL(request.url).searchParams.get('range')||'week'
  if(!['today','week'].includes(range))return NextResponse.json({error:'Invalid range'},{status:400})
  const settings=await supabase.from('user_settings').select('timezone').eq('user_id',user.id).single()
  if(settings.error)return databaseError(settings.error)
  const timezone=settings.data.timezone||'UTC',today=dateKey(new Date(),timezone)
  const day=new Date(today+'T12:00:00Z').getUTCDay()
  const start=range==='today'?today:addDays(today,day===0?-6:1-day)
  const end=addDays(start,range==='today'?1:7)
  const {data,error}=await supabase.from('system_events').select('type,xp_delta,points_delta,penalty_delta,created_at').eq('user_id',user.id).gte('created_at',zonedTimeToIso(start,'00:00',timezone)).lt('created_at',zonedTimeToIso(end,'00:00',timezone))
  if(error)return databaseError(error)
  const labels=range==='today'?Array.from({length:24},(_,i)=>String(i).padStart(2,'0')):['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const buckets=labels.map(label=>({label,xp:0,quests:0,rewardPoints:0,penalties:0}))
  for(const event of data||[]){
   const at=new Date(event.created_at)
   const idx=range==='today'?Number(new Intl.DateTimeFormat('en',{timeZone:timezone,hour:'2-digit',hourCycle:'h23'}).format(at)):Math.round((new Date(dateKey(at,timezone)+'T12:00:00Z').getTime()-new Date(start+'T12:00:00Z').getTime())/86400000)
   if(!buckets[idx])continue
   buckets[idx].xp+=Number(event.xp_delta)
   if(event.type==='quest-completed')buckets[idx].quests++
   buckets[idx].rewardPoints+=Math.max(0,Number(event.points_delta))
   if(event.penalty_delta>0||event.type==='penalty-triggered')buckets[idx].penalties++
  }
  return NextResponse.json({range,timezone,xp:buckets.map(b=>({date:b.label,value:b.xp})),quests:buckets.map(b=>({date:b.label,value:b.quests})),rewardPoints:buckets.map(b=>({date:b.label,value:b.rewardPoints})),penalties:buckets.map(b=>({date:b.label,value:b.penalties}))})
 }catch(error){return apiError(error)}
}
