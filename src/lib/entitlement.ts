// Frontend copy of the entitlement rules (UX only — the server enforces them).
import { FREE_DELETION_LIMIT, PLANS, type PlanId } from '@/config/site';
import type { Profile } from './types';

export interface Entitlement {
  plan: PlanId;
  isPaidActive: boolean;
  unlimited: boolean;
  freeDeletionsUsed: number;
  freeDeletionsRemaining: number;
  maxConnections: number;
  expiresAt: string | null;
}

export function entitlementFor(
  profile: Pick<Profile, 'plan' | 'plan_expires_at' | 'free_deletions_used'>,
  now = Date.now(),
): Entitlement {
  const expires = profile.plan_expires_at ? new Date(profile.plan_expires_at).getTime() : null;
  const isPaidActive = profile.plan !== 'free' && expires !== null && expires > now;
  const plan: PlanId = isPaidActive ? profile.plan : 'free';
  const used = Math.max(0, profile.free_deletions_used);
  return {
    plan,
    isPaidActive,
    unlimited: isPaidActive,
    freeDeletionsUsed: used,
    freeDeletionsRemaining: Math.max(0, FREE_DELETION_LIMIT - used),
    maxConnections: PLANS[plan].maxConnections,
    expiresAt: isPaidActive ? profile.plan_expires_at : null,
  };
}
