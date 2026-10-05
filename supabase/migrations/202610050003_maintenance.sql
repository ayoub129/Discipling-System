begin;
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
commit;
