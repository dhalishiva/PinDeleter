-- PinDeleter by Kriosity — core schema
-- Every table has RLS enabled (see 20261113000002_security.sql).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.plan_tier as enum ('free', 'pass', 'agency');
create type public.connection_status as enum ('active', 'revoked', 'error');
create type public.pin_status as enum ('active', 'queued', 'deleted', 'failed');
create type public.sync_status as enum ('running', 'completed', 'failed');
create type public.job_status as enum ('queued', 'running', 'paused', 'rate_limited', 'completed', 'cancelled', 'failed');
create type public.job_item_status as enum ('pending', 'deleted', 'failed', 'skipped');
create type public.event_level as enum ('info', 'warn', 'error');
create type public.payment_status as enum ('created', 'paid', 'failed', 'refunded');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) <= 80),
  notify_on_job_complete boolean not null default true,
  free_deletions_used integer not null default 0 check (free_deletions_used >= 0),
  plan public.plan_tier not null default 'free',
  plan_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- pinterest_connections
-- ---------------------------------------------------------------------------
create table public.pinterest_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pinterest_user_id text not null,
  username text not null,
  profile_image text,
  account_type text,
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  refresh_expires_at timestamptz,
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  status public.connection_status not null default 'active',
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, pinterest_user_id)
);
create index pinterest_connections_user_idx on public.pinterest_connections (user_id);
create trigger pinterest_connections_updated_at before update on public.pinterest_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- oauth_states (single use, 10 minute expiry, user bound)
-- ---------------------------------------------------------------------------
create table public.oauth_states (
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  code_verifier text,
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index oauth_states_expires_idx on public.oauth_states (expires_at);

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------
create table public.boards (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.pinterest_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pinterest_board_id text not null,
  name text not null,
  description text,
  pin_count integer,
  privacy text,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, pinterest_board_id)
);
create index boards_user_idx on public.boards (user_id);
create trigger boards_updated_at before update on public.boards
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- pins
-- ---------------------------------------------------------------------------
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.pinterest_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pinterest_pin_id text not null,
  board_id uuid references public.boards (id) on delete set null,
  pinterest_board_id text,
  title text,
  description text,
  link text,
  link_domain text generated always as (
    nullif(lower(substring(link from '^(?:[a-zA-Z][a-zA-Z0-9+.-]*://)?(?:www\.)?([^/:?#]+)')), '')
  ) stored,
  image_url text,
  image_width integer,
  image_height integer,
  dominant_color text,
  created_at_pinterest timestamptz,
  is_owner boolean not null default true,
  saves integer,
  clicks integer,
  impressions integer,
  engagement_fetched_at timestamptz,
  status public.pin_status not null default 'active',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, pinterest_pin_id)
);
create index pins_connection_status_idx on public.pins (connection_id, status);
create index pins_connection_board_idx on public.pins (connection_id, pinterest_board_id);
create index pins_connection_created_idx on public.pins (connection_id, created_at_pinterest);
create index pins_user_idx on public.pins (user_id);
create index pins_title_trgm_idx on public.pins using gin (title extensions.gin_trgm_ops);
create index pins_description_trgm_idx on public.pins using gin (description extensions.gin_trgm_ops);
create trigger pins_updated_at before update on public.pins
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- sync_runs
-- ---------------------------------------------------------------------------
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.pinterest_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.sync_status not null default 'running',
  phase text not null default 'boards' check (phase in ('boards', 'pins', 'finalize', 'done')),
  boards_found integer not null default 0,
  pins_fetched integer not null default 0,
  board_index integer not null default 0,
  cursor text,
  error text,
  locked_until timestamptz,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sync_runs_connection_idx on public.sync_runs (connection_id, started_at desc);
create index sync_runs_running_idx on public.sync_runs (status) where status = 'running';
create trigger sync_runs_updated_at before update on public.sync_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- delete_jobs
-- ---------------------------------------------------------------------------
create table public.delete_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.pinterest_connections (id) on delete cascade,
  parent_job_id uuid references public.delete_jobs (id) on delete set null,
  is_dry_run boolean not null default false,
  status public.job_status not null default 'queued',
  total integer not null default 0,
  deleted_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  rate_limit_pauses integer not null default 0,
  next_run_at timestamptz,
  locked_until timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index delete_jobs_user_idx on public.delete_jobs (user_id, created_at desc);
create index delete_jobs_runnable_idx on public.delete_jobs (status, next_run_at)
  where status in ('queued', 'running', 'rate_limited');
-- Only one non-terminal job per connection.
create unique index delete_jobs_one_active_per_connection
  on public.delete_jobs (connection_id)
  where status in ('queued', 'running', 'paused', 'rate_limited');
create trigger delete_jobs_updated_at before update on public.delete_jobs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- delete_job_items
-- ---------------------------------------------------------------------------
create table public.delete_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delete_jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  pin_id uuid references public.pins (id) on delete set null,
  pinterest_pin_id text not null,
  status public.job_item_status not null default 'pending',
  reason text,
  attempts integer not null default 0,
  last_http_status integer,
  last_error text,
  processed_at timestamptz,
  -- backup snapshot
  title text,
  link text,
  board_name text,
  image_url text,
  created_at_pinterest timestamptz,
  created_at timestamptz not null default now(),
  unique (job_id, pinterest_pin_id)
);
create index delete_job_items_job_status_idx on public.delete_job_items (job_id, status);
create index delete_job_items_created_idx on public.delete_job_items (created_at);

-- ---------------------------------------------------------------------------
-- job_events
-- ---------------------------------------------------------------------------
create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.delete_jobs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  level public.event_level not null default 'info',
  message text not null,
  created_at timestamptz not null default now()
);
create index job_events_job_idx on public.job_events (job_id, created_at desc);

-- ---------------------------------------------------------------------------
-- payments (user_id is nulled on account deletion; financial records are kept as required by law)
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  paypal_order_id text unique,
  paypal_capture_id text unique,
  plan public.plan_tier not null check (plan <> 'free'),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  payer_email text,
  payer_country text,
  status public.payment_status not null default 'created',
  raw_webhook jsonb,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.webhook_events (
  id text primary key,
  event_type text not null,
  resource_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

-- ---------------------------------------------------------------------------
-- contact_messages / rate_limits
-- ---------------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  topic text not null,
  message text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  ip_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (key, ip_hash, window_start)
);

-- Used only when PINTEREST_MOCK=true so that demo deletions survive re-syncs.
create table public.mock_deleted_pins (
  pinterest_user_id text not null,
  pinterest_pin_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (pinterest_user_id, pinterest_pin_id)
);
