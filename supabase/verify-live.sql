-- Read-only checks follow an explicitly rolled-back functional test. The test
-- does not persist quests, earnings, account changes, or session credentials.
begin;
select set_config('request.jwt.claim.sub',(select id::text from auth.users order by id limit 1),true);
set local role authenticated;
do $$ declare before_stats public.user_stats; after_stats public.user_stats; quest jsonb; begin
 perform public.maintain_discipline_user();
 select * into before_stats from public.user_stats where user_id=auth.uid();
 quest:=public.save_discipline_quest(jsonb_build_object('title','Temporary transaction verification','date',(now() at time zone (select timezone from public.user_settings where user_id=auth.uid()))::date,'xp_reward',50,'reward_points',7));
 perform public.transition_discipline_quest((quest->>'id')::uuid,'completed');
 perform public.transition_discipline_quest((quest->>'id')::uuid,'completed');
 select * into after_stats from public.user_stats where user_id=auth.uid();
 if after_stats.total_xp_earned-before_stats.total_xp_earned<>50 or after_stats.reward_points_balance-before_stats.reward_points_balance<>7 then raise exception 'Exactly-once test failed';end if;
 if has_table_privilege('authenticated','public.user_stats','UPDATE') then raise exception 'Direct balance writes are still allowed';end if;
end $$;
rollback;
select 'Live exactly-once completion test passed and was rolled back' as result;
