begin;
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
commit;
