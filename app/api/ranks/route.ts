import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
import { id, shortText } from '@/lib/validation'
const input=z.union([
 z.object({type:z.literal('create-rank'),name:shortText,code:z.string().trim().min(1).max(80),color:z.string().regex(/^#[\da-fA-F]{6}$/),display_order:z.number().int().min(0).max(1000)}),
 z.object({type:z.literal('update-rank'),id,name:shortText,color:z.string().regex(/^#[\da-fA-F]{6}$/)}),
 z.object({type:z.literal('delete-rank'),id}),
 z.object({type:z.literal('create-progression'),from_rank_id:z.union([id,z.literal(''),z.null()]),to_rank_id:id,required_level:z.number().int().min(1).max(1000)}).refine(v=>v.from_rank_id!==v.to_rank_id,'Choose different ranks'),
])
export async function GET(){try{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 const maintenance=await supabase.rpc('maintain_discipline_user');if(maintenance.error)return databaseError(maintenance.error)
 const [ranks,rules]=await Promise.all([supabase.from('rank_definitions').select('*').eq('user_id',user.id).eq('is_active',true).order('display_order'),supabase.from('rank_progression_rules').select('*').eq('user_id',user.id)])
 if(ranks.error)return databaseError(ranks.error);if(rules.error)return databaseError(rules.error)
 return NextResponse.json({ranks:ranks.data,progressionRules:rules.data})
}catch(error){return apiError(error)}}
export async function POST(request:Request){try{
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401})
 const body=await parseBody(request,input)
 let result
 if(body.type==='create-rank')result=await supabase.from('rank_definitions').insert({user_id:user.id,name:body.name,code:body.code,color:body.color,display_order:body.display_order,is_active:true}).select().single()
 else if(body.type==='update-rank')result=await supabase.from('rank_definitions').update({name:body.name,color:body.color}).eq('id',body.id).eq('user_id',user.id).select().single()
 else if(body.type==='delete-rank')result=await supabase.from('rank_definitions').update({is_active:false}).eq('id',body.id).eq('user_id',user.id).select().single()
 else result=await supabase.from('rank_progression_rules').insert({user_id:user.id,from_rank_id:body.from_rank_id||null,to_rank_id:body.to_rank_id,required_level:body.required_level}).select().single()
 if(result.error)return databaseError(result.error)
 return NextResponse.json(body.type==='delete-rank'?{success:true}:result.data)
}catch(error){return apiError(error)}}
