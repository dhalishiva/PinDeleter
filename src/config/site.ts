// Single source of truth for business details, plans and limits.
// Plans are mirrored in supabase/functions/_shared/plans.ts (a test checks they match).

export const SITE = {
  name: 'PinDeleter',
  byline: 'by Kriosity',
  fullName: 'PinDeleter by Kriosity',
  url: 'https://pindeleter.kriosity.in',
  tagline: 'Bulk-delete your Pinterest pins — safely.',
  description:
    'Bulk-delete your own Pinterest pins with board, date and engagement filters, an automatic backup and a dry run. Rate-limit safe, resumable, 50 pins free.',
  operator: 'Kriosity',
  operatorUrl: 'https://kriosity.in',
  proprietor: 'Shiva Dhali',
  address: {
    line1: '42-A / BLK-S.K. EWS, Sector 66',
    city: 'Noida',
    district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    postalCode: '201301',
    country: 'India',
  },
  supportEmail: 'support@kriosity.in',
  grievanceOfficer: { name: 'Shiva Dhali', email: 'support@kriosity.in' },
  jurisdiction: 'courts at Gautam Buddha Nagar (Noida), Uttar Pradesh, India',
  /** Effective date for all legal pages (build date). */
  legalEffectiveDate: '13 November 2026',
  disclaimer:
    'PinDeleter is an independent product by Kriosity and is not affiliated with, endorsed by or sponsored by Pinterest, Inc. Pinterest is a trademark of Pinterest, Inc.',
} as const;

export const fullAddress = () => {
  const a = SITE.address;
  return `${a.line1}, ${a.city}, ${a.district}, ${a.state} ${a.postalCode}, ${a.country}`;
};

export type PlanId = 'free' | 'pass' | 'agency';
export type PaidPlanId = Exclude<PlanId, 'free'>;

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceCents: number;
  durationDays: number | null;
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

export interface PlanMarketing {
  tagline: string;
  cta: string;
  highlight?: string;
  bullets: string[];
}

export const PLAN_MARKETING: Record<PlanId, PlanMarketing> = {
  free: {
    tagline: 'Try it on a real cleanup.',
    cta: 'Get started free',
    bullets: [
      `${FREE_DELETION_LIMIT} successful deletions, forever`,
      '1 Pinterest account',
      'All filters, backup & dry run',
      'Failed deletions never count',
    ],
  },
  pass: {
    tagline: 'Clear out years of pins in one go.',
    cta: 'Get the Cleanup Pass',
    highlight: 'Most popular',
    bullets: [
      'Unlimited deletions for 30 days',
      '1 Pinterest account',
      'Everything in Free',
      'One-time payment, no auto-renewal',
    ],
  },
  agency: {
    tagline: 'For brands, agencies and multi-account pinners.',
    cta: 'Get Agency',
    bullets: [
      'Unlimited deletions for 30 days',
      'Up to 5 Pinterest accounts',
      'Everything in Free',
      'One-time payment, no auto-renewal',
    ],
  },
};

export const LIMITS = {
  selectAllCap: 10_000,
  pageSize: 60,
  searchDebounceMs: 250,
  jobEventsShown: 100,
} as const;

export function formatPrice(cents: number): string {
  return cents === 0 ? '$0' : `$${(cents / 100).toFixed(2)}`;
}
