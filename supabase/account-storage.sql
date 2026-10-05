-- Private avatar storage and a self-service account-close RPC. No service key
-- is exposed or required. Closing an account requires a current, recently
-- password-authenticated Supabase session and an explicit DELETE confirmation.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('discipline-avatars','discipline-avatars',false,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy discipline_avatar_read on storage.objects for select to authenticated using(bucket_id='discipline-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid())));
create policy discipline_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='discipline-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid())));
create policy discipline_avatar_update on storage.objects for update to authenticated using(bucket_id='discipline-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='discipline-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid())));
create policy discipline_avatar_delete on storage.objects for delete to authenticated using(bucket_id='discipline-avatars' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.profiles where id=(select auth.uid())));
create function public.close_discipline_account(p_confirmation text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); claims jsonb:=auth.jwt(); t record; begin
 if u is null or p_confirmation is distinct from 'DELETE' then raise exception 'Sign in and confirm DELETE to close your account';end if;
 if not exists(select 1 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) m where m->>'method'='password' and (m->>'timestamp')::bigint between extract(epoch from now()-interval '5 minutes') and extract(epoch from now())+30)
 or not exists(select 1 from auth.sessions where id=(claims->>'session_id')::uuid and user_id=u) then raise exception 'Sign in again with your password before deleting your account';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 -- Remove this user's entries from the private pre-upgrade snapshot too.
 for t in select table_name,column_name from information_schema.columns where table_schema='discipline_backup_20261005' and (column_name='user_id' or table_name='profiles' and column_name='id') loop
  execute format('delete from discipline_backup_20261005.%I where %I=$1',t.table_name,t.column_name) using u;
 end loop;
 delete from auth.users where id=u;
end $$;
revoke all on function public.close_discipline_account(text) from public,anon,authenticated;
grant execute on function public.close_discipline_account(text) to authenticated;
commit;
