// Public app configuration for the frontend.
import { boolEnv, optionalEnv } from '../_shared/env.ts';
import { handler, json } from '../_shared/http.ts';
import { FREE_DELETION_LIMIT, PLANS } from '../_shared/plans.ts';

Deno.serve(
  handler({ name: 'config', methods: ['GET'] }, (req) =>
    Promise.resolve(
      json(
        req,
        {
          mockMode: boolEnv('PINTEREST_MOCK', false),
          plans: PLANS,
          freeLimit: FREE_DELETION_LIMIT,
          paypalClientId: optionalEnv('PAYPAL_CLIENT_ID') ?? null,
          paypalEnv: optionalEnv('PAYPAL_ENV') === 'live' ? 'live' : 'sandbox',
        },
        200,
        { 'Cache-Control': 'public, max-age=60' },
      ),
    ),
  ),
);
