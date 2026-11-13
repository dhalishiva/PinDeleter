import { buildDataset, MemoryMockStore, MockPinterestClient, mockTokensFor } from '../pinterest/mock.ts';
import { mapPin, RealPinterestClient } from '../pinterest/real.ts';
import { parseRetryAfterMs } from '../pinterest/types.ts';
import { assert, assertEquals } from './assert.ts';

Deno.test('mock dataset: 8 boards, ~300 pins over 7 years, ~40% zero engagement, deterministic', () => {
  const a = buildDataset('mock-abc123');
  const b = buildDataset('mock-abc123');
  assertEquals(a.boards.length, 8);
  assertEquals(a.pins.length, 300);
  assertEquals(a.pins[0]!.id, b.pins[0]!.id);
  const zero = [...a.engagement.values()].filter((m) => m.saves === 0 && m.clicks === 0).length;
  assert(zero > 90 && zero < 150, `zero engagement count ${zero}`);
  const years = new Set(a.pins.map((p) => p.createdAt!.slice(0, 4)));
  assert(years.size >= 7);
  assert(a.pins[0]!.imageUrl!.startsWith('data:image/svg+xml'));
});

Deno.test('mock OAuth round trip and pagination', async () => {
  const client = new MockPinterestClient({ store: new MemoryMockStore() });
  const url = new URL(client.authorizeUrl('STATE', 'https://app.test/app/connect/pinterest/callback'));
  assertEquals(url.searchParams.get('state'), 'STATE');
  const tokens = await client.exchangeCode(url.searchParams.get('code')!, 'x');
  const session = {
    getAccessToken: () => Promise.resolve(tokens.accessToken),
    refresh: () => Promise.resolve(null),
  };
  const authed = new MockPinterestClient({ store: new MemoryMockStore(), session, pageSize: 100 });
  const acct = await authed.getUserAccount();
  assert(acct.id.startsWith('mock-'));
  let bookmark: string | null = null;
  let total = 0;
  do {
    const page = await authed.listPins(bookmark);
    total += page.items.length;
    bookmark = page.bookmark;
  } while (bookmark);
  assertEquals(total, 300);
  const refreshed = await authed.refreshToken(mockTokensFor(acct.id).refreshToken!);
  assertEquals(refreshed.accessToken, tokens.accessToken);
});

Deno.test(
  'real client: Basic auth token exchange, bearer calls, 401 refresh-and-retry, 429 retry-after',
  async () => {
    const seen: { url: string; auth: string | null; method: string }[] = [];
    let token = 'pina_old';
    const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      seen.push({ url, auth: headers.get('authorization'), method: init?.method ?? 'GET' });
      if (url.endsWith('/oauth/token')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'pina_new',
              refresh_token: 'pinr_x',
              expires_in: 2592000,
              refresh_token_expires_in: 5184000,
              scope: 'boards:read,pins:read',
            }),
            { status: 200 },
          ),
        );
      }
      if (url.includes('/user_account')) {
        if (headers.get('authorization') === 'Bearer pina_old')
          return Promise.resolve(new Response('{"code":2,"message":"expired"}', { status: 401 }));
        return Promise.resolve(
          new Response(JSON.stringify({ id: '123', username: 'me', account_type: 'BUSINESS' }), {
            status: 200,
          }),
        );
      }
      if (url.includes('/pins/RATE')) {
        return Promise.resolve(
          new Response('{"message":"slow down"}', { status: 429, headers: { 'Retry-After': '7' } }),
        );
      }
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;
    const cfg = { clientId: 'cid', clientSecret: 'sec', apiBase: 'https://api.pinterest.com/v5', fetchImpl };
    const app = new RealPinterestClient(cfg);
    const t = await app.exchangeCode('CODE', 'https://pindeleter.kriosity.in/app/connect/pinterest/callback');
    assertEquals(t.accessToken, 'pina_new');
    assertEquals(t.scopes, ['boards:read', 'pins:read']);
    assertEquals(seen[0]!.auth, `Basic ${btoa('cid:sec')}`);

    const session = {
      getAccessToken: () => Promise.resolve(token),
      refresh: () => {
        token = 'pina_new';
        return Promise.resolve(token);
      },
    };
    const client = new RealPinterestClient(cfg, session);
    const acct = await client.getUserAccount();
    assertEquals(acct.username, 'me');
    assertEquals((await client.deletePin('OK1')).status, 204);
    const limited = await client.deletePin('RATE');
    assertEquals(limited.status, 429);
    assertEquals(limited.retryAfterMs, 7000);
    const authorize = new URL(app.authorizeUrl('S', 'https://x/cb'));
    assertEquals(authorize.origin + authorize.pathname, 'https://www.pinterest.com/oauth/');
    assertEquals(authorize.searchParams.get('scope'), 'boards:read,pins:read,pins:write,user_accounts:read');
  },
);

Deno.test('parseRetryAfterMs handles headers', () => {
  assertEquals(parseRetryAfterMs(new Headers({ 'retry-after': '3' })), 3000);
  assertEquals(parseRetryAfterMs(new Headers({ 'x-ratelimit-reset': '30' })), 30_000);
  assertEquals(parseRetryAfterMs(new Headers()), 60_000);
});

Deno.test('mapPin picks the best image', () => {
  const p = mapPin({
    id: '1',
    media: { images: { '150x150': { url: 's' }, '600x': { url: 'big', width: 600, height: 900 } } },
  });
  assertEquals(p.imageUrl, 'big');
  assertEquals(p.imageHeight, 900);
});
