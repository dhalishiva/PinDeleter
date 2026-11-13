import {
  computeActivation,
  computeEntitlement,
  computeRevocation,
  deletionAllowance,
  FREE_DELETION_LIMIT,
  payPalValueToCents,
  PLANS,
} from '../plans.ts';
import { assert, assertEquals } from './assert.ts';

const now = new Date('2026-11-13T00:00:00Z');
const day = 86_400_000;

Deno.test('free user entitlement', () => {
  const e = computeEntitlement({ plan: 'free', plan_expires_at: null, free_deletions_used: 12 }, now);
  assertEquals(e.plan, 'free');
  assertEquals(e.freeDeletionsRemaining, FREE_DELETION_LIMIT - 12);
  assertEquals(e.maxConnections, 1);
  assertEquals(deletionAllowance(e), 38);
});

Deno.test('free deletions never go negative', () => {
  const e = computeEntitlement({ plan: 'free', plan_expires_at: null, free_deletions_used: 80 }, now);
  assertEquals(e.freeDeletionsRemaining, 0);
});

Deno.test('active pass is unlimited, agency allows 5 accounts', () => {
  const exp = new Date(now.getTime() + 5 * day).toISOString();
  const pass = computeEntitlement({ plan: 'pass', plan_expires_at: exp, free_deletions_used: 50 }, now);
  assert(pass.unlimited);
  assertEquals(deletionAllowance(pass), Infinity);
  assertEquals(pass.maxConnections, 1);
  const agency = computeEntitlement({ plan: 'agency', plan_expires_at: exp, free_deletions_used: 0 }, now);
  assertEquals(agency.maxConnections, 5);
});

Deno.test('expired pass falls back to free', () => {
  const e = computeEntitlement(
    { plan: 'agency', plan_expires_at: new Date(now.getTime() - 1).toISOString(), free_deletions_used: 50 },
    now,
  );
  assertEquals(e.plan, 'free');
  assert(!e.unlimited);
  assertEquals(e.maxConnections, 1);
  assertEquals(e.expiresAt, null);
});

Deno.test('buying a pass sets 30 days; buying again extends', () => {
  const first = computeActivation({ plan: 'free', plan_expires_at: null }, 'pass', now);
  assertEquals(first.plan, 'pass');
  assertEquals(new Date(first.plan_expires_at!).getTime(), now.getTime() + 30 * day);
  const second = computeActivation(first, 'pass', now);
  assertEquals(new Date(second.plan_expires_at!).getTime(), now.getTime() + 60 * day);
});

Deno.test('higher tier wins when stacking', () => {
  const agency = computeActivation({ plan: 'free', plan_expires_at: null }, 'agency', now);
  assertEquals(computeActivation(agency, 'pass', now).plan, 'agency');
  const pass = computeActivation({ plan: 'free', plan_expires_at: null }, 'pass', now);
  assertEquals(computeActivation(pass, 'agency', now).plan, 'agency');
});

Deno.test('expired pass is not extended from the past', () => {
  const expired = {
    plan: 'pass' as const,
    plan_expires_at: new Date(now.getTime() - 10 * day).toISOString(),
  };
  const r = computeActivation(expired, 'pass', now);
  assertEquals(new Date(r.plan_expires_at!).getTime(), now.getTime() + 30 * day);
});

Deno.test('refund shortens by 30 days or revokes', () => {
  const twice = { plan: 'pass' as const, plan_expires_at: new Date(now.getTime() + 55 * day).toISOString() };
  const r1 = computeRevocation(twice, now);
  assertEquals(r1.plan, 'pass');
  assertEquals(new Date(r1.plan_expires_at!).getTime(), now.getTime() + 25 * day);
  assertEquals(computeRevocation(r1, now), { plan: 'free', plan_expires_at: null });
});

Deno.test('prices and PayPal amount parsing', () => {
  assertEquals(PLANS.pass.priceCents, 499);
  assertEquals(PLANS.agency.priceCents, 1499);
  assertEquals(payPalValueToCents('4.99'), 499);
  assertEquals(payPalValueToCents('14.9'), 1490);
  assertEquals(payPalValueToCents('15'), 1500);
  assert(Number.isNaN(payPalValueToCents('4.999')));
  assert(Number.isNaN(payPalValueToCents('-1')));
});
