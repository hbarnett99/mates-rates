-- Mates Rates: initial schema.
-- Tables, the app role, grants and row-level security. See docs/plan.md,
-- "Data model".
--
-- Run this as the project owner (neondb_owner) in the Neon SQL editor.
--
-- Sign-in is Neon Auth (managed Better Auth), which keeps its own tables in
-- the neon_auth schema. Nothing here references them: the app server checks
-- the session, then runs each request's queries as the mates_app role with
-- the user's id and email set for the transaction (see lib/db/index.ts).
-- The policies below read those settings, so RLS still decides what each
-- mate can see and change.

-- ---------------------------------------------------------------------------
-- App role
-- The server connects as mates_app. It doesn't own any table and can't
-- bypass RLS. Give it a password separately (see README), never here.
-- ---------------------------------------------------------------------------

create role mates_app nologin;
grant usage on schema public to mates_app;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.crew_role as enum ('owner', 'member');
create type public.deal_category as enum ('food', 'drink', 'both');

-- ---------------------------------------------------------------------------
-- Request context
-- Set per transaction by lib/db/index.ts from the verified session.
-- ---------------------------------------------------------------------------

create function public.current_user_id()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '');
$$;

create function public.current_email()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(lower(current_setting('app.email', true)), '');
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The crew allowlist, edited by hand in the Neon Tables view or SQL editor.
-- Emails must be stored lower-case so they match the session email.
create table public.allowed_emails (
  email    text primary key check (email = lower(email)),
  role     public.crew_role not null default 'member',
  added_at timestamptz not null default now()
);

-- One row per mate, upserted from their Google profile when they load the
-- app. id is the Neon Auth user id.
create table public.profiles (
  id           text primary key,
  display_name text,
  avatar_url   text
);

create table public.venues (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null check (length(btrim(name)) > 0),
  suburb                text,
  -- Null for venues placed by a manual pin drop.
  google_place_id       text unique,
  lat                   double precision not null check (lat between -90 and 90),
  lng                   double precision not null check (lng between -180 and 180),
  -- When lat/lng were last fetched from Places (Google allows 30 days).
  location_refreshed_at timestamptz,
  instagram_handle      text,
  -- Set null when a mate's profile is deleted, so the crew keeps the venue.
  created_by            text default public.current_user_id() references public.profiles (id) on delete set null
);

create table public.deals (
  id                uuid primary key default gen_random_uuid(),
  -- Restrict: deleting a venue must not silently take other mates' deals with it.
  venue_id          uuid not null references public.venues (id) on delete restrict,
  title             text not null check (length(btrim(title)) > 0),
  price_cents       integer not null check (price_cents >= 0),
  category          public.deal_category not null,
  -- Must match TAGS in lib/tags/rules.ts.
  tags              text[] not null default '{}' check (tags <@ array[
    'steak', 'parma', 'roast', 'burger', 'pizza', 'wings', 'Mexican', 'Asian',
    'Indian', 'Italian', 'seafood', 'brunch', 'lunch special', 'happy hour',
    'pints', 'cocktails', 'wine', 'trivia', 'kids eat free'
  ]::text[]),
  -- Weekdays, 0 = Sunday to 6 = Saturday.
  days              smallint[] not null check (
    cardinality(days) > 0 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  ),
  -- Melbourne local times; both null means all day.
  start_time        time,
  end_time          time,
  -- Null means open-ended. A one-off deal sets both to the same date.
  valid_from        date,
  valid_until       date,
  notes             text,
  source_url        text,
  last_confirmed_at timestamptz not null default now(),
  -- Set null when a mate's profile is deleted, so the crew keeps the deal.
  created_by        text default public.current_user_id() references public.profiles (id) on delete set null,
  updated_at        timestamptz not null default now(),
  check (valid_from is null or valid_until is null or valid_from <= valid_until)
);

create index deals_venue_id_idx on public.deals (venue_id);

-- ---------------------------------------------------------------------------
-- Access helpers
-- ---------------------------------------------------------------------------

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = public.current_email()
  );
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.allowed_emails
    where email = public.current_email()
      and role = 'owner'
  );
$$;

-- Records the signed-in mate's name and picture. Members only, and only for
-- their own id.
create function public.upsert_profile(p_display_name text, p_avatar_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member() or public.current_user_id() is null then
    raise exception 'not a member' using errcode = '42501';
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (public.current_user_id(), p_display_name, p_avatar_url)
  on conflict (id) do update
    set display_name = excluded.display_name,
        avatar_url = excluded.avatar_url
    where profiles.display_name is distinct from excluded.display_name
       or profiles.avatar_url is distinct from excluded.avatar_url;
end;
$$;

-- The daily job's coordinate refresh. These touch only lat, lng and
-- location_refreshed_at, so the job doesn't need to bypass the edit policies.
create function public.venues_needing_refresh(p_limit integer, p_older_than interval)
returns table (id uuid, google_place_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id, v.google_place_id
  from public.venues v
  where v.google_place_id is not null
    and (v.location_refreshed_at is null or v.location_refreshed_at < now() - p_older_than)
  order by v.location_refreshed_at nulls first
  limit p_limit;
$$;

create function public.set_venue_location(p_id uuid, p_lat double precision, p_lng double precision)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.venues
  set lat = p_lat, lng = p_lng, location_refreshed_at = now()
  where id = p_id;
$$;

revoke execute on all functions in schema public from public;
grant execute on function
  public.current_user_id(), public.current_email(), public.is_member(), public.is_owner(),
  public.upsert_profile(text, text),
  public.venues_needing_refresh(integer, interval),
  public.set_venue_location(uuid, double precision, double precision)
  to mates_app;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

revoke execute on function public.set_updated_at() from public;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on table public.venues, public.deals to mates_app;
grant select on table public.profiles, public.allowed_emails to mates_app;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.allowed_emails enable row level security;
alter table public.profiles       enable row level security;
alter table public.venues         enable row level security;
alter table public.deals          enable row level security;

create policy "members read allowlist" on public.allowed_emails
  for select to mates_app using ((select public.is_member()));

create policy "members read profiles" on public.profiles
  for select to mates_app using ((select public.is_member()));

-- venues
create policy "members read venues" on public.venues
  for select to mates_app using ((select public.is_member()));

create policy "members add venues" on public.venues
  for insert to mates_app
  with check ((select public.is_member()) and created_by = (select public.current_user_id()));

create policy "creator or owner updates venues" on public.venues
  for update to mates_app
  using (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  )
  with check (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  );

create policy "creator or owner deletes venues" on public.venues
  for delete to mates_app
  using (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  );

-- deals
create policy "members read deals" on public.deals
  for select to mates_app using ((select public.is_member()));

create policy "members add deals" on public.deals
  for insert to mates_app
  with check ((select public.is_member()) and created_by = (select public.current_user_id()));

create policy "creator or owner updates deals" on public.deals
  for update to mates_app
  using (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  )
  with check (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  );

create policy "creator or owner deletes deals" on public.deals
  for delete to mates_app
  using (
    (select public.is_member())
    and (created_by = (select public.current_user_id()) or (select public.is_owner()))
  );
