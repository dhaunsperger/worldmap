-- worldmap schema. Paste into the Supabase SQL editor (or run via supabase db push).
-- Safe to re-run: uses IF NOT EXISTS / OR REPLACE where possible.

-- A territory's status. "not_visited" is represented by the ABSENCE of a row.
create table if not exists public.territory_status (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  territory_id text not null,
  status text not null check (status in ('visited', 'slept_in', 'lived_in')),
  updated_at timestamptz not null default now(),
  primary key (user_id, territory_id)
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint dates_ordered check (
    start_date is null or end_date is null or start_date <= end_date
  )
);

create table if not exists public.trip_territories (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  territory_id text not null,
  -- what this trip says about the territory: passed through or stayed over
  status text not null default 'visited' check (status in ('visited', 'slept_in')),
  primary key (trip_id, territory_id)
);

-- Upgrade path for databases provisioned before the status column existed.
alter table public.trip_territories
  add column if not exists status text not null default 'visited'
    check (status in ('visited', 'slept_in'));

alter table public.territory_status enable row level security;
alter table public.trips enable row level security;
alter table public.trip_territories enable row level security;

drop policy if exists "own rows" on public.territory_status;
create policy "own rows" on public.territory_status
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.trips;
create policy "own rows" on public.trips
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own rows" on public.trip_territories;
create policy "own rows" on public.trip_territories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists trips_user_start on public.trips (user_id, start_date desc nulls last);
create index if not exists trip_territories_territory on public.trip_territories (user_id, territory_id);
