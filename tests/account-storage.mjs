import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs';import assert from 'node:assert/strict';
const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';let checks=0;
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;grant usage on schema auth to authenticated;create table auth.users(id uuid primary key,email text);create table auth.sessions(id uuid primary key,user_id uuid references auth.users on delete cascade);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;create schema storage;grant usage on schema storage to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(regexp_replace(name,'/[^/]+$',''),'/')$$;`);
 for(const file of ['202610050001_baseline.sql','202610050002_atomic_operations.sql','202610050003_maintenance.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'));
 await db.exec(fs.readFileSync('supabase/account-storage.sql','utf8'));
 await db.query('insert into auth.users values($1,$2),($3,$4)',[a,'a@test.invalid',b,'b@test.invalid']);await db.query('insert into auth.sessions values($1,$2)',[session,b]);
 const actor=async(id,age=0)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[id,JSON.stringify({session_id:session,amr:[{method:'password',timestamp:Math.floor(Date.now()/1000)-age}]})]);await db.exec('set role authenticated');await db.exec('select public.maintain_discipline_user()')};
 await actor(a);await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['discipline-avatars',a+'/a.png']);
 await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['discipline-avatars',b+'/stolen.png']),/row-level security/);checks++;
 await actor(b);assert.equal((await db.query('select * from storage.objects')).rows.length,0);checks++;
 await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['discipline-avatars',b+'/b.png']);assert.equal((await db.query('select * from storage.objects')).rows.length,1);checks++;
 await assert.rejects(()=>db.query("select public.close_discipline_account('wrong')"),/confirm DELETE/);checks++;
 await actor(b,600);await assert.rejects(()=>db.query("select public.close_discipline_account('DELETE')"),/Sign in again/);checks++;
 await actor(b);await db.query("select public.close_discipline_account('DELETE')");
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[b])).rows[0].n,0);checks++;
 assert.equal((await db.query('select count(*)::int n from auth.users where id=$1',[a])).rows[0].n,1);checks++;
 assert.equal((await db.query('select count(*)::int n from public.profiles where id=$1',[b])).rows[0].n,0);checks++;
 await db.exec('set role anon');await assert.rejects(()=>db.query("select public.close_discipline_account('DELETE')"),/permission denied/);checks++;
 console.log(`${checks} storage and account assertions passed: private folder isolation, explicit confirmation, recent password/session checks, own-account cascade, and preservation of other accounts.`);
}catch(e){console.error(e.message);process.exitCode=1}finally{await db.close()}
