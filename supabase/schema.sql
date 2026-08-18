-- ============================================================================
-- CASH COW — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and hit RUN.
-- Safe to re-run (everything is IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- drops
-- One row per payout cycle.
-- ---------------------------------------------------------------------------
create table if not exists public.drops (
  id             bigserial primary key,
  holders        integer     not null default 0,  -- eligible holders in the snapshot
  paid           integer     not null default 0,  -- transfers that confirmed
  failed         integer     not null default 0,
  pool_lamports  bigint      not null default 0,  -- what was up for grabs
  sent_lamports  bigint      not null default 0,  -- what actually moved
  dry_run        boolean     not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists drops_created_idx on public.drops (created_at desc);

-- ---------------------------------------------------------------------------
-- payouts
-- One row per holder per drop. This is the receipt.
-- ---------------------------------------------------------------------------
create table if not exists public.payouts (
  id           bigserial primary key,
  drop_id      bigint      not null references public.drops (id) on delete cascade,
  wallet       text        not null,
  lamports     bigint      not null default 0,
  token_amount numeric     not null default 0,   -- holding at snapshot time
  status       text        not null default 'sent',  -- sent | failed
  created_at   timestamptz not null default now()
);

create index if not exists payouts_drop_idx   on public.payouts (drop_id);
create index if not exists payouts_wallet_idx on public.payouts (wallet);

-- ---------------------------------------------------------------------------
-- Leaderboard — who has been paid the most.
-- ---------------------------------------------------------------------------
create or replace view public.top_earners as
select
  wallet,
  count(*)          as drops_received,
  sum(lamports)     as total_lamports,
  max(created_at)   as last_paid_at
from public.payouts
where status = 'sent'
group by wallet
order by total_lamports desc;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The server uses the SERVICE ROLE key and bypasses RLS entirely. These
-- policies exist so the ANON key is safe to expose for read-only queries.
-- ---------------------------------------------------------------------------
alter table public.drops   enable row level security;
alter table public.payouts enable row level security;

drop policy if exists "public read drops"   on public.drops;
drop policy if exists "public read payouts" on public.payouts;

create policy "public read drops"   on public.drops   for select using (true);
create policy "public read payouts" on public.payouts for select using (true);

-- Realtime (optional): lets the site react to new drops without polling.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.drops;
  end if;
exception when duplicate_object then
  null;
end
$$;

-- ---------------------------------------------------------------------------
-- Handy queries
-- ---------------------------------------------------------------------------
-- Everything one wallet has been paid:
--   select * from payouts where wallet = 'YOUR_WALLET' order by created_at desc;
--
-- Total ever paid out:
--   select sum(sent_lamports) / 1e9 as sol from drops where not dry_run;
--
-- Anything that failed and may need re-sending:
--   select d.created_at, p.wallet, p.lamports
--   from payouts p join drops d on d.id = p.drop_id
--   where p.status = 'failed' order by d.created_at desc;
