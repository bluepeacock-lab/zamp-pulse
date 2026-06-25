-- =====================================================================
-- ZampPulse — Single-client tenant migration (DoorDash only)
-- Run this once in the Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- =====================================================================

-- 1. clients table -----------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

grant select on public.clients to anon, authenticated;
grant all on public.clients to service_role;

alter table public.clients enable row level security;
drop policy if exists "clients readable" on public.clients;
create policy "clients readable" on public.clients for select using (true);

-- Seed only DoorDash
insert into public.clients (slug, name) values
  ('doordash', 'DoorDash')
on conflict (slug) do nothing;

-- 2. user_clients join -------------------------------------------------
create table if not exists public.user_clients (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  is_default boolean not null default false,
  primary key (user_id, client_id)
);

grant select on public.user_clients to anon, authenticated;
grant all on public.user_clients to service_role;

alter table public.user_clients enable row level security;
drop policy if exists "user_clients readable" on public.user_clients;
create policy "user_clients readable" on public.user_clients for select using (true);

-- Associate demo@zamp.ai with DoorDash
insert into public.user_clients (user_id, client_id, is_default)
select u.id, c.id, true
from auth.users u
cross join public.clients c
where u.email = 'demo@zamp.ai'
on conflict (user_id, client_id) do update set is_default = excluded.is_default;

-- 3. Add client_id to existing tables ---------------------------------
alter table public.agents              add column if not exists client_id uuid references public.clients(id);
alter table public.task_events         add column if not exists client_id uuid references public.clients(id);
alter table public.correction_events   add column if not exists client_id uuid references public.clients(id);
alter table public.baselines           add column if not exists client_id uuid references public.clients(id);
alter table public.health_signals      add column if not exists client_id uuid references public.clients(id);

-- 4. Backfill all existing rows to DoorDash ---------------------------
with dd as (select id from public.clients where slug = 'doordash')
update public.agents            set client_id = (select id from dd) where client_id is null;
with dd as (select id from public.clients where slug = 'doordash')
update public.task_events       set client_id = (select id from dd) where client_id is null;
with dd as (select id from public.clients where slug = 'doordash')
update public.correction_events set client_id = (select id from dd) where client_id is null;
with dd as (select id from public.clients where slug = 'doordash')
update public.baselines         set client_id = (select id from dd) where client_id is null;
with dd as (select id from public.clients where slug = 'doordash')
update public.health_signals    set client_id = (select id from dd) where client_id is null;

-- 5. Indexes -----------------------------------------------------------
create index if not exists agents_client_idx              on public.agents(client_id);
create index if not exists task_events_client_idx         on public.task_events(client_id);
create index if not exists correction_events_client_idx   on public.correction_events(client_id);
create index if not exists baselines_client_idx           on public.baselines(client_id);
create index if not exists health_signals_client_idx      on public.health_signals(client_id);

-- 6. Lock down client_id (NOT NULL) -----------------------------------
alter table public.agents              alter column client_id set not null;
alter table public.task_events         alter column client_id set not null;
alter table public.correction_events   alter column client_id set not null;
alter table public.baselines           alter column client_id set not null;
-- health_signals may legitimately be cross-client (engagement_drop etc.),
-- so leave it nullable.

-- =====================================================================
-- Done. All historical data is now scoped under the DoorDash client.
-- =====================================================================
