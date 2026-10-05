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
