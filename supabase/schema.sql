-- ============================================================================
-- ONCHAIN BINGO — Supabase schema
-- Paste this whole file into the Supabase SQL Editor and hit RUN.
-- Safe to re-run (everything is IF NOT EXISTS / CREATE OR REPLACE).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- rounds
-- One row per bingo round. `server_seed` is revealed when the round settles so
-- anyone can replay the draw order and verify it was not tampered with.
-- ---------------------------------------------------------------------------
create table if not exists public.rounds (
  id                bigserial primary key,
  status            text        not null default 'lobby',   -- lobby | drawing | settled
  pattern           text        not null default 'line',    -- line | x | full
  server_seed       text,                                   -- revealed at settle
  server_seed_hash  text        not null,                   -- published at lobby open
  draws             smallint[]  not null default '{}',
  pot_lamports      bigint      not null default 0,
  prize_lamports    bigint      not null default 0,         -- 80% of pot
  jackpot_add_lamports bigint   not null default 0,         -- 20% of pot
  players_count     integer     not null default 0,
  cards_count       integer     not null default 0,
  started_at        timestamptz not null default now(),
  settled_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists rounds_status_idx  on public.rounds (status);
create index if not exists rounds_created_idx on public.rounds (created_at desc);

-- ---------------------------------------------------------------------------
-- entries
-- A wallet joining a round, with the number of cards it was granted.
-- ---------------------------------------------------------------------------
create table if not exists public.entries (
  id           bigserial primary key,
  round_id     bigint      not null references public.rounds (id) on delete cascade,
  wallet       text        not null,
  cards        integer     not null,
  token_amount numeric     not null default 0,   -- raw UI amount at join time
  created_at   timestamptz not null default now(),
  unique (round_id, wallet)
);

create index if not exists entries_round_idx  on public.entries (round_id);
create index if not exists entries_wallet_idx on public.entries (wallet);

-- ---------------------------------------------------------------------------
-- winners
-- One row per winning card. Multiple rows for a round = split pot.
-- ---------------------------------------------------------------------------
create table if not exists public.winners (
  id                bigserial primary key,
  round_id          bigint      not null references public.rounds (id) on delete cascade,
  wallet            text        not null,
  card_index        integer     not null,
  ball_number       smallint,                       -- ball that completed the pattern
  balls_called      integer     not null default 0,
  prize_lamports    bigint      not null default 0,
  jackpot_won       boolean     not null default false,
  jackpot_roll      integer,                        -- 0..(odds-1); 0 == win
  jackpot_lamports  bigint      not null default 0,
  payout_status     text        not null default 'pending',  -- pending | sent | failed | manual
  payout_signature  text,
  created_at        timestamptz not null default now()
);

create index if not exists winners_round_idx  on public.winners (round_id);
create index if not exists winners_wallet_idx on public.winners (wallet);
create index if not exists winners_created_idx on public.winners (created_at desc);

-- ---------------------------------------------------------------------------
-- jackpot
-- Single-row table (id = 1) holding the running jackpot balance.
-- ---------------------------------------------------------------------------
create table if not exists public.jackpot (
  id             smallint primary key default 1,
  lamports       bigint      not null default 0,
  last_won_round bigint,
  last_won_at    timestamptz,
  updated_at     timestamptz not null default now(),
  constraint jackpot_singleton check (id = 1)
);

insert into public.jackpot (id, lamports)
values (1, 0)
on conflict (id) do nothing;

-- Atomically add to the jackpot and return the new balance.
create or replace function public.jackpot_add(amount bigint)
returns bigint
language plpgsql
as $$
declare
  new_balance bigint;
begin
  update public.jackpot
     set lamports = lamports + amount,
         updated_at = now()
   where id = 1
  returning lamports into new_balance;
  return new_balance;
end;
$$;

-- Atomically drain the jackpot (a winner hit the 1-in-N roll) and return the
-- amount that was paid out.
create or replace function public.jackpot_drain(round bigint)
returns bigint
language plpgsql
as $$
declare
  paid bigint;
begin
  -- Lock the row first so two concurrent winners can't both drain it.
  select lamports into paid from public.jackpot where id = 1 for update;

  update public.jackpot
     set lamports = 0,
         last_won_round = round,
         last_won_at = now(),
         updated_at = now()
   where id = 1;

  return coalesce(paid, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard view — top wallets by total winnings.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard as
select
  wallet,
  count(*)                                   as wins,
  sum(prize_lamports + jackpot_lamports)     as total_lamports,
  max(created_at)                            as last_win_at
from public.winners
group by wallet
order by total_lamports desc;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The game server uses the SERVICE ROLE key and bypasses RLS entirely.
-- These policies exist so you can safely expose the ANON key to the browser
-- for read-only history / leaderboard queries.
-- ---------------------------------------------------------------------------
alter table public.rounds  enable row level security;
alter table public.entries enable row level security;
alter table public.winners enable row level security;
alter table public.jackpot enable row level security;

drop policy if exists "public read rounds"  on public.rounds;
drop policy if exists "public read entries" on public.entries;
drop policy if exists "public read winners" on public.winners;
drop policy if exists "public read jackpot" on public.jackpot;

create policy "public read rounds"  on public.rounds  for select using (true);
create policy "public read entries" on public.entries for select using (true);
create policy "public read winners" on public.winners for select using (true);
create policy "public read jackpot" on public.jackpot for select using (true);

-- Realtime (optional): lets the frontend subscribe to jackpot/winner changes
-- directly from Supabase in addition to the game WebSocket.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.winners;
    alter publication supabase_realtime add table public.jackpot;
    alter publication supabase_realtime add table public.rounds;
  end if;
exception when duplicate_object then
  null;
end
$$;
