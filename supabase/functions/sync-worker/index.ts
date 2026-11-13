// Cron (every minute): continues running syncs whose lease has expired.
import { requireServiceRole } from '../_shared/auth.ts';
import { handler, json } from '../_shared/http.ts';
import { adminClient } from '../_shared/supabase.ts';
import { runSyncStep, type SyncRunRow } from '../_shared/sync/syncer.ts';

Deno.serve(
  handler({ name: 'sync-worker', methods: ['POST'] }, async (req) => {
    requireServiceRole(req);
    const { data, error } = await adminClient().rpc('claim_sync_runs', {
      p_worker: crypto.randomUUID(),
      p_limit: 3,
    });
    if (error) throw new Error(error.message);
    const runs = (data ?? []) as SyncRunRow[];
    const results = await Promise.all(runs.map((run) => runSyncStep(run, 40_000)));
    return json(req, { claimed: runs.length, results });
  }),
);
