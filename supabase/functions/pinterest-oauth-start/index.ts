// Starts the Pinterest OAuth flow: checks the plan's account limit and creates a single-use state.
import { requireUser } from '../_shared/auth.ts';
import { usedConnectionSlots } from '../_shared/connections.ts';
import { randomToken } from '../_shared/crypto.ts';
import { z } from '../_shared/deps.ts';
import { siteUrl } from '../_shared/env.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { getProfilePlan } from '../_shared/jobs/repo-db.ts';
import { pinterestClient } from '../_shared/pinterest/index.ts';
import { computeEntitlement } from '../_shared/plans.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({ reconnectConnectionId: z.string().uuid().optional() });

Deno.serve(
  handler({ name: 'pinterest-oauth-start', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const body = await parseJson(req, Body);
    await enforceRateLimit('oauth-start', user.id, 20, 3600);

    const ent = computeEntitlement(await getProfilePlan(user.id));
    const slots = await usedConnectionSlots(user.id);
    const reconnecting = body.reconnectConnectionId && slots.some((s) => s.id === body.reconnectConnectionId);
    if (!reconnecting && slots.length >= ent.maxConnections) {
      throw new HttpError(
        402,
        'connection_limit',
        ent.plan === 'agency'
          ? `Your plan allows ${ent.maxConnections} Pinterest accounts. Disconnect one to add another.`
          : `Your plan allows ${ent.maxConnections} Pinterest account. Upgrade to Agency to connect up to 5.`,
        { maxConnections: ent.maxConnections, used: slots.length },
      );
    }

    const state = randomToken(32);
    const { error } = await adminClient()
      .from('oauth_states')
      .insert({ state, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (error) throw new Error(error.message);

    const redirectUri = `${siteUrl()}/app/connect/pinterest/callback`;
    return json(req, { url: pinterestClient().authorizeUrl(state, redirectUri) });
  }),
);
