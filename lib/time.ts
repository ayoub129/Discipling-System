export function dateKey(date: Date, timezone: string) {
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
 const value=(key:string)=>parts.find(p=>p.type===key)?.value
 return `${value('year')}-${value('month')}-${value('day')}`
}
export function zonedTimeToIso(date:string,time:string,timezone:string) {
 const wall=new Date(`${date}T${time}:00Z`).getTime()
 let guess=wall
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})
 for(let i=0;i<4;i++){
  const parts=formatter.formatToParts(new Date(guess))
  const get=(name:string)=>Number(parts.find(p=>p.type===name)?.value)
  const represented=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'))
  const correction=wall-represented
  if(correction===0)return new Date(guess).toISOString()
  guess+=correction
 }
 throw new Error('This local time does not exist because the clock changes. Choose another time.')
}
export function addDays(date:string,days:number) {
 const value=new Date(date+'T12:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)
}
