import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const db=new PGlite();const u='11111111-1111-4111-8111-111111111111';
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 await db.exec(fs.readFileSync('supabase/migrations/202610050001_baseline.sql','utf8'));
 // Reproduce the inspected legacy column/constraint names, then seed old data.
 await db.exec(`
  drop table public.system_events;
  alter table public.user_settings drop column sounds_enabled,drop column effects_enabled;
  alter table public.quests drop column timezone,drop column series_id cascade,drop column archived_at;
  alter table public.quest_categories drop column archived_at;
  alter table public.penalty_definitions drop column archived_at;
  alter table public.user_stats drop column legacy_earned_adjustment;
  alter table public.reward_redemptions drop column reward_name,drop column request_id cascade;
  alter table public.user_penalties drop column trigger_points,drop column xp_loss_if_missed,drop column due_in_hours;
  alter table public.rank_history rename column from_rank_id to old_rank_id;
  alter table public.rank_history rename column to_rank_id to new_rank_id;
  alter table public.rank_history rename column level_reached to trigger_level;
  alter table public.rank_history rename column created_at to changed_at;
  alter table public.quests rename constraint quests_category_user_id_fkey to quests_category_fkey;
  alter table public.quests rename constraint quests_rank_id_user_id_fkey to quests_rank_id_fkey;
  alter table public.rewards rename constraint rewards_minimum_rank_id_user_id_fkey to rewards_minimum_rank_id_fkey;
  alter table public.user_penalties rename constraint user_penalties_penalty_definition_id_user_id_fkey to user_penalties_penalty_definition_id_fkey;
  alter table public.user_stats rename constraint user_stats_current_rank_id_user_id_fkey to user_stats_current_rank_id_fkey;
  alter table public.rank_progression_rules rename constraint rank_progression_rules_from_rank_id_user_id_fkey to rank_progression_rules_from_rank_id_fkey;
  alter table public.rank_progression_rules rename constraint rank_progression_rules_to_rank_id_user_id_fkey to rank_progression_rules_to_rank_id_fkey;
 `);
 await db.query(`insert into auth.users(id,email) values($1,'legacy@example.test');`,[u]);
 await db.query(`insert into public.profiles(id,email,username) values($1,'legacy@example.test','Legacy');insert into public.user_settings(user_id) values($1);`,[u]).catch(async()=>{await db.query('insert into public.profiles(id,email,username) values($1,$2,$3)',[u,'legacy@example.test','Legacy']);await db.query('insert into public.user_settings(user_id) values($1)',[u])});
 await db.query('insert into public.user_stats(user_id,current_level,current_xp,xp_to_next_level,total_xp_earned,reward_points_balance,total_penalties_points,longest_streak_days) values($1,24,1237,1250,17635,195,6,8)',[u]);
 await db.query(`insert into public.quests(user_id,title,date,status,xp_reward,reward_points,actual_end) values($1,'Historic win',current_date-2,'completed',500,10,now()-interval '2 days')`,[u]);
 const oldQuest=(await db.query('select id from public.quests')).rows[0].id;
 const reward=(await db.query(`insert into public.rewards(user_id,name,point_cost) values($1,'Old reward',5) returning id`,[u])).rows[0].id;
 await db.query('insert into public.reward_redemptions(user_id,reward_id,point_cost) values($1,$2,5)',[u,reward]);
 await db.exec(fs.readFileSync('supabase/live-upgrade.sql','utf8'));
 assert.equal((await db.query('select count(*)::int as n from discipline_backup_20261005.quests')).rows[0].n,1);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[u]);await db.exec('set role authenticated');
 await db.exec('select public.maintain_discipline_user()');
 const stats=(await db.query('select * from public.user_stats')).rows[0];
 assert.equal(stats.current_level,24);assert.equal(Number(stats.current_xp),1237);assert.equal(Number(stats.total_xp_earned),17635);assert.equal(Number(stats.reward_points_balance),195);assert.equal(Number(stats.total_penalties_points),6);assert.equal(stats.longest_streak_days,8);
 const redemptions=(await db.query('select * from public.reward_redemptions')).rows;assert.equal(redemptions.length,1);assert.equal(redemptions[0].reward_name,'Old reward');
 await db.query("select public.transition_discipline_quest($1,'completed')",[oldQuest]);
 assert.equal(Number((await db.query('select total_xp_earned from public.user_stats')).rows[0].total_xp_earned),17635);
 const rank=(await db.query('select id from public.rank_definitions limit 1')).rows[0].id;
 await db.exec('reset role');await db.query('insert into public.rank_history(user_id,to_rank_id,level_reached) values($1,$2,24)',[u,rank]);
 const history=(await db.query('select * from public.rank_history where to_rank_id=$1',[rank])).rows[0];assert.equal(history.new_rank_id,rank);assert.equal(history.to_rank_id,rank);
 console.log('Legacy upgrade passed: preserved level 24, XP 1237/17635, points 195, penalty points 6, streak record 8, old quests/redemptions, and compatible rank history.');
}catch(e){console.error(e.message);process.exitCode=1}finally{await db.close()}

