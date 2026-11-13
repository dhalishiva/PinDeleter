// Fetches per-pin analytics (last 90 days) within a time budget. The client calls repeatedly until remaining = 0.
import { requireUser } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { numberEnv } from '../_shared/env.ts';
import { handler, HttpError, json, parseJson, sleep } from '../_shared/http.ts';
import { clientForConnection, loadConnection, PinterestApiError } from '../_shared/pinterest/index.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({
  connectionId: z.string().uuid(),
  pinIds: z.array(z.string().uuid()).max(500).optional(),
  pinterestBoardId: z.string().max(100).optional(),
});

const BUDGET_MS = 25_000;
const PER_CALL = 150;

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

Deno.serve(
  handler({ name: 'pins-engagement', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const body = await parseJson(req, Body);
    const conn = await loadConnection(body.connectionId, user.id);
    if (!conn) throw new HttpError(404, 'not_found', 'Connection not found.');
    if (conn.status !== 'active')
      throw new HttpError(409, 'connection_inactive', 'Reconnect this account first.');

    const db = adminClient();
    const scope = () => {
      let q = db
        .from('pins')
        .select('id, pinterest_pin_id', { count: 'exact' })
        .eq('connection_id', conn.id)
        .eq('user_id', user.id)
        .in('status', ['active', 'failed'])
        .is('engagement_fetched_at', null);
      if (body.pinIds?.length) q = q.in('id', body.pinIds);
      if (body.pinterestBoardId) q = q.eq('pinterest_board_id', body.pinterestBoardId);
      return q;
    };

    const { data: pins, error } = await scope().order('created_at_pinterest').limit(PER_CALL);
    if (error) throw new Error(error.message);

    const client = clientForConnection(conn);
    const end = new Date();
    const range = { startDate: ymd(new Date(end.getTime() - 89 * 86_400_000)), endDate: ymd(end) };
    const deadline = Date.now() + BUDGET_MS;
    const gap = 1000 / numberEnv('DELETE_RPS', 5);
    let processed = 0;
    let rateLimited = false;
    let retryAfterMs: number | undefined;

    for (const pin of pins ?? []) {
      if (Date.now() >= deadline) break;
      const started = Date.now();
      let patch: Record<string, unknown>;
      try {
        const m = await client.getPinAnalytics(pin.pinterest_pin_id as string, range);
        patch = {
          saves: m.saves,
          clicks: m.clicks,
          impressions: m.impressions,
          engagement_fetched_at: new Date().toISOString(),
        };
      } catch (err) {
        if (err instanceof PinterestApiError && err.status === 429) {
          rateLimited = true;
          retryAfterMs = err.retryAfterMs;
          break;
        }
        if (err instanceof PinterestApiError && err.status === 401) {
          throw new HttpError(
            409,
            'reauth_required',
            'Pinterest rejected our access. Please reconnect this account.',
          );
        }
        if (err instanceof PinterestApiError && err.status === 404) {
          patch = { status: 'deleted' };
        } else if (err instanceof PinterestApiError && err.status >= 400 && err.status < 500) {
          // e.g. analytics unavailable for pins you saved from others: mark as fetched with unknown stats.
          patch = { engagement_fetched_at: new Date().toISOString() };
        } else {
          break; // transient: stop and let the client retry
        }
      }
      const { error: upErr } = await db.from('pins').update(patch).eq('id', pin.id);
      if (upErr) throw new Error(upErr.message);
      processed++;
      const wait = gap - (Date.now() - started);
      if (wait > 0) await sleep(wait);
    }

    const { count } = await scope().limit(1);
    return json(req, { processed, remaining: count ?? 0, rateLimited, retryAfterMs: retryAfterMs ?? null });
  }),
);
