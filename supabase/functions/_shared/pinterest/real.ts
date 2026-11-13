// Real Pinterest API v5 client.
// Docs: https://developers.pinterest.com/docs/api/v5/ (OAuth: Basic auth on /oauth/token, bookmark pagination).
import {
  type DateRange,
  type DeleteOutcome,
  type Page,
  type PinAnalytics,
  type PinterestAccount,
  PinterestApiError,
  type PinterestBoard,
  type PinterestClient,
  type PinterestPin,
  type PinterestTokens,
  PINTEREST_AUTHORIZE_URL,
  PINTEREST_SCOPES,
  parseRetryAfterMs,
  type TokenSession,
} from './types.ts';

export interface RealClientConfig {
  clientId: string;
  clientSecret: string;
  apiBase: string;
  fetchImpl?: typeof fetch;
}

const PAGE_SIZE = 250;

interface RawImage {
  url?: string;
  width?: number;
  height?: number;
}
interface RawPin {
  id: string;
  board_id?: string | null;
  title?: string | null;
  description?: string | null;
  link?: string | null;
  dominant_color?: string | null;
  created_at?: string | null;
  is_owner?: boolean;
  media?: { media_type?: string; images?: Record<string, RawImage>; cover_image_url?: string } | null;
}
interface RawBoard {
  id: string;
  name: string;
  description?: string | null;
  privacy?: string | null;
  pin_count?: number | null;
}
interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
}

export function mapPin(raw: RawPin): PinterestPin {
  const images = raw.media?.images ?? {};
  const img =
    images['600x'] ?? images['400x300'] ?? images['1200x'] ?? images['originals'] ?? images['150x150'];
  return {
    id: String(raw.id),
    boardId: raw.board_id ?? null,
    title: raw.title || null,
    description: raw.description || null,
    link: raw.link || null,
    imageUrl: img?.url ?? raw.media?.cover_image_url ?? null,
    imageWidth: img?.width ?? null,
    imageHeight: img?.height ?? null,
    dominantColor: raw.dominant_color ?? null,
    createdAt: raw.created_at ?? null,
    isOwner: raw.is_owner ?? true,
  };
}

function mapTokens(raw: RawTokenResponse): PinterestTokens {
  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    expiresIn: raw.expires_in,
    refreshExpiresIn: raw.refresh_token_expires_in ?? null,
    scopes: (raw.scope ?? '').split(/[,\s]+/).filter(Boolean),
  };
}

export class RealPinterestClient implements PinterestClient {
  readonly mock = false;
  private readonly fetch: typeof fetch;

  constructor(
    private readonly cfg: RealClientConfig,
    private readonly session?: TokenSession,
  ) {
    this.fetch = cfg.fetchImpl ?? fetch;
  }

  authorizeUrl(state: string, redirectUri: string): string {
    const url = new URL(PINTEREST_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.cfg.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', PINTEREST_SCOPES.join(','));
    url.searchParams.set('state', state);
    return url.toString();
  }

  private async tokenRequest(params: Record<string, string>): Promise<PinterestTokens> {
    const res = await this.fetch(`${this.cfg.apiBase}/oauth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    });
    if (!res.ok) throw await toApiError(res);
    return mapTokens((await res.json()) as RawTokenResponse);
  }

  exchangeCode(code: string, redirectUri: string): Promise<PinterestTokens> {
    return this.tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
  }

  refreshToken(refreshToken: string): Promise<PinterestTokens> {
    return this.tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });
  }

  revokeToken(_accessToken: string): Promise<boolean> {
    // Pinterest API v5 does not document a token revocation endpoint. Tokens are deleted on our side;
    // users can also remove the app at pinterest.com → Settings → Security → Apps.
    return Promise.resolve(false);
  }

  private requireSession(): TokenSession {
    if (!this.session) throw new Error('This Pinterest client has no token session');
    return this.session;
  }

  private async request(method: string, path: string, query: Record<string, string | undefined> = {}) {
    const url = new URL(`${this.cfg.apiBase}${path}`);
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, v);
    const session = this.requireSession();
    const send = async (token: string) => {
      try {
        return await this.fetch(url, {
          method,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
      } catch (err) {
        throw new PinterestApiError(0, `Network error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    let res = await send(await session.getAccessToken());
    if (res.status === 401) {
      await res.body?.cancel();
      const fresh = await session.refresh();
      if (fresh) res = await send(fresh);
    }
    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as unknown) : null;
  }

  async getUserAccount(): Promise<PinterestAccount> {
    const raw = (await this.request('GET', '/user_account')) as {
      id?: string;
      username: string;
      profile_image?: string;
      account_type?: string;
    };
    return {
      id: raw.id ? String(raw.id) : raw.username,
      username: raw.username,
      profileImage: raw.profile_image ?? null,
      accountType: raw.account_type ?? null,
    };
  }

  async listBoards(bookmark?: string | null): Promise<Page<PinterestBoard>> {
    const raw = (await this.request('GET', '/boards', {
      page_size: String(PAGE_SIZE),
      bookmark: bookmark ?? undefined,
    })) as { items: RawBoard[]; bookmark?: string | null };
    return {
      items: raw.items.map((b) => ({
        id: String(b.id),
        name: b.name,
        description: b.description ?? null,
        privacy: b.privacy ?? null,
        pinCount: b.pin_count ?? null,
      })),
      bookmark: raw.bookmark ?? null,
    };
  }

  async listBoardPins(boardId: string, bookmark?: string | null): Promise<Page<PinterestPin>> {
    const raw = (await this.request('GET', `/boards/${encodeURIComponent(boardId)}/pins`, {
      page_size: String(PAGE_SIZE),
      bookmark: bookmark ?? undefined,
    })) as { items: RawPin[]; bookmark?: string | null };
    return {
      items: raw.items.map((p) => mapPin({ ...p, board_id: p.board_id ?? boardId })),
      bookmark: raw.bookmark ?? null,
    };
  }

  async listPins(bookmark?: string | null): Promise<Page<PinterestPin>> {
    const raw = (await this.request('GET', '/pins', {
      page_size: String(PAGE_SIZE),
      bookmark: bookmark ?? undefined,
    })) as { items: RawPin[]; bookmark?: string | null };
    return { items: raw.items.map(mapPin), bookmark: raw.bookmark ?? null };
  }

  async getPinAnalytics(pinId: string, range: DateRange): Promise<PinAnalytics> {
    const raw = (await this.request('GET', `/pins/${encodeURIComponent(pinId)}/analytics`, {
      start_date: range.startDate,
      end_date: range.endDate,
      metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK',
      app_types: 'ALL',
      split_field: 'NO_SPLIT',
    })) as { all?: { summary_metrics?: Record<string, number> } } | null;
    const m = raw?.all?.summary_metrics ?? {};
    return {
      saves: Math.round(m.SAVE ?? 0),
      clicks: Math.round((m.PIN_CLICK ?? 0) + (m.OUTBOUND_CLICK ?? 0)),
      impressions: Math.round(m.IMPRESSION ?? 0),
    };
  }

  async deletePin(pinId: string): Promise<DeleteOutcome> {
    try {
      await this.request('DELETE', `/pins/${encodeURIComponent(pinId)}`);
      return { status: 204 };
    } catch (err) {
      if (err instanceof PinterestApiError) {
        return { status: err.status, retryAfterMs: err.retryAfterMs, message: err.message };
      }
      return { status: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }
}

async function toApiError(res: Response): Promise<PinterestApiError> {
  let message = `Pinterest API error ${res.status}`;
  let code: number | string | undefined;
  try {
    const body = (await res.json()) as { message?: string; code?: number | string };
    if (body.message) message = body.message;
    code = body.code;
  } catch {
    // non-JSON body
  }
  const retryAfterMs = res.status === 429 ? parseRetryAfterMs(res.headers) : undefined;
  return new PinterestApiError(res.status, message, code, retryAfterMs);
}
