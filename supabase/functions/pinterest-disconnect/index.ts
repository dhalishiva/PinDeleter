// Disconnects a Pinterest account and deletes its tokens and cached data.
import { requireUser } from '../_shared/auth.ts';
import { disconnectConnection } from '../_shared/connections.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { loadConnection } from '../_shared/pinterest/index.ts';

const Body = z.object({ connectionId: z.string().uuid() });

Deno.serve(
  handler({ name: 'pinterest-disconnect', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { connectionId } = await parseJson(req, Body);
    const conn = await loadConnection(connectionId, user.id);
    if (!conn) throw new HttpError(404, 'not_found', 'Connection not found.');
    const result = await disconnectConnection(conn);
    return json(req, { ok: true, ...result });
  }),
);
