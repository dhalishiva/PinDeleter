import { describe, expect, it } from 'vitest';
import { activeFilterCount, buildPinQuery, DEFAULT_FILTERS, parseFilters, writeFilters } from './pinFilters';

const NOW = new Date('2026-11-13T00:00:00.000Z');

describe('filter → query builder', () => {
  it('defaults to newest with no constraints', () => {
    expect(buildPinQuery(DEFAULT_FILTERS, NOW)).toEqual({ sort: 'newest' });
  });

  it('maps "older than" presets to createdTo', () => {
    expect(buildPinQuery({ ...DEFAULT_FILTERS, age: '6m' }, NOW).createdTo).toBe('2026-05-13T00:00:00.000Z');
    expect(buildPinQuery({ ...DEFAULT_FILTERS, age: '1y' }, NOW).createdTo).toBe('2025-11-13T00:00:00.000Z');
    expect(buildPinQuery({ ...DEFAULT_FILTERS, age: '3y' }, NOW).createdTo).toBe('2023-11-13T00:00:00.000Z');
  });

  it('maps a custom range to an inclusive start and exclusive next-day end', () => {
    const q = buildPinQuery({ ...DEFAULT_FILTERS, age: 'custom', from: '2019-01-01', to: '2019-12-31' }, NOW);
    expect(q.createdFrom).toBe('2019-01-01T00:00:00.000Z');
    expect(q.createdTo).toBe('2020-01-01T00:00:00.000Z');
  });

  it('ignores custom dates unless the custom preset is selected', () => {
    const q = buildPinQuery({ ...DEFAULT_FILTERS, age: 'any', from: '2019-01-01', to: '2019-12-31' }, NOW);
    expect(q.createdFrom).toBeUndefined();
    expect(q.createdTo).toBeUndefined();
  });

  it('trims search text and passes boards, engagement, owner and sort', () => {
    const q = buildPinQuery(
      {
        ...DEFAULT_FILTERS,
        q: '  wedding  ',
        boards: ['b1', 'b2'],
        noEngagement: true,
        owner: 'saved',
        sort: 'engagement',
      },
      NOW,
    );
    expect(q).toEqual({
      q: 'wedding',
      boards: ['b1', 'b2'],
      noEngagement: true,
      owner: 'saved',
      sort: 'engagement',
    });
  });

  it('omits "all" owner and empty search', () => {
    const q = buildPinQuery({ ...DEFAULT_FILTERS, q: '   ', owner: 'all' }, NOW);
    expect(q).toEqual({ sort: 'newest' });
  });
});

describe('URL params', () => {
  it('round-trips through search params and keeps unrelated params', () => {
    const state = {
      ...DEFAULT_FILTERS,
      q: 'tart',
      boards: ['b1', 'b2'],
      age: 'custom' as const,
      from: '2020-01-01',
      to: '2020-02-01',
      noEngagement: true,
      owner: 'created' as const,
      sort: 'oldest' as const,
    };
    const params = writeFilters(new URLSearchParams('connection=abc'), state);
    expect(params.get('connection')).toBe('abc');
    expect(parseFilters(params)).toEqual(state);
  });

  it('omits defaults from the URL', () => {
    expect(writeFilters(new URLSearchParams(), DEFAULT_FILTERS).toString()).toBe('');
  });

  it('rejects invalid values', () => {
    const f = parseFilters(new URLSearchParams('age=forever&sort=random&owner=x&from=yesterday&noeng=yes'));
    expect(f.age).toBe('any');
    expect(f.sort).toBe('newest');
    expect(f.owner).toBe('all');
    expect(f.from).toBeNull();
    expect(f.noEngagement).toBe(false);
  });

  it('counts active filters', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, q: 'x', age: '1y', noEngagement: true })).toBe(3);
  });
});
