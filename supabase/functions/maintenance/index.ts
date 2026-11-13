// Cron (daily 03:00 IST): retention purges and plan downgrades.
import { requireServiceRole } from '../_shared/auth.ts';
import { handler, json } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(
  handler({ name: 'maintenance', methods: ['POST'] }, async (req) => {
    requireServiceRole(req);
    const { data, error } = await adminClient().rpc('run_maintenance');
    if (error) throw new Error(error.message);
    log.info('maintenance_done', data as Record<string, unknown>);
    return json(req, { ok: true, result: data });
  }),
);
