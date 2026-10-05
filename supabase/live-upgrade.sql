begin;
-- Compatibility upgrade for the inspected 14-table Supabase schema.
-- Used before the fresh baseline in the live upgrade bundle. Never reset data.
create schema if not exists discipline_backup_20261005;
revoke all on schema discipline_backup_20261005 from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','user_stats','quests','quest_categories','rank_definitions','rank_progression_rules','rewards','reward_redemptions','penalty_definitions','user_penalties','level_history','rank_history','streak_logs'] loop
  execute format('create table if not exists discipline_backup_20261005.%I as table public.%I',t,t);
 end loop;
end $$;
create table if not exists discipline_backup_20261005.function_definitions as select n.nspname,p.proname,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f';
create table if not exists discipline_backup_20261005.policy_definitions as select * from pg_policies where schemaname='public';
alter table public.user_settings add column if not exists sounds_enabled boolean not null default false;
alter table public.user_settings add column if not exists effects_enabled boolean not null default true;
alter table public.user_settings alter column notifications_enabled set default false;
alter table public.quests add column if not exists timezone text not null default 'UTC';
alter table public.quests add column if not exists series_id uuid;
alter table public.quests add column if not exists archived_at timestamptz;
alter table public.quest_categories add column if not exists archived_at timestamptz;
alter table public.penalty_definitions add column if not exists archived_at timestamptz;
alter table public.user_stats add column if not exists legacy_earned_adjustment bigint not null default 0;
alter table public.rank_history add column if not exists from_rank_id uuid;
alter table public.rank_history add column if not exists to_rank_id uuid;
alter table public.rank_history add column if not exists level_reached integer;
alter table public.rank_history add column if not exists created_at timestamptz default now();
update public.rank_history set from_rank_id=old_rank_id,to_rank_id=new_rank_id,level_reached=trigger_level,created_at=changed_at;
create or replace function public.sync_discipline_rank_history() returns trigger language plpgsql set search_path='' as $$ begin
 new.from_rank_id:=coalesce(new.from_rank_id,new.old_rank_id);new.old_rank_id:=new.from_rank_id;
 new.to_rank_id:=coalesce(new.to_rank_id,new.new_rank_id);new.new_rank_id:=new.to_rank_id;
 new.level_reached:=coalesce(new.level_reached,new.trigger_level);new.trigger_level:=new.level_reached;
 new.created_at:=coalesce(new.created_at,new.changed_at,now());new.changed_at:=new.created_at;
 return new;
end $$;
create trigger discipline_rank_history_compat before insert or update on public.rank_history for each row execute function public.sync_discipline_rank_history();
alter table public.reward_redemptions add column if not exists reward_name text;
alter table public.reward_redemptions add column if not exists request_id uuid not null default gen_random_uuid();
update public.reward_redemptions d set reward_name=r.name from public.rewards r where d.reward_id=r.id and d.reward_name is null;
alter table public.reward_redemptions alter column reward_name set not null;
alter table public.reward_redemptions add constraint redemptions_request_unique unique(user_id,request_id);
alter table public.user_penalties add column if not exists trigger_points integer;
alter table public.user_penalties add column if not exists xp_loss_if_missed integer;
alter table public.user_penalties add column if not exists due_in_hours integer;
update public.user_penalties p set trigger_points=d.trigger_points,xp_loss_if_missed=d.xp_loss_if_missed,due_in_hours=d.due_in_hours from public.penalty_definitions d where d.id=p.penalty_definition_id;
update public.user_penalties set status='in-progress' where status='active';
alter table public.user_penalties alter column status set default 'created';
alter table public.user_penalties alter column trigger_points set not null;
alter table public.user_penalties alter column xp_loss_if_missed set not null;
alter table public.user_penalties alter column due_in_hours set not null;
alter table public.rank_definitions add constraint rank_owner_unique unique(id,user_id);
alter table public.quest_categories add constraint category_owner_unique unique(id,user_id);
alter table public.penalty_definitions add constraint penalty_owner_unique unique(id,user_id);
alter table public.quests add constraint quest_occurrence_unique unique(series_id,date);
-- Replace single-column references with references that prove matching owners.
alter table public.quests drop constraint quests_category_fkey;
alter table public.quests add constraint quests_category_fkey foreign key(category,user_id) references public.quest_categories(id,user_id);
alter table public.quests drop constraint quests_rank_id_fkey;
alter table public.quests add constraint quests_rank_id_fkey foreign key(rank_id,user_id) references public.rank_definitions(id,user_id);
alter table public.rewards drop constraint rewards_minimum_rank_id_fkey;
alter table public.rewards add constraint rewards_minimum_rank_id_fkey foreign key(minimum_rank_id,user_id) references public.rank_definitions(id,user_id);
alter table public.user_penalties drop constraint user_penalties_penalty_definition_id_fkey;
alter table public.user_penalties add constraint user_penalties_penalty_definition_id_fkey foreign key(penalty_definition_id,user_id) references public.penalty_definitions(id,user_id);
alter table public.user_stats drop constraint user_stats_current_rank_id_fkey;
alter table public.user_stats add constraint user_stats_current_rank_id_fkey foreign key(current_rank_id,user_id) references public.rank_definitions(id,user_id);
alter table public.rank_progression_rules drop constraint rank_progression_rules_from_rank_id_fkey;
alter table public.rank_progression_rules add constraint rank_progression_rules_from_rank_id_fkey foreign key(from_rank_id,user_id) references public.rank_definitions(id,user_id);
alter table public.rank_progression_rules drop constraint rank_progression_rules_to_rank_id_fkey;
alter table public.rank_progression_rules add constraint rank_progression_rules_to_rank_id_fkey foreign key(to_rank_id,user_id) references public.rank_definitions(id,user_id);
update public.user_stats set current_level=coalesce(current_level,1),current_xp=coalesce(current_xp,0),xp_to_next_level=coalesce(xp_to_next_level,100),total_xp_earned=coalesce(total_xp_earned,0),reward_points_balance=coalesce(reward_points_balance,0),total_penalties_points=coalesce(total_penalties_points,0),longest_streak_days=coalesce(longest_streak_days,0);
update public.rewards set max_redemptions_per_week=null where max_redemptions_per_week=0;
-- Replace existing policies atomically with the reviewed baseline policies.
do $$ declare p record; begin
 for p in select * from pg_policies where schemaname='public' and tablename=any(array['profiles','user_settings','rank_definitions','rank_progression_rules','quest_categories','quests','rewards','penalty_definitions','user_penalties','user_stats','reward_redemptions','level_history','rank_history','streak_logs','system_events']) loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
-- Enforce the same invariants for new writes into legacy tables.
alter table public.quests add constraint discipline_quest_amounts check(xp_reward between 0 and 10000 and reward_points between 0 and 10000 and penalties_points between 0 and 10000 and max_minus_points between 0 and 10000) not valid;
alter table public.quests add constraint discipline_quest_times check((planned_start is null and planned_end is null) or (planned_start is not null and planned_end>planned_start)) not valid;
alter table public.quests add constraint discipline_quest_status check(status in ('pending','in-progress','completed','delayed','cancelled')) not valid;
alter table public.quests add constraint discipline_quest_title check(length(trim(title)) between 1 and 200) not valid;
alter table public.rewards add constraint discipline_reward_amounts check(point_cost between 1 and 10000 and minimum_level between 1 and 1000 and minimum_discipline_score between 0 and 100 and cooldown_hours between 0 and 8760 and (max_redemptions_per_week is null or max_redemptions_per_week between 1 and 1000)) not valid;
alter table public.penalty_definitions add constraint discipline_penalty_amounts check(trigger_points between 1 and 10000 and xp_loss_if_missed between 0 and 10000 and due_in_hours between 1 and 8760) not valid;
alter table public.user_stats add constraint discipline_balances check(reward_points_balance>=0 and total_penalties_points>=0) not valid;
alter table public.user_settings add constraint discipline_day_window check(day_end_time>day_start_time) not valid;
alter table public.user_stats alter column current_xp type bigint,alter column total_xp_earned type bigint,alter column xp_to_next_level type bigint,alter column reward_points_balance type bigint,alter column total_penalties_points type bigint;
alter table public.level_history alter column xp_at_level_up type bigint;

-- Fresh-project baseline. For an existing project, inspect its schema first and
-- reconcile changes in a separate additive migration; do not reset customer data.

create table if not exists public.profiles (
 id uuid primary key references auth.users on delete cascade,
 username text, full_name text, email text, avatar_url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.user_settings (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users on delete cascade,
 theme text not null default 'dark' check(theme in ('dark','light','system')),
 timezone text not null default 'UTC', day_start_time time not null default '07:00', day_end_time time not null default '23:00',
 notifications_enabled boolean not null default false, allow_auto_shift boolean not null default true,
 allow_fixed_quests_shift boolean not null default false, sounds_enabled boolean not null default false,
 effects_enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(day_end_time > day_start_time)
);
create table if not exists public.rank_definitions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null, code text not null, color text not null default '#818cf8', display_order integer not null default 0,
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(user_id,code), unique(id,user_id)
);
create table if not exists public.rank_progression_rules (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 from_rank_id uuid, to_rank_id uuid not null, required_level integer not null check(required_level between 1 and 1000),
 foreign key(from_rank_id,user_id) references public.rank_definitions(id,user_id),
 foreign key(to_rank_id,user_id) references public.rank_definitions(id,user_id), check(from_rank_id is distinct from to_rank_id)
);
create table if not exists public.user_stats (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users on delete cascade,
 legacy_earned_adjustment bigint not null default 0, current_level integer not null default 1, current_xp bigint not null default 0, total_xp_earned bigint not null default 0,
 xp_to_next_level bigint not null default 100, current_rank_id uuid,
 reward_points_balance bigint not null default 0 check(reward_points_balance >= 0),
 total_penalties_points bigint not null default 0 check(total_penalties_points >= 0),
 discipline_score integer not null default 0 check(discipline_score between 0 and 100),
 current_streak_days integer not null default 0, longest_streak_days integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(current_rank_id,user_id) references public.rank_definitions(id,user_id)
);
create table if not exists public.quest_categories (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null, archived_at timestamptz, color text not null default '#818cf8', description text, order_index integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name), unique(id,user_id)
);
create table if not exists public.quests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 title text not null check(length(trim(title)) between 1 and 200), description text, category uuid, rank_id uuid,
 date date not null, timezone text not null default 'UTC', planned_start timestamptz, planned_end timestamptz,
 actual_start timestamptz, actual_end timestamptz, estimated_minutes integer, actual_minutes integer,
 shifted_by_minutes integer not null default 0,
 status text not null default 'pending' check(status in ('pending','in-progress','completed','delayed','cancelled')),
 xp_reward integer not null default 0 check(xp_reward between 0 and 10000),
 reward_points integer not null default 0 check(reward_points between 0 and 10000),
 penalties_points integer not null default 0 check(penalties_points between 0 and 10000),
 max_minus_points integer not null default 0 check(max_minus_points between 0 and 10000), current_minus_points integer not null default 0,
 is_fixed boolean not null default false, is_recurring boolean not null default false, recurrence_rule text,
 series_id uuid, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(category,user_id) references public.quest_categories(id,user_id),
 foreign key(rank_id,user_id) references public.rank_definitions(id,user_id),
 check((planned_start is null and planned_end is null) or (planned_start is not null and planned_end > planned_start)),
 unique(series_id,date)
);
create index if not exists quests_user_date on public.quests(user_id,date);
create table if not exists public.rewards (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users on delete cascade,
 name text not null check(length(trim(name)) between 1 and 200), description text, category text,
 point_cost integer not null check(point_cost between 1 and 10000), minimum_level integer not null default 1,
 minimum_rank_id uuid, minimum_discipline_score integer not null default 0 check(minimum_discipline_score between 0 and 100),
 cooldown_hours integer not null default 0 check(cooldown_hours between 0 and 8760),
 max_redemptions_per_week integer check(max_redemptions_per_week > 0), is_active boolean not null default true,
 is_global boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(minimum_rank_id,user_id) references public.rank_definitions(id,user_id)
);
create table if not exists public.reward_redemptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 reward_id uuid not null references public.rewards, point_cost integer not null check(point_cost > 0),
 reward_name text not null, note text, request_id uuid not null, redeemed_at timestamptz not null default now(), unique(user_id,request_id)
);
create index if not exists redemptions_user_reward_time on public.reward_redemptions(user_id,reward_id,redeemed_at);
create table if not exists public.penalty_definitions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 name text not null, description text, severity_order integer not null default 1,
 trigger_points integer not null check(trigger_points between 1 and 10000), xp_loss_if_missed integer not null default 0 check(xp_loss_if_missed between 0 and 10000),
 due_in_hours integer not null check(due_in_hours between 1 and 8760), is_active boolean not null default false,
 archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id)
);
create table if not exists public.user_penalties (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 penalty_definition_id uuid not null, title text not null, description text,
 status text not null default 'created' check(status in ('created','in-progress','done','expired')),
 issued_at timestamptz not null default now(), due_at timestamptz, completed_at timestamptz,
 xp_lost_applied boolean not null default false, xp_lost integer not null default 0,
 trigger_points integer not null, xp_loss_if_missed integer not null, due_in_hours integer not null,
 updated_at timestamptz not null default now(), foreign key(penalty_definition_id,user_id) references public.penalty_definitions(id,user_id)
);
create unique index if not exists one_open_penalty on public.user_penalties(penalty_definition_id) where status in ('created','in-progress');
create table if not exists public.level_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 old_level integer not null, new_level integer not null, xp_at_level_up bigint not null, created_at timestamptz not null default now()
);
create table if not exists public.rank_history (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 from_rank_id uuid, to_rank_id uuid not null, level_reached integer not null, created_at timestamptz not null default now()
);
create table if not exists public.streak_logs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 date date not null, qualified boolean not null, reason text, streak_count_after_evaluation integer not null default 0,
 unique(user_id,date)
);
create table if not exists public.system_events (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 event_key text not null, type text not null, title text not null, description text,
 xp_delta bigint not null default 0, points_delta bigint not null default 0, penalty_delta bigint not null default 0,
 created_at timestamptz not null default now(), unique(user_id,event_key)
);
create index if not exists events_user_time on public.system_events(user_id,created_at desc);
-- Every client-visible table is isolated. Financial/progression tables have no
-- direct write grant; only authenticated, ownership-checked RPCs mutate them.
do $$ declare t text; begin
 foreach t in array array['profiles','user_settings','rank_definitions','rank_progression_rules','quest_categories','quests','rewards','penalty_definitions','user_penalties','user_stats','reward_redemptions','level_history','rank_history','streak_logs','system_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  if t = 'profiles' then
   execute format('create policy own_read on public.%I for select to authenticated using (id = (select auth.uid()))',t);
  elsif t = 'rewards' then
   execute format('create policy own_read on public.%I for select to authenticated using (user_id = (select auth.uid()) or is_global)',t);
  else
   execute format('create policy own_read on public.%I for select to authenticated using (user_id = (select auth.uid()))',t);
  end if;
 end loop;
 foreach t in array array['user_settings','rank_definitions','rank_progression_rules','quest_categories','rewards','penalty_definitions'] loop
  execute format('grant insert, update on public.%I to authenticated',t);
  execute format('create policy own_insert on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',t);
  execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',t);
  execute format('create policy own_delete on public.%I for delete to authenticated using (user_id = (select auth.uid()))',t);
 end loop;
end $$;
-- Personal rewards cannot become global by editing a row.
revoke update on public.rewards from authenticated;
grant update(name,description,category,point_cost,minimum_level,minimum_rank_id,minimum_discipline_score,cooldown_hours,max_redemptions_per_week,is_active,updated_at) on public.rewards to authenticated;
create policy personal_reward_insert on public.rewards as restrictive for insert to authenticated with check(not is_global);
grant update(username,full_name,avatar_url,updated_at) on public.profiles to authenticated;
create policy own_profile_update on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant delete on public.rank_progression_rules to authenticated;


create table public.quest_series (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 anchor_date date not null, frequency text not null check(frequency in ('DAILY','WEEKLY','MONTHLY','YEARLY')),
 template jsonb not null, timezone text not null default 'UTC', start_time time, duration_minutes integer,
 active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.quest_series enable row level security;
create policy own_series_read on public.quest_series for select to authenticated using(user_id=(select auth.uid()));
create policy own_series_update on public.quest_series for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,update(active) on public.quest_series to authenticated;

create function public.initialize_discipline_user() returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); base_rank uuid; begin
 if u is null then raise exception 'Sign in to continue'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 insert into public.profiles(id,email,username) select id,email,split_part(email,'@',1)||'-'||left(u::text,6) from auth.users where id=u on conflict(id) do nothing;
 insert into public.user_settings(user_id) values(u) on conflict(user_id) do nothing;
 if not exists(select 1 from public.rank_definitions where user_id=u) then
  insert into public.rank_definitions(user_id,name,code,color,display_order)
  select u,code||'-Rank',code,'#818cf8',ord from (values('F',0),('E',1),('D',2),('C',3),('B',4),('A',5),('S',6)) as r(code,ord);
  insert into public.rank_progression_rules(user_id,from_rank_id,to_rank_id,required_level)
  select u,a.id,b.id,b.display_order*5+1 from public.rank_definitions a join public.rank_definitions b on b.user_id=a.user_id and b.display_order=a.display_order+1 where a.user_id=u;
 end if;
 select id into base_rank from public.rank_definitions where user_id=u order by display_order limit 1;
 insert into public.user_stats(user_id,current_rank_id) values(u,base_rank) on conflict(user_id) do nothing;
 insert into public.quest_categories(user_id,name,color,order_index) values(u,'Personal','#818cf8',0),(u,'Health','#34d399',1),(u,'Work','#60a5fa',2) on conflict(user_id,name) do nothing;
end $$;

create function public.refresh_discipline_stats() returns void language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); s public.user_stats; effective_xp bigint; earned bigint; lvl int:=1; threshold bigint:=100; xp bigint; rk uuid; next_rk uuid; seen uuid[]:='{}'; today date; cursor_day date; streak int:=0; longest int:=0; run int:=0; ratio numeric; d record; begin
 if u is null then raise exception 'Sign in to continue'; end if;
 perform public.initialize_discipline_user();
 select * into s from public.user_stats where user_id=u for update;
 select coalesce(sum(xp_delta),0),coalesce(sum(greatest(xp_delta,0)),0) into effective_xp,earned from public.system_events where user_id=u;
 earned:=earned+s.legacy_earned_adjustment;
 xp:=greatest(0,effective_xp);
 while xp>=threshold loop xp:=xp-threshold; lvl:=lvl+1; threshold:=100+(lvl-1)*50; end loop;
 select id into rk from public.rank_definitions where user_id=u and is_active order by display_order limit 1;
 loop
  seen:=array_append(seen,rk);
  select to_rank_id into next_rk from public.rank_progression_rules where user_id=u and (from_rank_id=rk or (from_rank_id is null and rk is null)) and required_level<=lvl and not(to_rank_id=any(seen)) order by required_level desc limit 1;
  exit when next_rk is null; rk:=next_rk;
 end loop;
 if s.current_level<>lvl then
  insert into public.level_history(user_id,old_level,new_level,xp_at_level_up) values(u,s.current_level,lvl,earned);
  insert into public.system_events(user_id,event_key,type,title,description) values(u,'level:'||gen_random_uuid(),'level-up','Level changed','Level '||lvl);
 end if;
 if s.current_rank_id is distinct from rk and rk is not null then
  insert into public.rank_history(user_id,from_rank_id,to_rank_id,level_reached) values(u,s.current_rank_id,rk,lvl);
 end if;
 select (now() at time zone timezone)::date into today from public.user_settings where user_id=u;
 -- Rebuild finalized daily outcomes; an open day joins only after qualifying.
 delete from public.streak_logs where user_id=u;
 for d in select date,count(*) as total,count(*) filter(where status='completed') as done from public.quests where user_id=u and date<=today and (archived_at is null or status='completed' or exists(select 1 from public.system_events e where e.user_id=u and e.event_key='quest:'||quests.id)) group by date order by date loop
  if d.done::numeric/d.total>=0.8 then
   if cursor_day is null or d.date<>cursor_day+1 then run:=0; end if;
   run:=run+1; longest:=greatest(longest,run);
  else run:=0; end if;
  cursor_day:=d.date;
  insert into public.streak_logs(user_id,date,qualified,reason,streak_count_after_evaluation) values(u,d.date,d.done::numeric/d.total>=0.8,'80% daily completion',run);
 end loop;
 select streak_count_after_evaluation into streak from public.streak_logs where user_id=u and qualified and date=today;
 if streak is null then select streak_count_after_evaluation into streak from public.streak_logs where user_id=u and qualified and date=today-1; end if;
 select coalesce(round(100.0*count(*) filter(where status='completed')/nullif(count(*),0)),0) into ratio from public.quests where user_id=u and (archived_at is null or status='completed' or exists(select 1 from public.system_events e where e.user_id=u and e.event_key='quest:'||quests.id)) and date between today-29 and today and (date<today or status in ('completed','cancelled'));
 update public.user_stats set current_level=lvl,current_xp=xp,xp_to_next_level=threshold,total_xp_earned=earned,current_rank_id=rk,
 current_streak_days=coalesce(streak,0),longest_streak_days=greatest(s.longest_streak_days,longest),discipline_score=ratio,updated_at=now() where user_id=u;
end $$;

create function public.maintain_discipline_user() returns void language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); today date; q public.quests; p public.user_penalties; series public.quest_series; occurrence date; n int; interval_step interval; st timestamptz; v jsonb; begin
 perform public.initialize_discipline_user();
 select (now() at time zone timezone)::date into today from public.user_settings where user_id=u;
 -- Bounded generation from the anchor preserves month-end and leap-year rules.
 for series in select * from public.quest_series where user_id=u and active loop
  interval_step:=case series.frequency when 'DAILY' then interval '1 day' when 'WEEKLY' then interval '7 days' when 'MONTHLY' then interval '1 month' else interval '1 year' end;
  n:=case series.frequency when 'DAILY' then greatest(0,today-series.anchor_date-1) when 'WEEKLY' then greatest(0,(today-series.anchor_date)/7-1) when 'MONTHLY' then greatest(0,extract(year from age(today,series.anchor_date))::int*12+extract(month from age(today,series.anchor_date))::int-1) else greatest(0,extract(year from age(today,series.anchor_date))::int-1) end;
  for i in n..n+32 loop
   occurrence:=(series.anchor_date+interval_step*i)::date;
   exit when occurrence>today+30;
   continue when occurrence<today-1;
   v:=series.template;
   st:=case when series.start_time is null then null else (occurrence+series.start_time) at time zone series.timezone end;
   insert into public.quests(user_id,title,description,category,rank_id,date,timezone,planned_start,planned_end,estimated_minutes,xp_reward,reward_points,penalties_points,max_minus_points,is_fixed,is_recurring,recurrence_rule,series_id)
   values(u,v->>'title',v->>'description',(v->>'category')::uuid,(v->>'rank_id')::uuid,occurrence,series.timezone,st,st+make_interval(mins=>series.duration_minutes),series.duration_minutes,coalesce((v->>'xp_reward')::int,0),coalesce((v->>'reward_points')::int,0),coalesce((v->>'penalties_points')::int,0),coalesce((v->>'max_minus_points')::int,0),coalesce((v->>'is_fixed')::boolean,false),true,'FREQ='||series.frequency,series.id) on conflict(series_id,date) do nothing;
  end loop;
 end loop;
 for q in select * from public.quests where user_id=u and archived_at is null and date<today and status in ('pending','in-progress','delayed') for update loop
  update public.quests set status='cancelled',current_minus_points=0,updated_at=now() where id=q.id;
  update public.user_stats set total_penalties_points=total_penalties_points+q.penalties_points where user_id=u;
  insert into public.system_events(user_id,event_key,type,title,description,penalty_delta) values(u,'quest:'||q.id,'penalty-triggered','Quest missed',q.title,q.penalties_points) on conflict(user_id,event_key) do nothing;
 end loop;
 for p in select * from public.user_penalties where user_id=u and status='in-progress' and due_at<now() for update loop
  update public.user_penalties set status='expired',xp_lost_applied=true,xp_lost=p.xp_loss_if_missed,completed_at=now(),updated_at=now() where id=p.id;
  update public.penalty_definitions set is_active=false where id=p.penalty_definition_id;
  insert into public.system_events(user_id,event_key,type,title,description,xp_delta) values(u,'penalty:'||p.id,'penalty-triggered','Penalty expired',p.title,-p.xp_loss_if_missed) on conflict(user_id,event_key) do nothing;
 end loop;
 perform public.refresh_discipline_stats();
end $$;

create function public.save_discipline_quest(p_values jsonb,p_id uuid default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); q public.quests; v public.quests; today date; sid uuid; tz text; begin
 perform public.maintain_discipline_user();
 select timezone,(now() at time zone timezone)::date into tz,today from public.user_settings where user_id=u;
 if p_id is not null then
  select * into q from public.quests where id=p_id and user_id=u for update;
  if not found then raise exception 'Quest not found'; end if;
  if q.status not in ('pending','delayed') then raise exception 'Only pending quests can be edited. History is preserved.'; end if;
 end if;
 select * into v from jsonb_populate_record(q,p_values);
 v.id:=coalesce(p_id,gen_random_uuid()); v.user_id:=u;
 if v.date<today or v.date>today+3660 then raise exception 'Choose today or a future date within ten years'; end if;
 if v.title is null or length(trim(v.title)) not between 1 and 200 then raise exception 'A title of 1 to 200 characters is required'; end if;
 if coalesce(v.xp_reward,0) not between 0 and 10000 or coalesce(v.reward_points,0) not between 0 and 10000 or coalesce(v.penalties_points,0) not between 0 and 10000 or coalesce(v.max_minus_points,0) not between 0 and 10000 then raise exception 'Points and XP must be between 0 and 10000'; end if;
 if v.category is not null and not exists(select 1 from public.quest_categories where id=v.category and user_id=u and archived_at is null) then raise exception 'Category not found'; end if;
 if v.rank_id is not null and not exists(select 1 from public.rank_definitions where id=v.rank_id and user_id=u) then raise exception 'Rank not found'; end if;
 v.timezone:=coalesce(v.timezone,tz);
 if not exists(select 1 from pg_timezone_names where name=v.timezone) then raise exception 'Invalid timezone'; end if;
 if (v.planned_start is null)<>(v.planned_end is null) or v.planned_end<=v.planned_start or (v.planned_start at time zone v.timezone)::date<>v.date or (v.planned_end at time zone v.timezone)::date<>v.date then raise exception 'Choose valid start and end times on the quest date'; end if;
 if (p_id is null or q.series_id is null) and coalesce(v.is_recurring,false) then
  if v.recurrence_rule not in ('FREQ=DAILY','FREQ=WEEKLY','FREQ=MONTHLY','FREQ=YEARLY') then raise exception 'Invalid recurrence'; end if;
  insert into public.quest_series(user_id,anchor_date,frequency,template,timezone,start_time,duration_minutes) values(u,v.date,split_part(v.recurrence_rule,'=',2),p_values,v.timezone,(v.planned_start at time zone v.timezone)::time,v.estimated_minutes) returning id into sid;
 else sid:=q.series_id; end if;
 if p_id is null then
  insert into public.quests(id,user_id,title,description,category,rank_id,date,timezone,planned_start,planned_end,estimated_minutes,xp_reward,reward_points,penalties_points,max_minus_points,is_fixed,is_recurring,recurrence_rule,series_id)
  values(v.id,u,trim(v.title),v.description,v.category,v.rank_id,v.date,v.timezone,v.planned_start,v.planned_end,v.estimated_minutes,coalesce(v.xp_reward,0),coalesce(v.reward_points,0),coalesce(v.penalties_points,0),coalesce(v.max_minus_points,0),coalesce(v.is_fixed,false),coalesce(v.is_recurring,false),v.recurrence_rule,sid) returning * into v;
 else
  update public.quests set title=trim(v.title),description=v.description,category=v.category,rank_id=v.rank_id,date=v.date,timezone=v.timezone,planned_start=v.planned_start,planned_end=v.planned_end,estimated_minutes=v.estimated_minutes,xp_reward=v.xp_reward,reward_points=v.reward_points,penalties_points=v.penalties_points,max_minus_points=v.max_minus_points,is_fixed=v.is_fixed,is_recurring=v.is_recurring,recurrence_rule=v.recurrence_rule,series_id=sid,updated_at=now() where id=p_id returning * into v;
 end if;
 perform public.maintain_discipline_user();
 return to_jsonb(v);
end $$;

create function public.transition_discipline_quest(p_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); q public.quests; settings public.user_settings; delay_points int:=0; shift interval; nextq public.quests; cursor_time timestamptz; begin
 perform public.maintain_discipline_user();
 select * into q from public.quests where id=p_id and user_id=u for update;
 if not found then raise exception 'Quest not found'; end if;
 if q.status=p_status then return jsonb_build_object('success',true,'quest',to_jsonb(q)); end if;
 if q.status in ('completed','cancelled') or p_status not in ('in-progress','completed','cancelled') then raise exception 'This quest cannot make that status change'; end if;
 select * into settings from public.user_settings where user_id=u;
 if q.date>(now() at time zone settings.timezone)::date then raise exception 'Future quests cannot be started or completed'; end if;
 if p_status='in-progress' then
  update public.quests set status=p_status,actual_start=coalesce(actual_start,now()),updated_at=now() where id=p_id;
 elsif p_status='cancelled' then
  update public.quests set status=p_status,current_minus_points=0,updated_at=now() where id=p_id;
  update public.user_stats set total_penalties_points=total_penalties_points+q.penalties_points where user_id=u;
  insert into public.system_events(user_id,event_key,type,title,description,penalty_delta) values(u,'quest:'||q.id,'penalty-triggered','Quest not completed',q.title,q.penalties_points);
 else
  if q.planned_end is not null then delay_points:=greatest(0,ceil(extract(epoch from now()-q.planned_end)/3600)::int); end if;
  if q.max_minus_points>0 then delay_points:=least(delay_points,q.max_minus_points); end if;
  update public.quests set status=p_status,actual_end=now(),actual_minutes=case when actual_start is null then null else greatest(0,round(extract(epoch from now()-actual_start)/60)::int) end,current_minus_points=delay_points,updated_at=now() where id=p_id;
  update public.user_stats set reward_points_balance=reward_points_balance+q.reward_points,total_penalties_points=total_penalties_points+delay_points where user_id=u;
  insert into public.system_events(user_id,event_key,type,title,description,xp_delta,points_delta,penalty_delta) values(u,'quest:'||q.id,'quest-completed','Quest completed',q.title,q.xp_reward,q.reward_points,delay_points);
  if settings.allow_auto_shift and q.planned_end<now() then
   cursor_time:=now();
   for nextq in select * from public.quests where user_id=u and date=q.date and id<>q.id and status in ('pending','delayed') and planned_start>=q.planned_end order by planned_start for update loop
    exit when nextq.planned_start>=cursor_time;
    -- Fixed appointments block cascading shifts unless explicitly allowed.
    exit when nextq.is_fixed and not settings.allow_fixed_quests_shift;
    shift:=cursor_time-nextq.planned_start;
    if ((nextq.planned_end+shift) at time zone settings.timezone)::time>settings.day_end_time or ((nextq.planned_end+shift) at time zone settings.timezone)::date<>q.date then exit; end if;
    update public.quests set planned_start=planned_start+shift,planned_end=planned_end+shift,shifted_by_minutes=shifted_by_minutes+ceil(extract(epoch from shift)/60)::int,updated_at=now() where id=nextq.id;
    cursor_time:=nextq.planned_end+shift;
   end loop;
  end if;
 end if;
 perform public.refresh_discipline_stats();
 select * into q from public.quests where id=p_id;
 return jsonb_build_object('success',true,'quest',to_jsonb(q));
end $$;

create function public.archive_discipline_quest(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); q public.quests; begin
 perform public.initialize_discipline_user();
 select * into q from public.quests where id=p_id and user_id=u for update;
 if not found then raise exception 'Quest not found'; end if;
 update public.quests set archived_at=now(),status=case when status in ('pending','delayed') then 'cancelled' else status end,updated_at=now() where id=p_id and user_id=u;
 perform public.maintain_discipline_user();
 -- Unstarted archived occurrences are skipped without penalty. Earned outcomes
 -- remain in the event ledger and in historical completion calculations.
end $$;

create function public.redeem_discipline_reward(p_reward_id uuid,p_request_id uuid,p_note text default null) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); r public.rewards; s public.user_stats; redemption public.reward_redemptions; user_order int; min_order int; last_time timestamptz; count_week int; begin
 perform public.maintain_discipline_user();
 if p_request_id is null then raise exception 'Request identifier required'; end if;
 select * into redemption from public.reward_redemptions where user_id=u and request_id=p_request_id;
 if found then
  if redemption.reward_id<>p_reward_id then raise exception 'Request identifier already used for another reward'; end if;
  return jsonb_build_object('redemption',to_jsonb(redemption),'newBalance',(select reward_points_balance from public.user_stats where user_id=u));
 end if;
 select * into r from public.rewards where id=p_reward_id and (user_id=u or is_global) and is_active;
 if not found then raise exception 'Reward is unavailable'; end if;
 select * into s from public.user_stats where user_id=u for update;
 if s.current_level<r.minimum_level or s.discipline_score<r.minimum_discipline_score then raise exception 'Reward requirements are not met'; end if;
 if r.minimum_rank_id is not null then
  select display_order into user_order from public.rank_definitions where id=s.current_rank_id and user_id=u;
  select display_order into min_order from public.rank_definitions where id=r.minimum_rank_id and user_id=u;
  if user_order is null or min_order is null or user_order<min_order then raise exception 'Required rank has not been reached'; end if;
 end if;
 select max(redeemed_at),count(*) filter(where redeemed_at>now()-interval '7 days') into last_time,count_week from public.reward_redemptions where user_id=u and reward_id=r.id;
 if last_time+make_interval(hours=>r.cooldown_hours)>now() then raise exception 'Reward is on cooldown'; end if;
 if r.max_redemptions_per_week is not null and count_week>=r.max_redemptions_per_week then raise exception 'Weekly redemption limit reached'; end if;
 if s.reward_points_balance<r.point_cost then raise exception 'Not enough reward points'; end if;
 update public.user_stats set reward_points_balance=reward_points_balance-r.point_cost,updated_at=now() where user_id=u;
 insert into public.reward_redemptions(user_id,reward_id,reward_name,point_cost,note,request_id) values(u,r.id,r.name,r.point_cost,left(p_note,4000),p_request_id) returning * into redemption;
 insert into public.system_events(user_id,event_key,type,title,description,points_delta) values(u,'redemption:'||redemption.id,'reward-redeemed','Reward redeemed',r.name,-r.point_cost);
 return jsonb_build_object('redemption',to_jsonb(redemption),'newBalance',s.reward_points_balance-r.point_cost);
end $$;

create function public.create_discipline_penalty(p_values jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); d public.penalty_definitions; p public.user_penalties; begin
 perform public.initialize_discipline_user();
 if length(trim(p_values->>'title')) not between 1 and 200 then raise exception 'A valid title is required'; end if;
 insert into public.penalty_definitions(user_id,name,description,severity_order,trigger_points,xp_loss_if_missed,due_in_hours)
 values(u,trim(p_values->>'title'),p_values->>'description',(p_values->>'severityOrder')::int,(p_values->>'triggerPoints')::int,(p_values->>'xpLossIfMissed')::int,(p_values->>'dueInHours')::int) returning * into d;
 insert into public.user_penalties(user_id,penalty_definition_id,title,description,trigger_points,xp_loss_if_missed,due_in_hours) values(u,d.id,d.name,d.description,d.trigger_points,d.xp_loss_if_missed,d.due_in_hours) returning * into p;
 return jsonb_build_object('definition',to_jsonb(d),'userPenalty',to_jsonb(p)||jsonb_build_object('penalty_definitions',to_jsonb(d)));
end $$;

create function public.transition_discipline_penalty(p_id uuid,p_action text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid:=auth.uid(); p public.user_penalties; balance bigint; begin
 perform public.maintain_discipline_user();
 select * into p from public.user_penalties where user_id=u and id=p_id for update;
 if not found then raise exception 'Penalty not found'; end if;
 if p_action='activate' and p.status='in-progress' or p_action='complete' and p.status in ('done','expired') then return jsonb_build_object('success',true,'status',p.status,'xpLost',p.xp_lost); end if;
 if p_action='activate' and p.status='created' then
  select total_penalties_points into balance from public.user_stats where user_id=u;
  if balance<p.trigger_points then raise exception 'Not enough penalty points to activate'; end if;
  update public.user_penalties set status='in-progress',issued_at=now(),due_at=now()+make_interval(hours=>p.due_in_hours),updated_at=now() where id=p.id;
  update public.penalty_definitions set is_active=true where id=p.penalty_definition_id;
 elsif p_action='complete' and p.status='in-progress' then
  update public.user_penalties set status='done',completed_at=now(),updated_at=now() where id=p.id;
  update public.user_stats set total_penalties_points=greatest(0,total_penalties_points-p.trigger_points),updated_at=now() where user_id=u;
  update public.penalty_definitions set is_active=false where id=p.penalty_definition_id;
  insert into public.system_events(user_id,event_key,type,title,description,penalty_delta) values(u,'penalty:'||p.id,'penalty-completed','Penalty completed',p.title,-p.trigger_points);
 else raise exception 'Activate this penalty before completing it'; end if;
 perform public.refresh_discipline_stats();
 return jsonb_build_object('success',true,'status',case p_action when 'activate' then 'in-progress' else 'done' end,'xpLost',0,'dueAt',(select due_at from public.user_penalties where id=p.id),'penaltyPoints',(select total_penalties_points from public.user_stats where user_id=u));
end $$;
-- Locked search_path, explicit auth.uid checks, and a shared per-user advisory
-- lock protect privileged writes. Internal functions are not public RPCs.
revoke all on function public.initialize_discipline_user(),public.refresh_discipline_stats(),public.maintain_discipline_user(),public.save_discipline_quest(jsonb,uuid),public.transition_discipline_quest(uuid,text),public.archive_discipline_quest(uuid),public.redeem_discipline_reward(uuid,uuid,text),public.create_discipline_penalty(jsonb),public.transition_discipline_penalty(uuid,text) from public,anon,authenticated;
grant execute on function public.maintain_discipline_user(),public.save_discipline_quest(jsonb,uuid),public.transition_discipline_quest(uuid,text),public.archive_discipline_quest(uuid),public.redeem_discipline_reward(uuid,uuid,text),public.create_discipline_penalty(jsonb),public.transition_discipline_penalty(uuid,text) to authenticated;


alter table public.quest_categories add column if not exists archived_at timestamptz;
create function public.validate_discipline_settings() returns trigger language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from pg_timezone_names where name=new.timezone) then raise exception 'Invalid timezone'; end if;
 return new;
end $$;
create trigger validate_timezone before insert or update on public.user_settings for each row execute function public.validate_discipline_settings();
create function public.set_discipline_series_active(p_id uuid,p_active boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); s public.quest_series; begin
 perform public.initialize_discipline_user();
 update public.quest_series set active=p_active where id=p_id and user_id=u returning * into s;
 if not found then raise exception 'Series not found'; end if;
 if not p_active then
  delete from public.quests where user_id=u and series_id=p_id and status in ('pending','delayed') and date>(now() at time zone s.timezone)::date;
 end if;
 perform public.maintain_discipline_user();
 return to_jsonb(s);
end $$;
revoke all on function public.set_discipline_series_active(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_discipline_series_active(uuid,boolean) to authenticated;
revoke update on public.quest_series from authenticated;
-- Scheduled maintenance can use a service-role RPC. The actor changes only
-- inside this transaction and is restored after maintenance completes.
create function public.maintain_discipline_batch(p_after uuid default null,p_limit integer default 100) returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; original text:=current_setting('request.jwt.claim.sub',true); last_id uuid; processed int:=0; begin
 for r in select id from auth.users where p_after is null or id>p_after order by id limit least(greatest(p_limit,1),100) loop
  perform set_config('request.jwt.claim.sub',r.id::text,true);
  perform public.maintain_discipline_user();last_id:=r.id;processed:=processed+1;
 end loop;
 perform set_config('request.jwt.claim.sub',coalesce(original,''),true);
 return jsonb_build_object('processed',processed,'lastId',last_id);
end $$;
revoke all on function public.maintain_discipline_batch(uuid,integer) from public,anon,authenticated;
grant execute on function public.maintain_discipline_batch(uuid,integer) to service_role;

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

commit;
