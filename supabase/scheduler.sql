-- Hourly maintenance runs privately inside PostgreSQL; no browser, email, or
-- external service key is required. This keeps overdue outcomes current while
-- the app is closed. No client role can invoke the all-user scheduler.
create extension if not exists pg_cron;
create or replace function public.scheduled_discipline_maintenance() returns void language plpgsql security definer set search_path='' as $$
declare page jsonb; after_id uuid; begin
 loop
  page:=public.maintain_discipline_batch(after_id,100);
  exit when (page->>'processed')::int<100;
  after_id:=(page->>'lastId')::uuid;
 end loop;
end $$;
revoke all on function public.scheduled_discipline_maintenance() from public,anon,authenticated,service_role;
select cron.schedule('discipline-hourly-maintenance','0 * * * *','select public.scheduled_discipline_maintenance();');
