-- SQL helpers and RPCs.
-- Plan limits below MUST match src/config/site.ts and supabase/functions/_shared/plans.ts.

-- ---------------------------------------------------------------------------
-- Entitlement
-- ---------------------------------------------------------------------------
create or replace function public.get_entitlement(p_user_id uuid)
returns table (
  plan public.plan_tier,
  is_active boolean,
  unlimited boolean,
  free_deletions_remaining integer,
  max_connections integer,
  plan_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_free_limit constant integer := 50;
  v_active boolean;
begin
  if (select auth.role()) <> 'service_role' and (select auth.uid()) is distinct from p_user_id then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return;
  end if;

  v_active := v_profile.plan <> 'free'
    and v_profile.plan_expires_at is not null
    and v_profile.plan_expires_at > now();

  plan := case when v_active then v_profile.plan else 'free'::public.plan_tier end;
  is_active := v_active;
  unlimited := v_active;
  free_deletions_remaining := greatest(0, v_free_limit - v_profile.free_deletions_used);
  max_connections := case when v_active and v_profile.plan = 'agency' then 5 else 1 end;
  plan_expires_at := case when v_active then v_profile.plan_expires_at else null end;
  return next;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pin search (shared by list_pins / select_pin_ids / count_pins)
-- Filters JSON shape (built by src/lib/pinFilters.ts):
--   { q, boards: text[], createdFrom, createdTo, noEngagement, owner: 'created'|'saved', sort: 'newest'|'oldest'|'engagement' }
-- ---------------------------------------------------------------------------
create or replace function public.pin_search(p_connection_id uuid, p_filters jsonb)
returns table (
  id uuid,
  connection_id uuid,
  pinterest_pin_id text,
  board_id uuid,
  pinterest_board_id text,
  board_name text,
  title text,
  description text,
  link text,
  link_domain text,
  image_url text,
  image_width integer,
  image_height integer,
  dominant_color text,
  created_at_pinterest timestamptz,
  is_owner boolean,
  saves integer,
  clicks integer,
  impressions integer,
  engagement_fetched_at timestamptz,
  status public.pin_status,
  sort_key numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with f as (
    select
      nullif(trim(coalesce(p_filters ->> 'q', '')), '') as q,
      coalesce(
        (select array_agg(x) from jsonb_array_elements_text(
          case when jsonb_typeof(p_filters -> 'boards') = 'array' then p_filters -> 'boards' else '[]'::jsonb end
        ) as x),
        '{}'::text[]
      ) as boards,
      (p_filters ->> 'createdFrom')::timestamptz as created_from,
      (p_filters ->> 'createdTo')::timestamptz as created_to,
      coalesce((p_filters ->> 'noEngagement')::boolean, false) as no_engagement,
      p_filters ->> 'owner' as owner,
      coalesce(p_filters ->> 'sort', 'newest') as sort
  ),
  fq as (
    select f.*,
      '%' || replace(replace(replace(f.q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern
    from f
  )
  select
    p.id, p.connection_id, p.pinterest_pin_id, p.board_id, p.pinterest_board_id, b.name as board_name,
    p.title, p.description, p.link, p.link_domain, p.image_url, p.image_width, p.image_height,
    p.dominant_color, p.created_at_pinterest, p.is_owner, p.saves, p.clicks, p.impressions,
    p.engagement_fetched_at, p.status,
    case fq.sort
      when 'oldest' then extract(epoch from coalesce(p.created_at_pinterest, 'epoch'::timestamptz))
      when 'engagement' then (coalesce(p.saves, 0) + coalesce(p.clicks, 0))::numeric
      else -extract(epoch from coalesce(p.created_at_pinterest, 'epoch'::timestamptz))
    end as sort_key
  from public.pins p
  cross join fq
  left join public.boards b on b.id = p.board_id
  where p.connection_id = p_connection_id
    and p.user_id = (select auth.uid())
    and p.status in ('active', 'failed')
    and (
      fq.q is null
      or p.title ilike fq.pattern
      or p.description ilike fq.pattern
      or p.link_domain ilike fq.pattern
      or b.name ilike fq.pattern
    )
    and (cardinality(fq.boards) = 0 or p.pinterest_board_id = any (fq.boards))
    and (fq.created_from is null or p.created_at_pinterest >= fq.created_from)
    and (fq.created_to is null or p.created_at_pinterest < fq.created_to)
    and (
      not fq.no_engagement
      or (p.engagement_fetched_at is not null and p.saves = 0 and coalesce(p.clicks, 0) = 0)
    )
    and (
      fq.owner is null
      or (fq.owner = 'created' and p.is_owner)
      or (fq.owner = 'saved' and not p.is_owner)
    );
$$;

-- Keyset pagination: cursor = { "k": <sort_key>, "id": <uuid> }
create or replace function public.list_pins(
  p_connection_id uuid,
  p_filters jsonb default '{}'::jsonb,
  p_cursor jsonb default null,
  p_limit integer default 60
)
returns table (
  id uuid,
  connection_id uuid,
  pinterest_pin_id text,
  board_id uuid,
  pinterest_board_id text,
  board_name text,
  title text,
  description text,
  link text,
  link_domain text,
  image_url text,
  image_width integer,
  image_height integer,
  dominant_color text,
  created_at_pinterest timestamptz,
  is_owner boolean,
  saves integer,
  clicks integer,
  impressions integer,
  engagement_fetched_at timestamptz,
  status public.pin_status,
  sort_key numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.*
  from public.pin_search(p_connection_id, p_filters) s
  where p_cursor is null
     or (s.sort_key, s.id) > ((p_cursor ->> 'k')::numeric, (p_cursor ->> 'id')::uuid)
  order by s.sort_key, s.id
  limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;

create or replace function public.count_pins(p_connection_id uuid, p_filters jsonb default '{}'::jsonb)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer from public.pin_search(p_connection_id, p_filters);
$$;

-- "Select all matching" — returns up to 10,000 ids.
create or replace function public.select_pin_ids(p_connection_id uuid, p_filters jsonb default '{}'::jsonb)
returns uuid[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(id), '{}'::uuid[])
  from (
    select s.id from public.pin_search(p_connection_id, p_filters) s
    order by s.sort_key, s.id
    limit 10000
  ) t;
$$;

create or replace function public.board_pin_counts(p_connection_id uuid)
returns table (board_id uuid, pinterest_board_id text, name text, privacy text, pin_count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.id, b.pinterest_board_id, b.name, b.privacy, count(p.id)::integer
  from public.boards b
  left join public.pins p on p.board_id = b.id and p.status in ('active', 'failed')
  where b.connection_id = p_connection_id and b.user_id = (select auth.uid())
  group by b.id
  order by count(p.id) desc, b.name;
$$;

-- ---------------------------------------------------------------------------
-- Worker helpers (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.claim_delete_jobs(p_worker text, p_limit integer default 3, p_job_id uuid default null)
returns setof public.delete_jobs
language sql
security definer
set search_path = ''
as $$
  update public.delete_jobs j
  set locked_until = now() + interval '60 seconds',
      locked_by = p_worker,
      status = 'running',
      next_run_at = null,
      started_at = coalesce(j.started_at, now())
  where j.id in (
    select d.id from public.delete_jobs d
    where d.status in ('queued', 'running', 'rate_limited')
      and (d.next_run_at is null or d.next_run_at <= now())
      and (d.locked_until is null or d.locked_until < now())
      and (p_job_id is null or d.id = p_job_id)
    order by d.created_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning j.*;
$$;

create or replace function public.claim_sync_runs(p_worker text, p_limit integer default 3)
returns setof public.sync_runs
language sql
security definer
set search_path = ''
as $$
  update public.sync_runs s
  set locked_until = now() + interval '75 seconds'
  where s.id in (
    select r.id from public.sync_runs r
    where r.status = 'running'
      and (r.locked_until is null or r.locked_until < now())
    order by r.started_at
    limit greatest(p_limit, 1)
    for update skip locked
  )
  returning s.*;
$$;

create or replace function public.increment_job_counters(
  p_job_id uuid,
  p_deleted integer default 0,
  p_failed integer default 0,
  p_skipped integer default 0
)
returns public.delete_jobs
language sql
security definer
set search_path = ''
as $$
  update public.delete_jobs
  set deleted_count = deleted_count + p_deleted,
      failed_count = failed_count + p_failed,
      skipped_count = skipped_count + p_skipped
  where id = p_job_id
  returning *;
$$;

create or replace function public.increment_free_deletions(p_user_id uuid, p_n integer)
returns integer
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set free_deletions_used = free_deletions_used + greatest(p_n, 0)
  where id = p_user_id
  returning free_deletions_used;
$$;

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_ip_hash text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, ip_hash, window_start, count)
  values (p_key, p_ip_hash, v_window, 1)
  on conflict (key, ip_hash, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;

-- Daily maintenance: retention purges + plan downgrades.
create or replace function public.run_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pins integer;
  v_boards integer;
  v_items integer;
  v_events integer;
  v_jobs integer;
  v_states integer;
  v_plans integer;
  v_syncs integer;
  v_rl integer;
begin
  -- Pin cache: purge rows not synced for 7 days (never touch pins inside an active job).
  delete from public.pins
  where synced_at < now() - interval '7 days' and status <> 'queued';
  get diagnostics v_pins = row_count;

  delete from public.boards b
  where b.synced_at < now() - interval '7 days'
    and not exists (select 1 from public.pins p where p.board_id = b.id);
  get diagnostics v_boards = row_count;

  delete from public.delete_job_items where created_at < now() - interval '30 days';
  get diagnostics v_items = row_count;

  delete from public.job_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;

  delete from public.delete_jobs
  where created_at < now() - interval '30 days'
    and status in ('completed', 'cancelled', 'failed');
  get diagnostics v_jobs = row_count;

  delete from public.sync_runs where started_at < now() - interval '30 days';
  get diagnostics v_syncs = row_count;

  delete from public.oauth_states where expires_at < now() or used_at is not null;
  get diagnostics v_states = row_count;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_rl = row_count;

  -- Stale running syncs (no progress for 2 hours) are failed so the user can retry.
  update public.sync_runs
  set status = 'failed', error = 'Sync timed out. Please start a new sync.', finished_at = now()
  where status = 'running' and updated_at < now() - interval '2 hours';

  update public.profiles
  set plan = 'free', plan_expires_at = null
  where plan <> 'free' and (plan_expires_at is null or plan_expires_at < now());
  get diagnostics v_plans = row_count;

  return jsonb_build_object(
    'pins_purged', v_pins,
    'boards_purged', v_boards,
    'job_items_purged', v_items,
    'job_events_purged', v_events,
    'jobs_purged', v_jobs,
    'sync_runs_purged', v_syncs,
    'oauth_states_purged', v_states,
    'rate_limit_rows_purged', v_rl,
    'plans_downgraded', v_plans
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_entitlement(uuid) to authenticated, service_role;
grant execute on function public.pin_search(uuid, jsonb) to authenticated;
grant execute on function public.list_pins(uuid, jsonb, jsonb, integer) to authenticated;
grant execute on function public.count_pins(uuid, jsonb) to authenticated;
grant execute on function public.select_pin_ids(uuid, jsonb) to authenticated;
grant execute on function public.board_pin_counts(uuid) to authenticated;

grant execute on function public.claim_delete_jobs(text, integer, uuid) to service_role;
grant execute on function public.claim_sync_runs(text, integer) to service_role;
grant execute on function public.increment_job_counters(uuid, integer, integer, integer) to service_role;
grant execute on function public.increment_free_deletions(uuid, integer) to service_role;
grant execute on function public.hit_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.run_maintenance() to service_role;

-- Trigger functions keep working without execute grants (they run as the table owner).
