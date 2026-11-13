// Pinterest client factory + per-connection token sessions (decrypt, auto-refresh, persist).
import { decryptString, encryptString } from '../crypto.ts';
import { env, isPinterestMock } from '../env.ts';
import { errorFields, log } from '../log.ts';
import { adminClient } from '../supabase.ts';
import { type MockStore, MockPinterestClient } from './mock.ts';
import { RealPinterestClient } from './real.ts';
import type { PinterestClient, PinterestTokens, TokenSession } from './types.ts';

export * from './types.ts';

export interface ConnectionRow {
  id: string;
  user_id: string;
  pinterest_user_id: string;
  username: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  refresh_expires_at: string | null;
  status: 'active' | 'revoked' | 'error';
}

export const CONNECTION_SECRET_COLUMNS =
  'id, user_id, pinterest_user_id, username, access_token_enc, refresh_token_enc, token_expires_at, refresh_expires_at, status';

class DbMockStore implements MockStore {
  async deletedIds(accountId: string): Promise<Set<string>> {
    const ids = new Set<string>();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await adminClient()
        .from('mock_deleted_pins')
        .select('pinterest_pin_id')
        .eq('pinterest_user_id', accountId)
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) ids.add(row.pinterest_pin_id as string);
      if (!data || data.length < pageSize) break;
    }
    return ids;
  }
  async markDeleted(accountId: string, pinId: string): Promise<void> {
    const { error } = await adminClient()
      .from('mock_deleted_pins')
      .upsert(
        { pinterest_user_id: accountId, pinterest_pin_id: pinId },
        { onConflict: 'pinterest_user_id,pinterest_pin_id' },
      );
    if (error) throw new Error(error.message);
  }
}

export function pinterestClient(session?: TokenSession): PinterestClient {
  if (isPinterestMock()) return new MockPinterestClient({ store: new DbMockStore(), session });
  return new RealPinterestClient(
    {
      clientId: env('PINTEREST_CLIENT_ID'),
      clientSecret: env('PINTEREST_CLIENT_SECRET'),
      apiBase: env('PINTEREST_API_BASE', 'https://api.pinterest.com/v5').replace(/\/+$/, ''),
    },
    session,
  );
}

export async function encryptTokens(tokens: PinterestTokens, now = Date.now()) {
  const key = env('TOKEN_ENCRYPTION_KEY');
  return {
    access_token_enc: await encryptString(tokens.accessToken, key),
    refresh_token_enc: tokens.refreshToken ? await encryptString(tokens.refreshToken, key) : null,
    token_expires_at: new Date(now + tokens.expiresIn * 1000).toISOString(),
    refresh_expires_at: tokens.refreshExpiresIn
      ? new Date(now + tokens.refreshExpiresIn * 1000).toISOString()
      : null,
  };
}

/** Token session bound to a stored connection. Refreshes 2 minutes before expiry and persists new tokens. */
export function connectionSession(conn: ConnectionRow): TokenSession {
  const key = env('TOKEN_ENCRYPTION_KEY');
  let accessToken: string | null = null;
  let expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : 0;
  let refreshTokenEnc = conn.refresh_token_enc;
  let inflight: Promise<string | null> | null = null;

  const doRefresh = async (): Promise<string | null> => {
    if (!refreshTokenEnc) return null;
    try {
      const refreshToken = await decryptString(refreshTokenEnc, key);
      const tokens = await pinterestClient().refreshToken(refreshToken);
      if (!tokens.refreshToken) tokens.refreshToken = refreshToken;
      const enc = await encryptTokens(tokens);
      const { error } = await adminClient()
        .from('pinterest_connections')
        .update({ ...enc, status: 'active', last_error: null })
        .eq('id', conn.id);
      if (error) throw new Error(error.message);
      accessToken = tokens.accessToken;
      expiresAt = new Date(enc.token_expires_at).getTime();
      refreshTokenEnc = enc.refresh_token_enc;
      log.info('pinterest_token_refreshed', { connectionId: conn.id });
      return accessToken;
    } catch (err) {
      log.warn('pinterest_token_refresh_failed', { connectionId: conn.id, ...errorFields(err) });
      return null;
    }
  };

  const refresh = () => {
    inflight ??= doRefresh().finally(() => {
      inflight = null;
    });
    return inflight;
  };

  return {
    async getAccessToken() {
      if (expiresAt && expiresAt - Date.now() < 120_000) {
        const fresh = await refresh();
        if (fresh) return fresh;
      }
      if (!accessToken) {
        if (!conn.access_token_enc) throw new Error('Connection has no access token');
        accessToken = await decryptString(conn.access_token_enc, key);
      }
      return accessToken;
    },
    refresh,
  };
}

export async function loadConnection(connectionId: string, userId?: string): Promise<ConnectionRow | null> {
  let query = adminClient()
    .from('pinterest_connections')
    .select(CONNECTION_SECRET_COLUMNS)
    .eq('id', connectionId);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ConnectionRow | null) ?? null;
}

export function clientForConnection(conn: ConnectionRow): PinterestClient {
  return pinterestClient(connectionSession(conn));
}
