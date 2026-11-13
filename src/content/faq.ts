import { FREE_DELETION_LIMIT } from '@/config/site';

export interface FaqItem {
  q: string;
  a: string;
  category: 'general' | 'safety' | 'billing' | 'privacy';
}

export const FAQ: FaqItem[] = [
  {
    category: 'general',
    q: 'What does PinDeleter do?',
    a: 'PinDeleter lets you bulk-delete pins from your own Pinterest account. You connect your account through Pinterest’s official sign-in, we sync your boards and pins, you filter and select what to remove, download a backup, and our servers delete the pins for you — safely, at a pace Pinterest allows, with live progress.',
  },
  {
    category: 'safety',
    q: 'Do you need my Pinterest password?',
    a: 'No. You sign in on Pinterest’s own page and approve access using Pinterest’s official OAuth. We never see or store your password. You can disconnect at any time from the Accounts page, which deletes the access tokens we hold.',
  },
  {
    category: 'safety',
    q: 'Can deleted pins be recovered?',
    a: 'No. Deleting a pin on Pinterest is permanent and Pinterest has no undo. That’s why PinDeleter makes you download a backup (JSON and CSV with titles, links, boards, image URLs and dates) and type DELETE before a real run, and offers a dry run that changes nothing.',
  },
  {
    category: 'general',
    q: 'What is a dry run?',
    a: 'A dry run goes through the full job flow with your selection and produces a report of exactly which pins would be deleted — without touching Pinterest. It’s a free way to double-check your filters before the real thing.',
  },
  {
    category: 'general',
    q: 'How do I find pins nobody engages with?',
    a: 'Turn on the “No engagement” filter. For accurate results, load engagement stats first (saves and clicks from the last 90 days, fetched from Pinterest per board). Pins with zero saves and zero clicks are then shown so you can review and remove them.',
  },
  {
    category: 'general',
    q: 'How fast is it, and what about Pinterest’s rate limits?',
    a: 'Deletions run on our servers at a careful pace (a few per second). If Pinterest asks us to slow down, the job pauses automatically and resumes on its own — you’ll see “rate-limited until …” on the job page. You can close the tab; we’ll email you when the job is done.',
  },
  {
    category: 'billing',
    q: 'What does the free plan include?',
    a: `${FREE_DELETION_LIMIT} successful deletions in total, on one Pinterest account, with every feature: filters, backup, dry run and retries. Failed deletions are never counted.`,
  },
  {
    category: 'billing',
    q: 'Is this a subscription?',
    a: 'No. The Cleanup Pass and Agency plans are one-time payments that unlock unlimited deletions for 30 days. Nothing renews automatically. Buying again while a pass is active adds another 30 days.',
  },
  {
    category: 'billing',
    q: 'Can I get a refund?',
    a: 'Yes — if no paid-tier deletion job has run, you can get a full refund within 7 days of purchase. Just email support with your PayPal order ID. Refunds are processed in 5–7 business days. See the Refund Policy for details.',
  },
  {
    category: 'privacy',
    q: 'What happens to my data?',
    a: 'We only use your Pinterest data to provide the service. It is never sold, never used for advertising and never used to train AI. Cached pins are purged 7 days after your last sync, tokens are deleted when you disconnect, and job records are kept for 30 days. You can export or delete everything from Settings.',
  },
  {
    category: 'general',
    q: 'Is PinDeleter made by Pinterest?',
    a: 'No. PinDeleter is an independent product by Kriosity. It uses Pinterest’s official public API, but it is not affiliated with, endorsed by or sponsored by Pinterest, Inc.',
  },
  {
    category: 'general',
    q: 'Can I manage several Pinterest accounts?',
    a: 'Yes. The Agency plan lets you connect up to 5 Pinterest accounts that you own or are authorised to manage, and switch between them in one dashboard.',
  },
];
