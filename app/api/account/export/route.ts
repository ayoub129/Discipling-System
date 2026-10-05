import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, databaseError } from '@/lib/api'
export async function GET() {
 try {
  const supabase=await createClient()
  const { data:{user} }=await supabase.auth.getUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  const tables=['profiles','user_settings','user_stats','quests','quest_series','quest_categories','rank_definitions','rank_progression_rules','rewards','reward_redemptions','penalty_definitions','user_penalties','level_history','rank_history','streak_logs','system_events']
  const exported: Record<string, unknown[]>={}
  for(const table of tables){
   exported[table]=[]
   for(let page=0;;page++){
    const {data,error}=await supabase.from(table).select('*').eq(table==='profiles'?'id':'user_id',user.id).range(page*500,page*500+499)
    if(error) return databaseError(error)
    exported[table].push(...(data||[])); if(!data||data.length<500) break
   }
  }
  return new NextResponse(JSON.stringify({exportedAt:new Date().toISOString(),email:user.email,data:exported},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="discipline-export.json"','Cache-Control':'no-store'}})
 }catch(error){return apiError(error)}
}
