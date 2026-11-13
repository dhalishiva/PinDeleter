# PinDeleter by Kriosity

Bulk-delete your own Pinterest pins safely — filters, automatic backup, dry run, and rate-limit-safe, resumable server-side jobs.
Production: <https://pindeleter.kriosity.in>. **Owner setup: see [SETUP.md](SETUP.md).**

> PinDeleter is an independent product by Kriosity and is not affiliated with, endorsed by or sponsored by Pinterest, Inc.

## Stack

- **Web**: Vite + React 18 + TypeScript (strict), Tailwind, React Router 6, TanStack Query (+ Virtual), Zustand, framer-motion, react-hook-form + zod, react-helmet-async, PayPal JS SDK.
- **Backend**: Supabase — Postgres + RLS, Auth (magic link + Google), Realtime, Edge Functions (Deno), `pg_cron` + `pg_net`, Vault.
- **Payments**: PayPal Orders v2 + webhooks (USD, one-time 30-day passes). **Email**: Resend. **Hosting**: Vercel.

## Layout

```
src/config/site.ts          business details, plans, limits (single source of truth)
src/lib                     supabase client, edge-function wrapper, backup CSV/JSON, filter→query builder, formatters
src/components              Button, Modal, Toaster, Logo, illustrations, UI primitives, marketing blocks
src/features                auth, connections, pins (grid/filters), jobs, billing (PayPal), settings
src/pages/{marketing,legal,auth,app}
supabase/migrations         schema, RLS + grants, RPCs, realtime + cron
supabase/functions/_shared  pinterest (real + mock), crypto (AES-GCM), paypal, payments, jobs processor, sync, emails, plans
supabase/functions/<name>   17 Edge Functions
scripts/generate-assets.mjs favicon / ico / apple-touch / og-image generator
```

## Commands

|                                                                         |                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                                                           | Vite dev server on :5173                                      |
| `npm run typecheck` / `npm run lint` / `npm run test` / `npm run build` | quality gates                                                 |
| `npm run test:functions`                                                | Deno unit tests for `supabase/functions/_shared` (needs Deno) |
| `npm run check:functions`                                               | Deno type-check of every Edge Function                        |
| `npm run assets`                                                        | regenerate icons and OG image into `public/`                  |

## How it works

- **Pinterest OAuth** (`pinterest-oauth-start` → Pinterest → `/app/connect/pinterest/callback` → `pinterest-oauth-callback`). States are single-use, user-bound, 10-minute. Pinterest v5 doesn't support PKCE or token revocation, so tokens are deleted locally on disconnect. Tokens are AES-256-GCM encrypted (`TOKEN_ENCRYPTION_KEY`) and token columns are not granted to clients (`pinterest_connections_public` view).
- **Sync** runs in ~40 s steps and stores a `{phase, board_index, bookmark}` cursor; `sync-worker` (cron, every minute) continues it. Finishing a sync marks pins Pinterest no longer returns as `deleted`.
- **Pins dashboard** uses the `list_pins` RPC (keyset pagination on a sort key), `count_pins`, `board_pin_counts` and `select_pin_ids` (≤10,000). Filters live in the URL. The masonry grid is virtualised.
- **Jobs**: `jobs-create` validates ownership + entitlement and creates items with backup snapshot columns; `jobs-worker` claims jobs with `FOR UPDATE SKIP LOCKED` + a 60 s lease, deletes at `DELETE_RPS`, handles 204/404/429/401/5xx (see `_shared/jobs/processor.ts`), charges free users only for successful deletions, and streams progress via Realtime (`delete_jobs`, `job_events`).
- **Payments**: `paypal-create-order` (server-side price, `custom_id` = payment row) → buyer approves → `paypal-capture-order` (idempotent `PayPal-Request-Id`, amount/currency check) activates immediately. `paypal-webhook` verifies signatures with PayPal's API, is idempotent by event ID, and is the safety net (capture completed / order approved / denied / refunded / reversed).
- **Demo mode** (`PINTEREST_MOCK=true`): deterministic mock with 8 boards and 300 pins over 7 years; deletions persist in `mock_deleted_pins`; random 429/500/404 responses exercise the job engine. The app shows a "Demo mode" badge.

## Testing

- Vitest: backup CSV/JSON, filter→query builder and URL round-trip, plan parity between frontend and server, entitlement parity, components (Modal, SelectionBar, FAQ, Logo).
- Deno: AES-GCM round-trip/tamper, plans/entitlement/activation/refund maths, PayPal capture checks + webhook handling (mocked verify), the job processor against the mock Pinterest client (204/404/429/401/5xx, free-limit, pause, time budget), real client OAuth/refresh/429 parsing.
