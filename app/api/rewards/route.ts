import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { rewardFields } from '@/lib/validation'
export async function GET() {
 try {
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const {data,error}=await supabase.from('rewards').select('*').or(`user_id.eq.${user.id},is_global.eq.true`).eq('is_active',true).order('point_cost').order('id')
  if(error)return databaseError(error)
  return NextResponse.json({rewards:data||[]})
 }catch(error){return apiError(error)}
}
export async function POST(request:Request) {
 try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser()
  if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
  const v=await parseBody(request,rewardFields)
  const {data,error}=await supabase.from('rewards').insert({user_id:user.id,name:v.name,description:v.description||null,category:v.category||null,point_cost:v.pointCost,minimum_level:v.minimumLevel,minimum_rank_id:v.minimumRankId||null,minimum_discipline_score:v.minimumDisciplineScore,cooldown_hours:v.cooldownHours,max_redemptions_per_week:v.maxRedemptionsPerWeek||null,is_active:true,is_global:false}).select('*').single()
  if(error)return databaseError(error)
  return NextResponse.json({reward:data},{status:201})
 }catch(error){return apiError(error)}
}
