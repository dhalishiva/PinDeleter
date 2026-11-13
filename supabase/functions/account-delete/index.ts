// Deletes the account: disconnects every Pinterest account, deletes all user rows, then the auth user.
// Payment records are kept (user_id nulled) because tax law requires invoices to be retained.
import { requireUser } from '../_shared/auth.ts';
import { disconnectConnection } from '../_shared/connections.ts';
import { z } from '../_shared/deps.ts';
import { handler, json, parseJson } from '../_shared/http.ts';
import { log } from '../_shared/log.ts';
import { CONNECTION_SECRET_COLUMNS, type ConnectionRow } from '../_shared/pinterest/index.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({ confirm: z.literal('DELETE') });

Deno.serve(
  handler({ name: 'account-delete', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    await parseJson(req, Body);
    const db = adminClient();

    const { data: conns, error } = await db
      .from('pinterest_connections')
      .select(CONNECTION_SECRET_COLUMNS)
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    for (const conn of (conns ?? []) as ConnectionRow[]) await disconnectConnection(conn);

    for (const table of [
      'job_events',
      'delete_job_items',
      'delete_jobs',
      'pinterest_connections',
      'oauth_states',
      'profiles',
    ] as const) {
      const column = table === 'profiles' ? 'id' : 'user_id';
      const { error: delErr } = await db.from(table).delete().eq(column, user.id);
      if (delErr) throw new Error(delErr.message);
    }
    const { error: authErr } = await db.auth.admin.deleteUser(user.id);
    if (authErr) throw new Error(authErr.message);
    log.info('account_deleted', { userId: user.id });
    return json(req, { ok: true });
  }),
);
