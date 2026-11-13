// Starts (or returns the running) sync for a connection. The first step runs in the background;
// sync-worker continues long syncs every minute.
import { requireUser } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson, runInBackground } from '../_shared/http.ts';
import { loadConnection } from '../_shared/pinterest/index.ts';
import { runSyncStep, startSyncRun } from '../_shared/sync/syncer.ts';

const Body = z.object({ connectionId: z.string().uuid() });

Deno.serve(
  handler({ name: 'pinterest-sync', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { connectionId } = await parseJson(req, Body);
    const conn = await loadConnection(connectionId, user.id);
    if (!conn) throw new HttpError(404, 'not_found', 'Connection not found.');
    if (conn.status !== 'active') {
      throw new HttpError(409, 'connection_inactive', 'Reconnect this Pinterest account before syncing.');
    }
    const run = await startSyncRun(conn.id, user.id);
    runInBackground(runSyncStep(run));
    return json(req, { syncRunId: run.id });
  }),
);
