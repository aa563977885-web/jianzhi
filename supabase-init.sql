-- ============================================================
-- 减脂助手 + 日常有数 · 云同步初始化 SQL（一次性合并版）
-- 用法：Supabase 控制台 → SQL Editor → 新建查询 → 全文粘贴 → Run
-- 注意：浏览器「翻译成中文」会破坏 SQL 语法，请在英文原版页面或粘贴前操作
-- 本脚本可重复运行（幂等），不会破坏已有数据
-- ============================================================

-- ① 健身减脂助手（主应用）数据表：账号同步与同步码两用
create table if not exists public.fitness_state (
 code text primary key,
 user_id uuid default auth.uid(),
 data jsonb,
 updated_at timestamptz default now()
);
alter table public.fitness_state enable row level security;
drop policy if exists "anon_all" on public.fitness_state;
create policy "anon_all" on public.fitness_state for all to anon using (true) with check (true);
drop policy if exists "own_row" on public.fitness_state;
create policy "own_row" on public.fitness_state for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ② 日常有数（richang 页面）数据表：邮箱账号同步（隔离表，与上面互不影响）
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
