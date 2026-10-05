import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { id } from '@/lib/validation'
import { apiError, databaseError, parseBody } from '@/lib/api'
export async function GET(){try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const {data,error}=await supabase.from('quest_series').select('*').eq('user_id',user.id).order('created_at',{ascending:false});if(error)return databaseError(error);return NextResponse.json({series:data})}catch(e){return apiError(e)}}
export async function PATCH(request:Request){try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});const input=await parseBody(request,z.object({id,active:z.boolean()}));const {data,error}=await supabase.rpc('set_discipline_series_active',{p_id:input.id,p_active:input.active});if(error)return databaseError(error);return NextResponse.json({success:true,series:data})}catch(e){return apiError(e)}}
