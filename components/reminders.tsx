'use client'
import { useEffect } from 'react'
import { useUser } from '@/components/user-context'
import { toast } from 'sonner'
export function Reminders(){
 const {user}=useUser()
 useEffect(()=>{
  if(!user)return
  let disposed=false;const notified=new Set<string>()
  const check=async()=>{
   const setting=await fetch('/api/user-settings');if(!setting.ok||disposed)return
   const prefs=await setting.json();if(!prefs.notifications_enabled)return
   const res=await fetch('/api/quests');if(!res.ok||disposed)return
   const {quests}=await res.json()
   for(const q of quests||[]){
    if(!q.planned_start||!['pending','delayed'].includes(q.status))continue
    const minutes=(new Date(q.planned_start).getTime()-Date.now())/60000
    const key=q.id+':'+q.planned_start
    if(minutes<0||minutes>5||notified.has(key))continue
    notified.add(key);toast.info(`Starting soon: ${q.title}`)
    if('Notification' in window&&Notification.permission==='granted')new Notification('Your next quest',{body:q.title,tag:key})
   }
  }
  void check().catch(()=>{});const timer=setInterval(()=>{void check().catch(()=>{})},60000)
  return()=>{disposed=true;clearInterval(timer)}
 },[user?.email])
 return null
}
