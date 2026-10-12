-- NitroZone: full database setup. Paste into Supabase Dashboard -> SQL Editor -> Run.
-- Safe to run more than once (idempotent). Identical to supabase/migrations/20261012001449_init_schema.sql

-- NitroZone schema
-- ---------------------------------------------------------------------------------------
-- There is no user login yet, so the browser talks to Supabase with the public
-- "publishable" (anon) key. Row Level Security is ENABLED on every table and the policies
-- below are written so that an anonymous visitor can only:
--
--   * fields / prescriptions : read, insert, update and delete rows that carry THEIR OWN
--                              device id. The browser generates a random UUID once, stores it
--                              in localStorage and sends it in the `x-device-id` request header.
--                              PostgREST exposes request headers to SQL, so the policy compares
--                              the row's device_id with the header. Other devices' rows are
--                              invisible. (This is "unlisted", not authentication: when login is
--                              added, swap device_id for auth.uid().)
--   * shared_reports         : INSERT a report snapshot; READ one only by its unguessable slug
--                              through the get_shared_report() function. There is no SELECT
--                              policy, so the table cannot be listed or scraped.
--   * analysis_runs          : INSERT anonymous usage analytics only. No read access.
--
-- Size limits (CHECK constraints) stop the anonymous key being used as free bulk storage.
-- ---------------------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- Helper: the device id sent by the browser (NULL if missing or malformed).
create or replace function public.request_device_id() returns uuid
language plpgsql stable
set search_path = public
as $$
declare
  raw text;
begin
  raw := coalesce(current_setting('request.headers', true)::json ->> 'x-device-id', '');
  if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return raw::uuid;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------- fields
create table if not exists public.fields (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null,
  name        text not null check (char_length(name) between 1 and 120),
  boundary    jsonb not null check (pg_column_size(boundary) < 200000),
  area_ac     numeric(10, 2) not null check (area_ac > 0 and area_ac < 100000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists fields_device_idx on public.fields (device_id, updated_at desc);
alter table public.fields enable row level security;

drop policy if exists "fields: device can read own" on public.fields;
create policy "fields: device can read own" on public.fields
  for select to anon, authenticated using (device_id = public.request_device_id());
drop policy if exists "fields: device can insert own" on public.fields;
create policy "fields: device can insert own" on public.fields
  for insert to anon, authenticated with check (device_id = public.request_device_id());
drop policy if exists "fields: device can update own" on public.fields;
create policy "fields: device can update own" on public.fields
  for update to anon, authenticated using (device_id = public.request_device_id())
  with check (device_id = public.request_device_id());
drop policy if exists "fields: device can delete own" on public.fields;
create policy "fields: device can delete own" on public.fields
  for delete to anon, authenticated using (device_id = public.request_device_id());

-- -------------------------------------------------------------------- prescriptions
create table if not exists public.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null,
  field_id    uuid references public.fields (id) on delete cascade,
  field_name  text not null check (char_length(field_name) between 1 and 120),
  settings    jsonb not null check (pg_column_size(settings) < 20000),
  summary     jsonb not null check (pg_column_size(summary) < 50000),
  -- compact per-cell zone assignment (base64), so the prescription can be restored
  zones       text check (char_length(zones) < 400000),
  created_at  timestamptz not null default now()
);
create index if not exists prescriptions_device_idx on public.prescriptions (device_id, created_at desc);
alter table public.prescriptions enable row level security;

drop policy if exists "prescriptions: device can read own" on public.prescriptions;
create policy "prescriptions: device can read own" on public.prescriptions
  for select to anon, authenticated using (device_id = public.request_device_id());
drop policy if exists "prescriptions: device can insert own" on public.prescriptions;
create policy "prescriptions: device can insert own" on public.prescriptions
  for insert to anon, authenticated with check (device_id = public.request_device_id());
drop policy if exists "prescriptions: device can delete own" on public.prescriptions;
create policy "prescriptions: device can delete own" on public.prescriptions
  for delete to anon, authenticated using (device_id = public.request_device_id());

-- ------------------------------------------------------------------- shared reports
create table if not exists public.shared_reports (
  slug        text primary key check (slug ~ '^[A-Za-z0-9_-]{10,32}$'),
  payload     jsonb not null check (pg_column_size(payload) < 1500000),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '180 days'
);
alter table public.shared_reports enable row level security;

drop policy if exists "shared_reports: anyone can create" on public.shared_reports;
create policy "shared_reports: anyone can create" on public.shared_reports
  for insert to anon, authenticated
  with check (expires_at <= now() + interval '366 days');
-- No SELECT policy on purpose: reports are fetched one at a time by slug via this function.

create or replace function public.get_shared_report(p_slug text) returns jsonb
language sql stable security definer
set search_path = public
as $$
  select payload from public.shared_reports
  where slug = p_slug and expires_at > now()
  limit 1;
$$;
revoke all on function public.get_shared_report(text) from public;
grant execute on function public.get_shared_report(text) to anon, authenticated;

-- -------------------------------------------------------------------- analysis runs
create table if not exists public.analysis_runs (
  id           bigint generated always as identity primary key,
  created_at   timestamptz not null default now(),
  source       text not null check (source in ('live', 'cached', 'synthetic', 'drone')),
  area_ac      numeric(10, 2) check (area_ac >= 0 and area_ac < 100000),
  zone_count   smallint check (zone_count between 1 and 10),
  cell_size_m  smallint check (cell_size_m between 1 and 200),
  duration_ms  integer check (duration_ms >= 0 and duration_ms < 600000),
  success      boolean not null,
  error        text check (char_length(error) < 500),
  is_demo      boolean not null default false
);
alter table public.analysis_runs enable row level security;

drop policy if exists "analysis_runs: anyone can log" on public.analysis_runs;
create policy "analysis_runs: anyone can log" on public.analysis_runs
  for insert to anon, authenticated with check (true);
-- No SELECT policy: analytics are only readable from the dashboard / service role.

-- ---------------------------------------------------------------------------- grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.fields to anon, authenticated;
grant select, insert, delete on public.prescriptions to anon, authenticated;
grant insert on public.shared_reports to anon, authenticated;
grant insert on public.analysis_runs to anon, authenticated;
