// Pin dashboard filters: URL search params <-> UI state <-> RPC payload for list_pins / select_pin_ids.

export type AgeFilter = 'any' | '6m' | '1y' | '3y' | 'custom';
export type OwnerFilter = 'all' | 'created' | 'saved';
export type SortOrder = 'newest' | 'oldest' | 'engagement';

export interface PinFilterState {
  q: string;
  boards: string[];
  age: AgeFilter;
  from: string | null;
  to: string | null;
  noEngagement: boolean;
  owner: OwnerFilter;
  sort: SortOrder;
}

export const DEFAULT_FILTERS: PinFilterState = {
  q: '',
  boards: [],
  age: 'any',
  from: null,
  to: null,
  noEngagement: false,
  owner: 'all',
  sort: 'newest',
};

/** Payload understood by public.pin_search (see migrations). */
export interface PinQuery {
  q?: string;
  boards?: string[];
  createdFrom?: string;
  createdTo?: string;
  noEngagement?: boolean;
  owner?: 'created' | 'saved';
  sort: SortOrder;
}

const AGES: AgeFilter[] = ['any', '6m', '1y', '3y', 'custom'];
const OWNERS: OwnerFilter[] = ['all', 'created', 'saved'];
const SORTS: SortOrder[] = ['newest', 'oldest', 'engagement'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseFilters(params: URLSearchParams): PinFilterState {
  const from = params.get('from');
  const to = params.get('to');
  return {
    q: (params.get('q') ?? '').slice(0, 200),
    boards: (params.get('boards') ?? '')
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 100),
    age: pick(params.get('age'), AGES, 'any'),
    from: from && DATE_RE.test(from) ? from : null,
    to: to && DATE_RE.test(to) ? to : null,
    noEngagement: params.get('noeng') === '1',
    owner: pick(params.get('owner'), OWNERS, 'all'),
    sort: pick(params.get('sort'), SORTS, 'newest'),
  };
}

/** Writes filters into URL params, omitting defaults. Other params (e.g. connection) are preserved. */
export function writeFilters(base: URLSearchParams, f: PinFilterState): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (key: string, value: string | null, isDefault: boolean) => {
    if (isDefault || value === null || value === '') p.delete(key);
    else p.set(key, value);
  };
  set('q', f.q.trim(), !f.q.trim());
  set('boards', f.boards.join(','), f.boards.length === 0);
  set('age', f.age, f.age === 'any');
  set('from', f.from, f.age !== 'custom');
  set('to', f.to, f.age !== 'custom');
  set('noeng', '1', !f.noEngagement);
  set('owner', f.owner, f.owner === 'all');
  set('sort', f.sort, f.sort === 'newest');
  return p;
}

function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function nextDay(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export function buildPinQuery(f: PinFilterState, now: Date = new Date()): PinQuery {
  const q: PinQuery = { sort: f.sort };
  const text = f.q.trim();
  if (text) q.q = text;
  if (f.boards.length) q.boards = [...f.boards];
  if (f.age === '6m') q.createdTo = monthsAgo(now, 6).toISOString();
  if (f.age === '1y') q.createdTo = monthsAgo(now, 12).toISOString();
  if (f.age === '3y') q.createdTo = monthsAgo(now, 36).toISOString();
  if (f.age === 'custom') {
    if (f.from) q.createdFrom = `${f.from}T00:00:00.000Z`;
    if (f.to) q.createdTo = nextDay(f.to);
  }
  if (f.noEngagement) q.noEngagement = true;
  if (f.owner !== 'all') q.owner = f.owner;
  return q;
}

export function activeFilterCount(f: PinFilterState): number {
  return (
    (f.q.trim() ? 1 : 0) +
    (f.boards.length ? 1 : 0) +
    (f.age !== 'any' ? 1 : 0) +
    (f.noEngagement ? 1 : 0) +
    (f.owner !== 'all' ? 1 : 0)
  );
}

export const AGE_LABELS: Record<AgeFilter, string> = {
  any: 'Any date',
  '6m': 'Older than 6 months',
  '1y': 'Older than 1 year',
  '3y': 'Older than 3 years',
  custom: 'Custom range',
};

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  engagement: 'Lowest engagement',
};

export const OWNER_LABELS: Record<OwnerFilter, string> = {
  all: 'All pins',
  created: 'Created by me',
  saved: 'Saved from others',
};
