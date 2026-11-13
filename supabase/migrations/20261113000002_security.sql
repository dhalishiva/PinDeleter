-- Row level security and grants.
-- Clients (anon / authenticated) may only READ their own rows, and may update two harmless profile columns.
-- All writes to sensitive tables happen inside Edge Functions using the service role.

alter table public.profiles enable row level security;
alter table public.pinterest_connections enable row level security;
alter table public.oauth_states enable row level security;
alter table public.boards enable row level security;
alter table public.pins enable row level security;
alter table public.sync_runs enable row level security;
alter table public.delete_jobs enable row level security;
alter table public.delete_job_items enable row level security;
alter table public.job_events enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.contact_messages enable row level security;
alter table public.rate_limits enable row level security;
alter table public.mock_deleted_pins enable row level security;

-- Start from zero: Supabase grants everything to anon/authenticated by default.
revoke all on all tables in schema public from anon, authenticated;

-- profiles --------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (display_name, notify_on_job_complete) on public.profiles to authenticated;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- pinterest_connections: token columns are NOT granted ---------------------------
grant select (
  id, user_id, pinterest_user_id, username, profile_image, account_type, token_expires_at,
  scopes, last_synced_at, status, last_error, created_at, updated_at
) on public.pinterest_connections to authenticated;
create policy "connections: read own" on public.pinterest_connections
  for select to authenticated using (user_id = (select auth.uid()));

create view public.pinterest_connections_public
with (security_invoker = true) as
  select id, user_id, pinterest_user_id, username, profile_image, account_type, token_expires_at,
         scopes, last_synced_at, status, last_error, created_at, updated_at
  from public.pinterest_connections;
revoke all on public.pinterest_connections_public from anon, authenticated;
grant select on public.pinterest_connections_public to authenticated;

-- boards / pins / sync_runs / jobs / items / events -----------------------------
grant select on public.boards, public.pins, public.sync_runs, public.delete_jobs,
  public.delete_job_items, public.job_events to authenticated;

create policy "boards: read own" on public.boards
  for select to authenticated using (user_id = (select auth.uid()));
create policy "pins: read own" on public.pins
  for select to authenticated using (user_id = (select auth.uid()));
create policy "sync_runs: read own" on public.sync_runs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete_jobs: read own" on public.delete_jobs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "delete_job_items: read own" on public.delete_job_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "job_events: read own" on public.job_events
  for select to authenticated using (user_id = (select auth.uid()));

-- payments: raw_webhook is not exposed --------------------------------------------
grant select (
  id, user_id, paypal_order_id, paypal_capture_id, plan, amount_cents, currency, payer_email,
  payer_country, status, paid_at, refunded_at, created_at, updated_at
) on public.payments to authenticated;
create policy "payments: read own" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));

-- oauth_states, webhook_events, contact_messages, rate_limits, mock_deleted_pins:
-- RLS enabled with no policies and no grants => service role only.
