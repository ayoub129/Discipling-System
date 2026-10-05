import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
let checks=0;
const userA='11111111-1111-4111-8111-111111111111',userB='22222222-2222-4222-8222-222222222222';
async function actor(id){await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('set role authenticated');}
async function rpc(name,args=[]){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as value`,args)).rows[0].value;}
async function rejects(fn,pattern){await assert.rejects(fn,pattern);checks++;}
async function equal(actual,expected){assert.equal(actual,expected);checks++;}
try {
 await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; grant usage on schema auth to authenticated,anon; create table auth.users(id uuid primary key,email text); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
 for(const file of ['202610050001_baseline.sql','202610050002_atomic_operations.sql','202610050003_maintenance.sql']) {
  await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8')); console.log('Migration passed:',file);
 }
 await db.query('insert into auth.users values($1,$2),($3,$4)',[userA,'a@example.test',userB,'b@example.test']);
 await actor(userA); await rpc('maintain_discipline_user');
 const today=(await db.query('select current_date::text as date')).rows[0].date;
 const q=await rpc('save_discipline_quest',[{title:'First quest',date:today,xp_reward:160,reward_points:50,penalties_points:5,max_minus_points:3}]);
 await rpc('transition_discipline_quest',[q.id,'in-progress']);
 const firstStart=(await db.query('select actual_start from public.quests where id=$1',[q.id])).rows[0].actual_start;
 await rpc('transition_discipline_quest',[q.id,'in-progress']);
 await equal(String((await db.query('select actual_start from public.quests where id=$1',[q.id])).rows[0].actual_start),String(firstStart));
 await Promise.all([rpc('transition_discipline_quest',[q.id,'completed']),rpc('transition_discipline_quest',[q.id,'completed'])]);
 let stats=(await db.query('select * from public.user_stats')).rows[0];
 await equal(Number(stats.total_xp_earned),160);await equal(Number(stats.reward_points_balance),50);await equal(stats.current_level,2);await equal(Number(stats.current_xp),60);
 await equal((await db.query(`select count(*)::int as n from public.system_events where event_key=$1`,['quest:'+q.id])).rows[0].n,1);
 await rejects(()=>rpc('transition_discipline_quest',[q.id,'in-progress']),/cannot make/);
 await rejects(()=>rpc('save_discipline_quest',[{title:'Changed'},q.id]),/Only pending/);
 await rejects(()=>rpc('save_discipline_quest',[{title:'Bad XP',date:today,xp_reward:-1}]),/Points and XP/);
 await rejects(()=>db.query('update public.user_stats set reward_points_balance=999'),/permission denied/);
 await rejects(()=>db.query(`update public.quests set status='completed'`),/permission denied/);
 const r=(await db.query(`insert into public.rewards(user_id,name,point_cost,minimum_level) values($1,'Tea break',30,1) returning id`,[userA])).rows[0];
 const request='33333333-3333-4333-8333-333333333333';
 await rpc('redeem_discipline_reward',[r.id,request]);await rpc('redeem_discipline_reward',[r.id,request]);
 await equal(Number((await db.query('select reward_points_balance from public.user_stats')).rows[0].reward_points_balance),20);
 await rejects(()=>rpc('redeem_discipline_reward',[r.id,'44444444-4444-4444-8444-444444444444']),/Not enough/);
 const locked=(await db.query(`insert into public.rewards(user_id,name,point_cost,minimum_level) values($1,'Locked',1,99) returning id`,[userA])).rows[0];
 await rejects(()=>rpc('redeem_discipline_reward',[locked.id,'55555555-5555-4555-8555-555555555555']),/requirements/);
 await rejects(()=>db.query(`insert into public.rewards(user_id,name,point_cost,is_global) values($1,'Global attack',1,true)`,[userA]),/row-level security/);
 const p=await rpc('create_discipline_penalty',[{title:'Read a chapter',severityOrder:1,triggerPoints:5,xpLossIfMissed:15,dueInHours:1}]);
 await equal(p.userPenalty.due_at,null);
 await rejects(()=>rpc('transition_discipline_penalty',[p.userPenalty.id,'complete']),/Activate/);
 await rejects(()=>rpc('transition_discipline_penalty',[p.userPenalty.id,'activate']),/Not enough/);
 const missed=await rpc('save_discipline_quest',[{title:'Missed',date:today,penalties_points:5}]);
 await rpc('transition_discipline_quest',[missed.id,'cancelled']);await rpc('transition_discipline_quest',[missed.id,'cancelled']);
 await equal(Number((await db.query('select total_penalties_points from public.user_stats')).rows[0].total_penalties_points),5);
 await rpc('transition_discipline_penalty',[p.userPenalty.id,'activate']);await rpc('transition_discipline_penalty',[p.userPenalty.id,'complete']);await rpc('transition_discipline_penalty',[p.userPenalty.id,'complete']);
 await equal(Number((await db.query('select total_penalties_points from public.user_stats')).rows[0].total_penalties_points),0);
 await rpc('archive_discipline_quest',[q.id]);await equal(Number((await db.query('select total_xp_earned from public.user_stats')).rows[0].total_xp_earned),160);

 // Missed days must settle automatically, including multi-day absences.
 await db.exec('reset role');
 await db.query("insert into public.quests(user_id,title,date,penalties_points) values($1,'Three days missed',current_date-3,7),($1,'Yesterday missed',current_date-1,4)",[userA]);
 await actor(userA);await rpc('maintain_discipline_user');await rpc('maintain_discipline_user');
 await equal(Number((await db.query('select total_penalties_points from public.user_stats')).rows[0].total_penalties_points),11);
 const expiring=await rpc('create_discipline_penalty',[{title:'Expiry test',severityOrder:1,triggerPoints:5,xpLossIfMissed:90,dueInHours:1}]);
 await rpc('transition_discipline_penalty',[expiring.userPenalty.id,'activate']);
 await db.exec('reset role');await db.query("update public.user_penalties set due_at=now()-interval '1 hour' where id=$1",[expiring.userPenalty.id]);
 await actor(userA);await rpc('maintain_discipline_user');await rpc('maintain_discipline_user');
 const expired=(await db.query('select status,xp_lost from public.user_penalties where id=$1',[expiring.userPenalty.id])).rows[0];
 await equal(expired.status,'expired');await equal(expired.xp_lost,90);
 stats=(await db.query('select * from public.user_stats')).rows[0];await equal(Number(stats.total_xp_earned),160);await equal(stats.current_level,1);await equal(Number(stats.current_xp),70);
 // Recurrence generates without completion; pause removes only future pending instances.
 const daily=await rpc('save_discipline_quest',[{title:'Daily routine',date:today,is_recurring:true,recurrence_rule:'FREQ=DAILY'}]);
 let occurrences=await db.query('select date from public.quests where series_id=$1',[daily.series_id]);await equal(occurrences.rows.length,31);
 await rpc('maintain_discipline_user');await equal((await db.query('select count(*)::int as n from public.quests where series_id=$1',[daily.series_id])).rows[0].n,31);
 await rpc('set_discipline_series_active',[daily.series_id,false]);await equal((await db.query('select count(*)::int as n from public.quests where series_id=$1',[daily.series_id])).rows[0].n,1);
 await rpc('set_discipline_series_active',[daily.series_id,true]);await equal((await db.query('select count(*)::int as n from public.quests where series_id=$1',[daily.series_id])).rows[0].n,31);
 // Month-end date arithmetic is anchored instead of drifting into March.
 await equal((await db.query("select (date '2028-01-31'+interval '1 month')::date::text as next")).rows[0].next,'2028-02-29');
 await rejects(()=>db.query("update public.user_settings set timezone='Invalid/Zone'"),/Invalid timezone/);
 // Fixed appointments remain fixed when that preference is disabled.
 await db.exec('reset role');
 const times=await db.query("insert into public.quests(user_id,title,date,planned_start,planned_end,is_fixed,status) values($1,'Running late',current_date,now()-interval '2 hours',now()-interval '1 hour',true,'in-progress'),($1,'Fixed appointment',current_date,now()-interval '1 hour',now()+interval '1 hour',true,'pending') returning id,title,planned_start",[userA]);
 const late=times.rows.find(r=>r.title==='Running late'),fixed=times.rows.find(r=>r.title==='Fixed appointment');
 await actor(userA);await rpc('transition_discipline_quest',[late.id,'completed']);
 await equal(String((await db.query('select planned_start from public.quests where id=$1',[fixed.id])).rows[0].planned_start),String(fixed.planned_start));
 await actor(userB);await rpc('maintain_discipline_user');
 await equal((await db.query('select count(*)::int as n from public.quests')).rows[0].n,0);
 await equal((await db.query('select count(*)::int as n from public.reward_redemptions')).rows[0].n,0);
 await rejects(()=>rpc('transition_discipline_quest',[q.id,'completed']),/Quest not found/);
 await rejects(()=>rpc('redeem_discipline_reward',[r.id,'66666666-6666-4666-8666-666666666666']),/unavailable/);
 const foreignCategory=(await (async()=>{await db.exec('reset role');return db.query('select id from public.quest_categories where user_id=$1 limit 1',[userA])})()).rows[0].id;
 await actor(userB);
 await rejects(()=>rpc('save_discipline_quest',[{title:'Foreign ref',date:today,category:foreignCategory}]),/Category not found/);
 await db.exec('reset role');
 await db.query(`select set_config('request.jwt.claim.sub','',false)`);await db.exec('set role anon');
 await rejects(()=>rpc('maintain_discipline_user'),/permission denied/);
 console.log(`${checks} database assertions passed: exactly-once earnings, retries, eligibility, transitions, atomic rollback, immutable history, and account isolation.`);
} catch(error) { console.error(error.message); console.error(error.stack); process.exitCode=1; }
await db.close();
