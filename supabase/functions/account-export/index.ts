// "Export my data": JSON of profile, connection metadata, jobs (with items) and payments. No tokens.
import { requireUser } from '../_shared/auth.ts';
import { handler, json } from '../_shared/http.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(
  handler({ name: 'account-export', methods: ['POST', 'GET'] }, async (req) => {
    const user = await requireUser(req);
    await enforceRateLimit('account-export', user.id, 10, 3600);
    const db = adminClient();
    const [profile, connections, jobs, items, payments] = await Promise.all([
      db
        .from('profiles')
        .select(
          'id, email, display_name, notify_on_job_complete, free_deletions_used, plan, plan_expires_at, created_at',
        )
        .eq('id', user.id)
        .maybeSingle(),
      db
        .from('pinterest_connections')
        .select('id, pinterest_user_id, username, account_type, scopes, status, last_synced_at, created_at')
        .eq('user_id', user.id),
      db
        .from('delete_jobs')
        .select(
          'id, connection_id, is_dry_run, status, total, deleted_count, failed_count, skipped_count, rate_limit_pauses, started_at, finished_at, created_at',
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      db
        .from('delete_job_items')
        .select(
          'job_id, pinterest_pin_id, status, reason, attempts, last_http_status, processed_at, title, link, board_name, created_at_pinterest',
        )
        .eq('user_id', user.id)
        .limit(50_000),
      db
        .from('payments')
        .select(
          'id, paypal_order_id, paypal_capture_id, plan, amount_cents, currency, status, paid_at, refunded_at, created_at',
        )
        .eq('user_id', user.id),
    ]);
    for (const r of [profile, connections, jobs, items, payments])
      if (r.error) throw new Error(r.error.message);
    return json(
      req,
      {
        exported_at: new Date().toISOString(),
        product: 'PinDeleter by Kriosity',
        account: { id: user.id, email: user.email },
        profile: profile.data,
        pinterest_connections: connections.data,
        delete_jobs: jobs.data,
        delete_job_items: items.data,
        payments: payments.data,
      },
      200,
      { 'Content-Disposition': 'attachment; filename="pindeleter-export.json"' },
    );
  }),
);
