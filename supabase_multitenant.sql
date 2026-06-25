-- =====================================================================
-- ZampPulse — Multi-tenant migration (Clients layer)
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

-- Seed DoorDash + Uber
insert into public.clients (slug, name) values
  ('doordash', 'DoorDash'),
  ('uber', 'Uber')
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

-- Associate demo@zamp.ai with both clients (default = DoorDash)
insert into public.user_clients (user_id, client_id, is_default)
select u.id, c.id, (c.slug = 'doordash')
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

-- 6. Seed Uber demo data ----------------------------------------------
-- Uber gets 3 agents and ~120 task_events distributed across May/Jun 2026
-- with slightly different performance profile than DoorDash so the
-- switcher visibly changes the dashboard.

do $$
declare
  uber_id uuid;
  a1 uuid; a2 uuid; a3 uuid;
  i int;
  d timestamptz;
  outcome_pick text;
  r float;
  day_offset int;
  improving float;
begin
  select id into uber_id from public.clients where slug = 'uber';

  -- Skip if Uber agents already seeded
  if exists (select 1 from public.agents where client_id = uber_id) then
    return;
  end if;

  -- 3 Uber agents (mobility / driver-ops flavor)
  insert into public.agents (name, role_icon, client_id)
  values ('Driver Verification Agent', '🪪', uber_id) returning id into a1;
  insert into public.agents (name, role_icon, client_id)
  values ('Trip Dispute Resolver', '🚗', uber_id) returning id into a2;
  insert into public.agents (name, role_icon, client_id)
  values ('Rider Refund Agent', '💸', uber_id) returning id into a3;

  -- Baselines
  insert into public.baselines (agent_id, client_id, avg_processing_time_seconds, baseline_accuracy)
  values
    (a1, uber_id, 240, 0.82),
    (a2, uber_id, 360, 0.78),
    (a3, uber_id, 180, 0.85);

  -- ~120 task_events spread May 1 → Jun 24 2026 with improving ATCR
  for i in 1..120 loop
    day_offset := (i * 55 / 120)::int;             -- 0..55
    d := timestamp '2026-05-01 09:00' + (day_offset || ' days')::interval
         + ((i % 8) || ' hours')::interval;
    improving := 0.55 + (day_offset::float / 55.0) * 0.30; -- 0.55 → 0.85
    r := random();
    if r < improving then
      outcome_pick := 'completed';
    elsif r < improving + 0.08 then
      outcome_pick := 'escalated';
    elsif r < improving + 0.16 then
      outcome_pick := 'corrected';
    else
      outcome_pick := 'failed';
    end if;

    insert into public.task_events
      (agent_id, client_id, ts_received, outcome, task_subtype, processing_time_seconds, confidence_score)
    values (
      case (i % 3) when 0 then a1 when 1 then a2 else a3 end,
      uber_id,
      d,
      outcome_pick,
      case (i % 4)
        when 0 then 'document_check'
        when 1 then 'fare_review'
        when 2 then 'eta_dispute'
        else 'refund_request'
      end,
      (90 + random()*180)::int,
      0.6 + random()*0.4
    );
  end loop;
end $$;

-- 7. Lock down client_id (NOT NULL) -----------------------------------
alter table public.agents              alter column client_id set not null;
alter table public.task_events         alter column client_id set not null;
alter table public.correction_events   alter column client_id set not null;
alter table public.baselines           alter column client_id set not null;
-- health_signals may legitimately be cross-client (engagement_drop etc.),
-- so leave it nullable.

-- =====================================================================
-- Done. demo@zamp.ai now sees DoorDash by default and can switch to Uber.
-- =====================================================================
