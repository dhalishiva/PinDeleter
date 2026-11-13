import { Link } from 'react-router-dom';
import { Check, Minus } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { SectionHeading } from '@/components/ui';
import { FaqList } from '@/components/marketing';
import { PlanCards } from '@/features/billing/PlanCards';
import { useEntitlement } from '@/features/settings/hooks';
import { useAuth } from '@/features/auth/AuthProvider';
import { FAQ } from '@/content/faq';
import { FREE_DELETION_LIMIT, formatPrice, PLANS } from '@/config/site';
import { PageHero } from './PageHero';

type Cell = string | boolean;
const ROWS: [string, Cell, Cell, Cell][] = [
  ['Price (USD)', '$0', formatPrice(PLANS.pass.priceCents), formatPrice(PLANS.agency.priceCents)],
  ['Billing', 'Free forever', 'One-time', 'One-time'],
  ['Access period', 'Forever', '30 days', '30 days'],
  ['Successful deletions', `${FREE_DELETION_LIMIT} total`, 'Unlimited', 'Unlimited'],
  ['Pinterest accounts', '1', '1', 'Up to 5'],
  ['Board, date, keyword & engagement filters', true, true, true],
  ['Automatic JSON + CSV backup', true, true, true],
  ['Dry run', true, true, true],
  ['Rate-limit safe, resumable jobs', true, true, true],
  ['Retry failed pins', true, true, true],
  ['Downloadable job reports', true, true, true],
  ['Email when a job finishes', true, true, true],
  ['Auto-renewal', false, false, false],
];

const BILLING_FAQ = [
  {
    category: 'billing' as const,
    q: 'Which payment methods do you accept?',
    a: 'Payments are handled by PayPal. You can pay with your PayPal balance or linked accounts, or with a debit or credit card through PayPal’s guest checkout — no PayPal account needed.',
  },
  {
    category: 'billing' as const,
    q: 'Why is the price in USD?',
    a: 'We sell globally and charge the same USD price in every country. PayPal may show the amount converted into your local currency; your bank or PayPal sets the exchange rate and any conversion fee.',
  },
  {
    category: 'billing' as const,
    q: 'What happens after 30 days?',
    a: `Your plan simply ends — nothing renews and nothing is charged. You go back to the free plan; any of your ${FREE_DELETION_LIMIT} free deletions you haven’t used remain available.`,
  },
  {
    category: 'billing' as const,
    q: 'Can I extend my pass?',
    a: 'Yes. Buying again while a pass is active adds another 30 days to your current expiry date. If you buy Agency while a Cleanup Pass is active, you are upgraded to Agency for the combined period.',
  },
  {
    category: 'billing' as const,
    q: 'Do failed deletions count against my plan?',
    a: 'Never. Only pins that were actually deleted count towards the free limit. Pins that fail, are skipped, or were already gone are not counted.',
  },
  {
    category: 'billing' as const,
    q: 'Do I get an invoice?',
    a: 'Yes. Every payment sends an email receipt that works as your invoice, with the PayPal capture ID, amount, date and our business details. Your payment history is also on the Billing page.',
  },
  ...FAQ.filter((f) => f.q === 'Can I get a refund?'),
];

function CellView({ value }: { value: Cell }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-success" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-5 w-5 text-muted" aria-label="Not included" />;
  return <span className="font-semibold">{value}</span>;
}

export default function Pricing() {
  const { user } = useAuth();
  const { entitlement } = useEntitlement();
  return (
    <>
      <Seo
        path="/pricing"
        title="Pricing"
        description="Free for 50 deletions. Cleanup Pass $4.99 or Agency $14.99 one-time for 30 days of unlimited deletions. No subscriptions."
      />
      <PageHero
        eyebrow="Pricing"
        title={
          <>
            Pay once. <span className="text-gradient">Clean up for 30 days.</span>
          </>
        }
      >
        Every plan includes every feature — only the number of deletions and accounts differ. No
        subscriptions, no auto-renewal.
      </PageHero>
      <section className="pb-16">
        <div className="container-page">
          <PlanCards currentPlan={user ? (entitlement?.plan ?? null) : null} />
          <p className="mt-6 text-center text-sm text-muted">
            All prices are in US dollars for every country. PayPal may show the price converted into your
            local currency.
          </p>
        </div>
      </section>
      <section className="bg-tint-violet py-16">
        <div className="container-page max-w-5xl">
          <SectionHeading title="Compare plans" />
          <div className="overflow-x-auto rounded-4xl border border-line bg-raised shadow-card">
            <table className="w-full min-w-[640px] text-center text-sm sm:text-base">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr className="bg-tint-pink">
                  <th scope="col" className="px-5 py-4 text-left">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="px-5 py-4 font-extrabold">
                    {PLANS.free.name}
                  </th>
                  <th scope="col" className="px-5 py-4 font-extrabold text-primary">
                    {PLANS.pass.name}
                  </th>
                  <th scope="col" className="px-5 py-4 font-extrabold text-violet">
                    {PLANS.agency.name}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ROWS.map(([label, a, b, c]) => (
                  <tr key={label}>
                    <th scope="row" className="px-5 py-3.5 text-left font-bold">
                      {label}
                    </th>
                    <td className="px-5 py-3.5">
                      <CellView value={a} />
                    </td>
                    <td className="px-5 py-3.5">
                      <CellView value={b} />
                    </td>
                    <td className="px-5 py-3.5">
                      <CellView value={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      <section className="py-16">
        <div className="container-page max-w-3xl">
          <SectionHeading eyebrow="Billing FAQ" title="Billing questions" />
          <FaqList items={BILLING_FAQ} />
          <p className="mt-6 text-center text-sm text-muted">
            Read the full{' '}
            <Link to="/refund-policy" className="font-bold text-violet hover:underline">
              Refund &amp; Cancellation Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
