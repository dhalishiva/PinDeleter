// Plan definitions and entitlement logic.
// Mirrors src/config/site.ts (a Vitest test asserts the two stay identical).
// This file must stay dependency-free: it is imported by both Deno (Edge Functions) and Vite (frontend tests).

export type PlanId = 'free' | 'pass' | 'agency';
export type PaidPlanId = Exclude<PlanId, 'free'>;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number;
  durationDays: number | null;
  /** null = unlimited */
  deletionLimit: number | null;
  maxConnections: number;
}

export const FREE_DELETION_LIMIT = 50;
export const PASS_DURATION_DAYS = 30;
export const CURRENCY = 'USD';

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    durationDays: null,
    deletionLimit: FREE_DELETION_LIMIT,
    maxConnections: 1,
  },
  pass: {
    id: 'pass',
    name: 'Cleanup Pass',
    priceCents: 499,
    durationDays: PASS_DURATION_DAYS,
    deletionLimit: null,
    maxConnections: 1,
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    priceCents: 1499,
    durationDays: PASS_DURATION_DAYS,
    deletionLimit: null,
    maxConnections: 5,
  },
};

export const PAID_PLAN_IDS: readonly PaidPlanId[] = ['pass', 'agency'];

export function isPaidPlan(value: unknown): value is PaidPlanId {
  return value === 'pass' || value === 'agency';
}

const TIER_RANK: Record<PlanId, number> = { free: 0, pass: 1, agency: 2 };
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProfilePlanState {
  plan: PlanId;
  plan_expires_at: string | null;
  free_deletions_used: number;
}

export interface Entitlement {
  /** Effective plan (an expired paid plan counts as free). */
  plan: PlanId;
  isPaidActive: boolean;
  unlimited: boolean;
  freeDeletionsUsed: number;
  freeDeletionsRemaining: number;
  maxConnections: number;
  expiresAt: string | null;
}

export function computeEntitlement(profile: ProfilePlanState, now: Date = new Date()): Entitlement {
  const expires = profile.plan_expires_at ? new Date(profile.plan_expires_at) : null;
  const isPaidActive = profile.plan !== 'free' && expires !== null && expires.getTime() > now.getTime();
  const plan: PlanId = isPaidActive ? profile.plan : 'free';
  const used = Math.max(0, profile.free_deletions_used);
  return {
    plan,
    isPaidActive,
    unlimited: isPaidActive,
    freeDeletionsUsed: used,
    freeDeletionsRemaining: Math.max(0, FREE_DELETION_LIMIT - used),
    maxConnections: PLANS[plan].maxConnections,
    expiresAt: isPaidActive && expires ? expires.toISOString() : null,
  };
}

/** How many deletions may be queued right now (Infinity for active paid plans). */
export function deletionAllowance(ent: Entitlement): number {
  return ent.unlimited ? Number.POSITIVE_INFINITY : ent.freeDeletionsRemaining;
}

export interface PlanChange {
  plan: PlanId;
  plan_expires_at: string | null;
}

/**
 * Applies a purchase. Buying while a pass is active extends it by 30 days; the higher tier wins.
 */
export function computeActivation(
  current: Pick<ProfilePlanState, 'plan' | 'plan_expires_at'>,
  purchased: PaidPlanId,
  now: Date = new Date(),
): PlanChange {
  const expires = current.plan_expires_at ? new Date(current.plan_expires_at) : null;
  const active = current.plan !== 'free' && expires !== null && expires.getTime() > now.getTime();
  const base = active && expires ? expires.getTime() : now.getTime();
  const plan: PlanId = active && TIER_RANK[current.plan] > TIER_RANK[purchased] ? current.plan : purchased;
  return { plan, plan_expires_at: new Date(base + PASS_DURATION_DAYS * DAY_MS).toISOString() };
}

/** Reverses one purchase (refund / reversal): removes 30 days; falls back to free if nothing remains. */
export function computeRevocation(
  current: Pick<ProfilePlanState, 'plan' | 'plan_expires_at'>,
  now: Date = new Date(),
): PlanChange {
  if (current.plan === 'free' || !current.plan_expires_at) return { plan: 'free', plan_expires_at: null };
  const shortened = new Date(current.plan_expires_at).getTime() - PASS_DURATION_DAYS * DAY_MS;
  if (shortened <= now.getTime()) return { plan: 'free', plan_expires_at: null };
  return { plan: current.plan, plan_expires_at: new Date(shortened).toISOString() };
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** PayPal amounts are decimal strings, e.g. "4.99". */
export function centsToPayPalValue(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function payPalValueToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [whole, frac = ''] = value.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}
