// Deterministic mock Pinterest client (PINTEREST_MOCK=true).
// Lets the whole product work end-to-end before Pinterest approves the app.
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
  PINTEREST_SCOPES,
  type TokenSession,
} from './types.ts';

/** Remembers demo deletions so they survive re-syncs. */
export interface MockStore {
  deletedIds(accountId: string): Promise<Set<string>>;
  markDeleted(accountId: string, pinId: string): Promise<void>;
}

export class MemoryMockStore implements MockStore {
  private readonly map = new Map<string, Set<string>>();
  deletedIds(accountId: string) {
    return Promise.resolve(new Set(this.map.get(accountId) ?? []));
  }
  markDeleted(accountId: string, pinId: string) {
    const set = this.map.get(accountId) ?? new Set<string>();
    set.add(pinId);
    this.map.set(accountId, set);
    return Promise.resolve();
  }
}

export interface MockOptions {
  store: MockStore;
  session?: TokenSession;
  /** Random source in [0,1). Inject a seeded one for tests. */
  random?: () => number;
  /** Simulated latency for deletePin. Set to [0,0] in tests. */
  latencyMs?: [number, number];
  pageSize?: number;
}

const ACCESS_PREFIX = 'mock_access.';
const REFRESH_PREFIX = 'mock_refresh.';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BOARD_NAMES = [
  'Dream Kitchen',
  'Travel Bucket List',
  'Wedding Ideas 2019',
  'DIY & Crafts',
  'Outfit Inspo',
  'Old Blog Graphics',
  'Garden Goals',
  'Recipes to Try',
];
const EMOJI = [
  '🍋',
  '🌸',
  '🏝️',
  '🧁',
  '🪴',
  '👗',
  '🎨',
  '🍜',
  '✈️',
  '🕯️',
  '🧶',
  '🌈',
  '🍓',
  '🏡',
  '📸',
  '🥑',
];
const GRADIENTS: [string, string][] = [
  ['#FF3D7F', '#FFC83D'],
  ['#7C5CFF', '#3BA7FF'],
  ['#12C2A8', '#FFC83D'],
  ['#FF8A3D', '#FF3D7F'],
  ['#3BA7FF', '#12C2A8'],
  ['#FFC83D', '#FF8A3D'],
  ['#7C5CFF', '#FF3D7F'],
  ['#12C2A8', '#3BA7FF'],
];
const WORDS = [
  'Cozy',
  'Minimal',
  'Summer',
  'Easy',
  'Bold',
  'Pastel',
  'Weekend',
  'Vintage',
  'Rainbow',
  'Quick',
  'Boho',
  'Modern',
];
const NOUNS = [
  'lemon tart',
  'reading nook',
  'beach escape',
  'cupcake ideas',
  'balcony garden',
  'capsule wardrobe',
  'watercolor tips',
  'ramen night',
  'road trip',
  'candle making',
  'knit blanket',
  'party palette',
];
const DOMAINS = [
  'example-blog.com',
  'shop.example.net',
  'recipes.example.org',
  'travelnotes.example.com',
  null,
];

function svgImage(seed: number, emoji: string, width: number, height: number): string {
  const [a, b] = GRADIENTS[seed % GRADIENTS.length]!;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/>` +
    `<stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="100%" height="100%" fill="url(#g)"/>` +
    `<circle cx="${width * 0.8}" cy="${height * 0.18}" r="${width * 0.22}" fill="#fff" fill-opacity=".18"/>` +
    `<text x="50%" y="54%" font-size="${Math.round(width / 3.2)}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

interface Dataset {
  account: PinterestAccount;
  boards: PinterestBoard[];
  pins: PinterestPin[];
  engagement: Map<string, PinAnalytics>;
}

const datasetCache = new Map<string, Dataset>();
const ANCHOR = Date.UTC(2026, 9, 1); // 2026-10-01, keeps dates stable
const SEVEN_YEARS_MS = 7 * 365 * 24 * 3600 * 1000;

export function buildDataset(accountId: string): Dataset {
  const cached = datasetCache.get(accountId);
  if (cached) return cached;
  const rand = mulberry32(hashString(accountId));
  const suffix = accountId.replace(/^mock-/, '').slice(0, 4) || 'demo';
  const account: PinterestAccount = {
    id: accountId,
    username: `demo_pinner_${suffix}`,
    profileImage: svgImage(hashString(accountId), '😊', 120, 120),
    accountType: 'BUSINESS',
  };
  const boards: PinterestBoard[] = BOARD_NAMES.map((name, i) => ({
    id: `${accountId}-board-${i + 1}`,
    name,
    description: `Demo board: ${name}`,
    privacy: i === 5 ? 'SECRET' : 'PUBLIC',
    pinCount: 0,
  }));
  const pins: PinterestPin[] = [];
  const engagement = new Map<string, PinAnalytics>();
  const total = 300;
  for (let i = 0; i < total; i++) {
    const board = boards[Math.floor(rand() * boards.length)]!;
    const word = WORDS[Math.floor(rand() * WORDS.length)]!;
    const noun = NOUNS[Math.floor(rand() * NOUNS.length)]!;
    const emoji = EMOJI[Math.floor(rand() * EMOJI.length)]!;
    const width = 400;
    const height = Math.round(width * (0.8 + rand() * 0.85));
    const domain = DOMAINS[Math.floor(rand() * DOMAINS.length)];
    const created = new Date(ANCHOR - Math.floor(rand() * SEVEN_YEARS_MS));
    const id = `${accountId}-pin-${String(i + 1).padStart(4, '0')}`;
    pins.push({
      id,
      boardId: board.id,
      title: `${word} ${noun}`,
      description: rand() > 0.3 ? `Saved for later: ${word.toLowerCase()} ${noun} inspiration.` : null,
      link: domain ? `https://${domain}/${noun.replace(/\s+/g, '-')}-${i + 1}` : null,
      imageUrl: svgImage(i, emoji, width, height),
      imageWidth: width,
      imageHeight: height,
      dominantColor: GRADIENTS[i % GRADIENTS.length]![0],
      createdAt: created.toISOString(),
      isOwner: rand() < 0.6,
    });
    board.pinCount = (board.pinCount ?? 0) + 1;
    const zero = rand() < 0.4;
    engagement.set(
      id,
      zero
        ? { saves: 0, clicks: 0, impressions: Math.floor(rand() * 20) }
        : {
            saves: 1 + Math.floor(rand() * 80),
            clicks: Math.floor(rand() * 40),
            impressions: 50 + Math.floor(rand() * 4000),
          },
    );
  }
  pins.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  const ds = { account, boards, pins, engagement };
  datasetCache.set(accountId, ds);
  return ds;
}

export function mockTokensFor(accountId: string): PinterestTokens {
  return {
    accessToken: `${ACCESS_PREFIX}${accountId}`,
    refreshToken: `${REFRESH_PREFIX}${accountId}`,
    expiresIn: 30 * 24 * 3600,
    refreshExpiresIn: 60 * 24 * 3600,
    scopes: [...PINTEREST_SCOPES],
  };
}

export class MockPinterestClient implements PinterestClient {
  readonly mock = true;
  private readonly random: () => number;
  private readonly latency: [number, number];
  private readonly pageSize: number;

  constructor(private readonly opts: MockOptions) {
    this.random = opts.random ?? Math.random;
    this.latency = opts.latencyMs ?? [120, 300];
    this.pageSize = opts.pageSize ?? 100;
  }

  authorizeUrl(state: string, redirectUri: string): string {
    const code = `mock_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const url = new URL(redirectUri);
    url.searchParams.set('code', code);
    url.searchParams.set('state', state);
    return url.toString();
  }

  exchangeCode(code: string, _redirectUri: string): Promise<PinterestTokens> {
    const match = code.match(/^mock_([a-z0-9]{4,32})$/i);
    if (!match) return Promise.reject(new PinterestApiError(400, 'Invalid mock authorization code'));
    return Promise.resolve(mockTokensFor(`mock-${match[1]!.toLowerCase()}`));
  }

  refreshToken(refreshToken: string): Promise<PinterestTokens> {
    if (!refreshToken.startsWith(REFRESH_PREFIX)) {
      return Promise.reject(new PinterestApiError(401, 'Invalid mock refresh token'));
    }
    return Promise.resolve(mockTokensFor(refreshToken.slice(REFRESH_PREFIX.length)));
  }

  revokeToken(_accessToken: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  private async accountId(): Promise<string> {
    if (!this.opts.session) throw new Error('Mock client has no token session');
    const token = await this.opts.session.getAccessToken();
    if (!token.startsWith(ACCESS_PREFIX)) throw new PinterestApiError(401, 'Invalid mock access token', 2);
    return token.slice(ACCESS_PREFIX.length);
  }

  private paginate<T>(items: T[], bookmark?: string | null): Page<T> {
    const start = bookmark ? Number(bookmark) || 0 : 0;
    const slice = items.slice(start, start + this.pageSize);
    const next = start + this.pageSize < items.length ? String(start + this.pageSize) : null;
    return { items: slice, bookmark: next };
  }

  async getUserAccount(): Promise<PinterestAccount> {
    return buildDataset(await this.accountId()).account;
  }

  async listBoards(bookmark?: string | null): Promise<Page<PinterestBoard>> {
    return this.paginate(buildDataset(await this.accountId()).boards, bookmark);
  }

  private async livePins(): Promise<PinterestPin[]> {
    const id = await this.accountId();
    const deleted = await this.opts.store.deletedIds(id);
    return buildDataset(id).pins.filter((p) => !deleted.has(p.id));
  }

  async listBoardPins(boardId: string, bookmark?: string | null): Promise<Page<PinterestPin>> {
    const pins = (await this.livePins()).filter((p) => p.boardId === boardId);
    return this.paginate(pins, bookmark);
  }

  async listPins(bookmark?: string | null): Promise<Page<PinterestPin>> {
    return this.paginate(await this.livePins(), bookmark);
  }

  async getPinAnalytics(pinId: string, _range: DateRange): Promise<PinAnalytics> {
    const ds = buildDataset(await this.accountId());
    const stats = ds.engagement.get(pinId);
    if (!stats) throw new PinterestApiError(404, 'Pin not found');
    return stats;
  }

  async deletePin(pinId: string): Promise<DeleteOutcome> {
    try {
      return await this.deletePinInner(pinId);
    } catch (err) {
      if (err instanceof PinterestApiError) return { status: err.status, message: err.message };
      return { status: 0, message: err instanceof Error ? err.message : String(err) };
    }
  }

  private async deletePinInner(pinId: string): Promise<DeleteOutcome> {
    const [min, max] = this.latency;
    if (max > 0) await new Promise((r) => setTimeout(r, min + Math.floor(this.random() * (max - min))));
    const id = await this.accountId();
    const deleted = await this.opts.store.deletedIds(id);
    const exists = buildDataset(id).pins.some((p) => p.id === pinId);
    if (!exists || deleted.has(pinId)) return { status: 404, message: 'Pin not found' };
    const roll = this.random();
    if (roll < 0.04) return { status: 429, retryAfterMs: 2000, message: 'Rate limited (mock)' };
    if (roll < 0.055) return { status: 500, message: 'Internal error (mock)' };
    if (roll < 0.065) return { status: 404, message: 'Pin not found (mock)' };
    await this.opts.store.markDeleted(id, pinId);
    return { status: 204 };
  }
}
