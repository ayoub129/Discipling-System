import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, databaseError, parseBody } from '@/lib/api'
export async function POST(request: Request){
 try{
  const supabase=await createClient()
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401})
  const input=await parseBody(request,z.object({confirmation:z.literal('DELETE'),password:z.string().min(1).max(200)}))
  if(!user.email) return NextResponse.json({error:'Contact support to delete this account.'},{status:400})
  const verification=await supabase.auth.signInWithPassword({email:user.email,password:input.password})
  if(verification.error || verification.data.user?.id!==user.id) return NextResponse.json({error:'Password is incorrect.'},{status:403})
  const images=await supabase.storage.from('discipline-avatars').list(user.id,{limit:1000})
  if(images.error) return NextResponse.json({error:'Could not remove your stored images. Please retry.'},{status:500})
  if(images.data?.length){const removed=await supabase.storage.from('discipline-avatars').remove(images.data.map(image=>`${user.id}/${image.name}`));if(removed.error)return NextResponse.json({error:'Could not remove your stored images. Please retry.'},{status:500})}
  const {error}=await supabase.rpc('close_discipline_account',{p_confirmation:input.confirmation})
  if(error)return databaseError(error)
  await supabase.auth.signOut()
  return NextResponse.json({success:true})
 }catch(error){return apiError(error)}
}
