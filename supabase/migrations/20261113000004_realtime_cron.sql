-- Realtime publication + scheduled workers.

-- ---------------------------------------------------------------------------
-- Realtime: RLS select policies (see security migration) make sure users only receive their own rows.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;
alter publication supabase_realtime add table public.sync_runs, public.delete_jobs, public.job_events;

-- ---------------------------------------------------------------------------
-- Scheduled workers via pg_cron + pg_net.
-- The project URL and service role key are read from Vault secrets `project_url` and `service_role_key`
-- (create them with supabase/vault-seed.sql.example — see SETUP.md). Missing secrets => the call is skipped.
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_edge_function(p_name text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url' limit 1;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key' limit 1;
  if v_url is null or v_key is null then
    raise warning 'invoke_edge_function(%): vault secrets project_url / service_role_key are missing', p_name;
    return null;
  end if;
  return net.http_post(
    url := rtrim(v_url, '/') || '/functions/v1/' || p_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := p_body,
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.invoke_edge_function(text, jsonb) from public, anon, authenticated;

do $$
declare
  v_name text;
begin
  foreach v_name in array array['pindeleter-jobs-worker', 'pindeleter-sync-worker', 'pindeleter-maintenance'] loop
    if exists (select 1 from cron.job where jobname = v_name) then
      perform cron.unschedule(v_name);
    end if;
  end loop;
end;
$$;

select cron.schedule('pindeleter-jobs-worker', '* * * * *', $$ select public.invoke_edge_function('jobs-worker'); $$);
select cron.schedule('pindeleter-sync-worker', '* * * * *', $$ select public.invoke_edge_function('sync-worker'); $$);
-- 03:00 IST = 21:30 UTC
select cron.schedule('pindeleter-maintenance', '30 21 * * *', $$ select public.invoke_edge_function('maintenance'); $$);
