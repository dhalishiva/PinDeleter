// Completes Pinterest OAuth: validates state, exchanges the code, stores encrypted tokens, starts a sync.
import { requireUser } from '../_shared/auth.ts';
import { usedConnectionSlots } from '../_shared/connections.ts';
import { z } from '../_shared/deps.ts';
import { siteUrl } from '../_shared/env.ts';
import { handler, HttpError, json, parseJson, runInBackground } from '../_shared/http.ts';
import { getProfilePlan } from '../_shared/jobs/repo-db.ts';
import { log } from '../_shared/log.ts';
import { encryptTokens, pinterestClient, PinterestApiError } from '../_shared/pinterest/index.ts';
import { computeEntitlement } from '../_shared/plans.ts';
import { adminClient } from '../_shared/supabase.ts';
import { runSyncStep, startSyncRun } from '../_shared/sync/syncer.ts';

const Body = z.object({ code: z.string().min(1).max(512), state: z.string().min(20).max(128) });

Deno.serve(
  handler({ name: 'pinterest-oauth-callback', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { code, state } = await parseJson(req, Body);
    const db = adminClient();

    // Single use: atomically mark the state used; only succeeds for this user, unexpired, unused.
    const { data: claimed, error: stateErr } = await db
      .from('oauth_states')
      .update({ used_at: new Date().toISOString() })
      .eq('state', state)
      .eq('user_id', user.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .select('state');
    if (stateErr) throw new Error(stateErr.message);
    if (!claimed?.length) {
      throw new HttpError(
        400,
        'invalid_state',
        'This connection link has expired or was already used. Please try connecting again.',
      );
    }

    const redirectUri = `${siteUrl()}/app/connect/pinterest/callback`;
    let tokens;
    try {
      tokens = await pinterestClient().exchangeCode(code, redirectUri);
    } catch (err) {
      if (err instanceof PinterestApiError) {
        log.warn('pinterest_code_exchange_failed', { status: err.status, code: err.code });
        throw new HttpError(
          400,
          'pinterest_exchange_failed',
          'Pinterest did not accept the authorization. Please try again.',
        );
      }
      throw err;
    }

    const now = Date.now();
    const session = {
      getAccessToken: () => Promise.resolve(tokens.accessToken),
      refresh: () => Promise.resolve(null),
    };
    let account;
    try {
      account = await pinterestClient(session).getUserAccount();
    } catch (err) {
      if (err instanceof PinterestApiError && err.status === 401) {
        throw new HttpError(
          400,
          'pinterest_account_unavailable',
          'Pinterest did not let us read this account. If the app is still in Trial access, only the developer account can connect.',
        );
      }
      throw err;
    }

    // Plan limit (a re-connect of an existing account is always allowed).
    const ent = computeEntitlement(await getProfilePlan(user.id));
    const slots = await usedConnectionSlots(user.id);
    const isExisting = slots.some((s) => s.pinterest_user_id === account.id);
    if (!isExisting && slots.length >= ent.maxConnections) {
      throw new HttpError(
        402,
        'connection_limit',
        'You have reached the number of Pinterest accounts your plan allows.',
      );
    }

    const enc = await encryptTokens(tokens, now);
    const { data: conn, error } = await db
      .from('pinterest_connections')
      .upsert(
        {
          user_id: user.id,
          pinterest_user_id: account.id,
          username: account.username,
          profile_image: account.profileImage,
          account_type: account.accountType,
          scopes: tokens.scopes,
          status: 'active',
          last_error: null,
          ...enc,
        },
        { onConflict: 'user_id,pinterest_user_id' },
      )
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const run = await startSyncRun(conn.id, user.id);
    runInBackground(runSyncStep(run));
    log.info('pinterest_connected', { connectionId: conn.id, mock: pinterestClient().mock });
    return json(req, { connectionId: conn.id, syncRunId: run.id });
  }),
);
