import { describe, expect, it } from 'vitest';
import * as shared from '../../supabase/functions/_shared/plans.ts';
import { FREE_DELETION_LIMIT, PASS_DURATION_DAYS, PLANS, SITE } from './site';

describe('plan definitions', () => {
  it('frontend plans mirror the server plans exactly', () => {
    expect(PLANS).toEqual(shared.PLANS);
    expect(FREE_DELETION_LIMIT).toBe(shared.FREE_DELETION_LIMIT);
    expect(PASS_DURATION_DAYS).toBe(shared.PASS_DURATION_DAYS);
  });

  it('matches the published price list', () => {
    expect(PLANS.free).toMatchObject({ priceCents: 0, deletionLimit: 50, maxConnections: 1 });
    expect(PLANS.pass).toMatchObject({
      priceCents: 499,
      durationDays: 30,
      deletionLimit: null,
      maxConnections: 1,
    });
    expect(PLANS.agency).toMatchObject({
      priceCents: 1499,
      durationDays: 30,
      deletionLimit: null,
      maxConnections: 5,
    });
  });

  it('keeps the non-affiliation disclaimer', () => {
    expect(SITE.disclaimer).toContain('not affiliated with, endorsed by or sponsored by Pinterest, Inc.');
  });
});
