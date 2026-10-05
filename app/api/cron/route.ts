import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { timingSafeEqual } from 'node:crypto'
export async function GET(request:Request){
 const secret=process.env.CRON_SECRET,key=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!secret||!key)return NextResponse.json({error:'Scheduled maintenance is not configured'},{status:503})
 const supplied=Buffer.from(request.headers.get('authorization')||''),expected=Buffer.from(`Bearer ${secret}`)
 if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return NextResponse.json({error:'Unauthorized'},{status:401})
 const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,key,{auth:{persistSession:false,autoRefreshToken:false}})
 const url=new URL(request.url),after=url.searchParams.get('after')
 const {data,error}=await supabase.rpc('maintain_discipline_batch',{p_after:after||null,p_limit:100})
 if(error)return NextResponse.json({error:'Maintenance failed'},{status:500})
 return NextResponse.json({...data,next:data.processed===100?data.lastId:null})
}
