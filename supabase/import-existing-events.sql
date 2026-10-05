-- Import historical events and an opening adjustment. No existing balance is
-- recalculated or overwritten during migration; the adjustment preserves the
-- currently recorded level/XP while retaining the old lifetime-earned total.
insert into public.system_events(user_id,event_key,type,title,description,xp_delta,points_delta,created_at)
select user_id,'quest:'||id,'quest-completed','Quest completed',title,coalesce(xp_reward,0),coalesce(reward_points,0),coalesce(actual_end,updated_at,created_at)
from public.quests where status='completed' on conflict(user_id,event_key) do nothing;
insert into public.system_events(user_id,event_key,type,title,description,penalty_delta,created_at)
select user_id,'quest:'||id,'penalty-triggered','Quest not completed',title,coalesce(penalties_points,0),coalesce(updated_at,created_at)
from public.quests where status='cancelled' on conflict(user_id,event_key) do nothing;
insert into public.system_events(user_id,event_key,type,title,description,points_delta,created_at)
select user_id,'redemption:'||id,'reward-redeemed','Reward redeemed',reward_name,-point_cost,redeemed_at from public.reward_redemptions on conflict(user_id,event_key) do nothing;
insert into public.system_events(user_id,event_key,type,title,description,xp_delta,created_at)
select user_id,'penalty:'||id,'penalty-triggered','Penalty expired',title,-coalesce(xp_lost,0),coalesce(completed_at,updated_at,issued_at) from public.user_penalties where xp_lost_applied on conflict(user_id,event_key) do nothing;
insert into public.system_events(user_id,event_key,type,title,description,xp_delta,points_delta,penalty_delta,created_at)
select s.user_id,'migration:opening','migration','Progress carried over','Opening adjustment preserving your recorded progress',
 s.current_xp+(s.current_level-1)*100+(s.current_level-1)*(s.current_level-2)*25-coalesce(e.xp,0),
 s.reward_points_balance-coalesce(e.points,0),s.total_penalties_points-coalesce(e.penalties,0),timestamptz '1970-01-01 00:00:00Z'
from public.user_stats s left join lateral(select sum(xp_delta) xp,sum(points_delta) points,sum(penalty_delta) penalties from public.system_events where user_id=s.user_id) e on true on conflict(user_id,event_key) do nothing;
update public.user_stats s set legacy_earned_adjustment=s.total_xp_earned-coalesce(e.earned,0) from(select user_id,sum(greatest(xp_delta,0)) earned from public.system_events group by user_id)e where s.user_id=e.user_id;
-- Existing recurring tasks become series without replaying old occurrences.
-- Choose the latest unfinished occurrence of each identical routine.
insert into public.quest_series(user_id,anchor_date,frequency,template,timezone,start_time,duration_minutes)
select distinct on(q.user_id,q.title,q.recurrence_rule) q.user_id,q.date,split_part(q.recurrence_rule,'=',2),to_jsonb(q),q.timezone,(q.planned_start at time zone q.timezone)::time,q.estimated_minutes
from public.quests q where q.is_recurring and q.series_id is null and q.recurrence_rule in ('FREQ=DAILY','FREQ=WEEKLY','FREQ=MONTHLY','FREQ=YEARLY') order by q.user_id,q.title,q.recurrence_rule,q.date desc;
update public.quests q set series_id=s.id from public.quest_series s where s.user_id=q.user_id and s.template->>'title'=q.title and s.frequency=split_part(q.recurrence_rule,'=',2) and q.date=s.anchor_date and q.is_recurring and q.series_id is null;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare tz text; begin
 tz:=new.raw_user_meta_data->>'timezone';if tz is null or not exists(select 1 from pg_timezone_names where name=tz) then tz:='UTC';end if;
 insert into public.profiles(id,username,email,full_name) values(new.id,coalesce(new.email,new.id::text),new.email,coalesce(new.raw_user_meta_data->>'full_name','')) on conflict(id) do nothing;
 insert into public.user_settings(user_id,timezone) values(new.id,tz) on conflict(user_id) do nothing;
 insert into public.user_stats(user_id) values(new.id) on conflict(user_id) do nothing;
 return new;
end $$;
create table public.discipline_schema_version(version text primary key,applied_at timestamptz not null default now());
insert into public.discipline_schema_version(version) values('20261005-customer-readiness');
