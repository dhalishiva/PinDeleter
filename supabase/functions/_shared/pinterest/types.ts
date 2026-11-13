// Pinterest API v5 client contract (real + mock implementations).

export const PINTEREST_SCOPES = ['boards:read', 'pins:read', 'pins:write', 'user_accounts:read'] as const;
export const PINTEREST_AUTHORIZE_URL = 'https://www.pinterest.com/oauth/';

export interface PinterestTokens {
  accessToken: string;
  refreshToken: string | null;
  /** seconds */
  expiresIn: number;
  /** seconds */
  refreshExpiresIn: number | null;
  scopes: string[];
}

export interface PinterestAccount {
  id: string;
  username: string;
  profileImage: string | null;
  accountType: string | null;
}

export interface PinterestBoard {
  id: string;
  name: string;
  description: string | null;
  privacy: string | null;
  pinCount: number | null;
}

export interface PinterestPin {
  id: string;
  boardId: string | null;
  title: string | null;
  description: string | null;
  link: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  dominantColor: string | null;
  createdAt: string | null;
  isOwner: boolean;
}

export interface Page<T> {
  items: T[];
  bookmark: string | null;
}

export interface PinAnalytics {
  saves: number;
  clicks: number;
  impressions: number;
}

export interface DateRange {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

/** Result of a delete call. Never throws: status 0 = network error. */
export interface DeleteOutcome {
  status: number;
  retryAfterMs?: number;
  message?: string;
}

export class PinterestApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: number | string,
    public readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'PinterestApiError';
  }
}

/** Supplies (and refreshes) the access token for one connection. */
export interface TokenSession {
  getAccessToken(): Promise<string>;
  /** Forces a refresh. Resolves to the new token, or null if the refresh failed (re-auth needed). */
  refresh(): Promise<string | null>;
}

export interface PinterestClient {
  readonly mock: boolean;
  authorizeUrl(state: string, redirectUri: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<PinterestTokens>;
  refreshToken(refreshToken: string): Promise<PinterestTokens>;
  /** Pinterest v5 has no public revoke endpoint; resolves false when nothing could be revoked remotely. */
  revokeToken(accessToken: string): Promise<boolean>;
  getUserAccount(): Promise<PinterestAccount>;
  listBoards(bookmark?: string | null): Promise<Page<PinterestBoard>>;
  listBoardPins(boardId: string, bookmark?: string | null): Promise<Page<PinterestPin>>;
  listPins(bookmark?: string | null): Promise<Page<PinterestPin>>;
  getPinAnalytics(pinId: string, range: DateRange): Promise<PinAnalytics>;
  deletePin(pinId: string): Promise<DeleteOutcome>;
}

export const DEFAULT_RETRY_AFTER_MS = 60_000;

/** Parses Retry-After / X-RateLimit-Reset headers into milliseconds. */
export function parseRetryAfterMs(headers: Headers, now = Date.now()): number {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.max(1000, secs * 1000);
    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.max(1000, date - now);
  }
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset > 0) {
    // Either an epoch timestamp (seconds) or "seconds until reset".
    const ms = reset > 1_000_000_000 ? reset * 1000 - now : reset * 1000;
    if (ms > 0) return Math.min(Math.max(1000, ms), 15 * 60_000);
  }
  return DEFAULT_RETRY_AFTER_MS;
}
