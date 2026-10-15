-- Run once in your existing Supabase project's SQL Editor.
-- New isolated table: existing fitness tables and records are untouched.
begin;
create table if not exists public.daily_compass_sync (
 user_id uuid not null references auth.users(id) on delete cascade,
 space text not null default 'main' check (space in ('main','qa')),
 revision bigint not null default 0 check (revision >= 0),
 payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 2097152),
 updated_at timestamptz not null default now(),
 primary key (user_id,space)
);
alter table public.daily_compass_sync enable row level security;
revoke all on public.daily_compass_sync from anon, authenticated;
grant select, insert, update on public.daily_compass_sync to authenticated;
drop policy if exists compass_owner_select on public.daily_compass_sync;
drop policy if exists compass_owner_insert on public.daily_compass_sync;
drop policy if exists compass_owner_update on public.daily_compass_sync;
create policy compass_owner_select on public.daily_compass_sync for select to authenticated using ((select auth.uid()) = user_id);
create policy compass_owner_insert on public.daily_compass_sync for insert to authenticated with check ((select auth.uid()) = user_id);
create policy compass_owner_update on public.daily_compass_sync for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.compass_sync_write(expected_revision bigint, next_payload jsonb, target_space text default 'main')
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_row public.daily_compass_sync%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if target_space not in ('main','qa') or expected_revision is null or expected_revision < 0 or next_payload is null or jsonb_typeof(next_payload) <> 'object' or octet_length(next_payload::text) > 2097152 then raise exception 'Invalid sync payload'; end if;
 insert into public.daily_compass_sync(user_id,space) values(auth.uid(),target_space) on conflict (user_id,space) do nothing;
 select * into strict current_row from public.daily_compass_sync where user_id=auth.uid() and space=target_space for update;
 if current_row.revision <> expected_revision then return jsonb_build_object('applied',false,'revision',current_row.revision); end if;
 update public.daily_compass_sync set payload=next_payload,revision=revision+1,updated_at=now() where user_id=auth.uid() and space=target_space returning * into current_row;
 return jsonb_build_object('applied',true,'revision',current_row.revision);
end;
$$;
revoke all on function public.compass_sync_write(bigint,jsonb,text) from public, anon;
grant execute on function public.compass_sync_write(bigint,jsonb,text) to authenticated;
commit;
