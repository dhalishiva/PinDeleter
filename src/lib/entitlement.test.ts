import { describe, expect, it } from 'vitest';
import { entitlementFor } from './entitlement';
import { computeEntitlement } from '../../supabase/functions/_shared/plans.ts';

const now = Date.parse('2026-11-13T00:00:00Z');
const cases = [
  { plan: 'free' as const, plan_expires_at: null, free_deletions_used: 0 },
  { plan: 'free' as const, plan_expires_at: null, free_deletions_used: 70 },
  { plan: 'pass' as const, plan_expires_at: '2026-12-01T00:00:00Z', free_deletions_used: 10 },
  { plan: 'agency' as const, plan_expires_at: '2026-12-01T00:00:00Z', free_deletions_used: 50 },
  { plan: 'agency' as const, plan_expires_at: '2026-11-01T00:00:00Z', free_deletions_used: 5 },
];

describe('frontend entitlement (UX) matches server entitlement', () => {
  it.each(cases)('%o', (profile) => {
    const ui = entitlementFor(profile, now);
    const server = computeEntitlement(profile, new Date(now));
    expect(ui.plan).toBe(server.plan);
    expect(ui.unlimited).toBe(server.unlimited);
    expect(ui.freeDeletionsRemaining).toBe(server.freeDeletionsRemaining);
    expect(ui.maxConnections).toBe(server.maxConnections);
  });
});
