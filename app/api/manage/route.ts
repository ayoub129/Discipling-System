import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { id, shortText, amount } from '@/lib/validation'
const color=z.string().regex(/^#[\da-fA-F]{6}$/)
const inputSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('reward'),id,archive:z.boolean().optional(),values:z.object({name:shortText,description:z.string().max(4000),point_cost:amount.refine(v=>v>0),minimum_level:z.number().int().min(1).max(1000),minimum_discipline_score:z.number().int().min(0).max(100),cooldown_hours:z.number().int().min(0).max(8760),max_redemptions_per_week:z.number().int().min(1).max(1000).nullable()}).optional()}),
 z.object({kind:z.literal('penalty'),id,archive:z.boolean().optional(),values:z.object({name:shortText,description:z.string().max(4000),trigger_points:amount.refine(v=>v>0),xp_loss_if_missed:amount,due_in_hours:z.number().int().min(1).max(8760)}).optional()}),
 z.object({kind:z.literal('category'),id,archive:z.boolean().optional(),values:z.object({name:shortText,description:z.string().max(4000),color,order_index:z.number().int().min(0).max(1000)}).optional()}),
 z.object({kind:z.literal('progression'),id,archive:z.boolean().optional(),values:z.object({from_rank_id:id.nullable(),to_rank_id:id,required_level:z.number().int().min(1).max(1000)}).optional()}),
])
export async function GET(){try{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 const tables=['rewards','penalty_definitions','quest_categories','rank_progression_rules','rank_definitions']
 const values=await Promise.all(tables.map(t=>supabase.from(t).select('*').eq('user_id',user.id)))
 const error=values.find(r=>r.error)?.error;if(error)return databaseError(error)
 return NextResponse.json(Object.fromEntries(tables.map((t,i)=>[t,values[i].data])))
}catch(error){return apiError(error)}}
export async function PATCH(request:Request){try{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 const input=await parseBody(request,inputSchema)
 const table={reward:'rewards',penalty:'penalty_definitions',category:'quest_categories',progression:'rank_progression_rules'}[input.kind]
 if(!input.archive&&!input.values)return NextResponse.json({error:'Provide changes to save'},{status:400})
 if(input.kind==='progression'&&input.values?.from_rank_id===input.values?.to_rank_id)return NextResponse.json({error:'Choose different ranks'},{status:400})
 let result
 if(input.archive&&input.kind==='progression')result=await supabase.from(table).delete().eq('id',input.id).eq('user_id',user.id).select('id').single()
 else {
  const values=input.archive?(input.kind==='reward'?{is_active:false}:{archived_at:new Date().toISOString()}):input.values!
  result=await supabase.from(table).update(values).eq('id',input.id).eq('user_id',user.id).select().single()
 }
 if(result.error)return databaseError(result.error)
 return NextResponse.json({success:true,item:result.data})
}catch(error){return apiError(error)}}
