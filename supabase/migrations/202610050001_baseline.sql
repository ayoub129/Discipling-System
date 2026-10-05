-- Fresh-project baseline. For an existing project, inspect its schema first and
-- reconcile changes in a separate additive migration; do not reset customer data.
begin;
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
commit;
