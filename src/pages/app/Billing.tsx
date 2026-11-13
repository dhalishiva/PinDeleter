import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Printer, Receipt } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Badge, Card, ProgressBar, Skeleton, type Tone } from '@/components/ui';
import { PlanCards } from '@/features/billing/PlanCards';
import { Checkout } from '@/features/billing/Checkout';
import { usePayments } from '@/features/billing/hooks';
import { useEntitlement, useProfile } from '@/features/settings/hooks';
import { daysLeft, formatDate, formatDateTime, formatNumber } from '@/lib/format';
import type { Payment } from '@/lib/types';
import { formatPrice, FREE_DELETION_LIMIT, fullAddress, PLANS, SITE, type PaidPlanId } from '@/config/site';

const statusTone: Record<Payment['status'], Tone> = {
  created: 'gray',
  paid: 'success',
  failed: 'danger',
  refunded: 'sun',
};

function receiptNo(p: Payment) {
  const d = (p.paid_at ?? p.created_at).slice(0, 10).replace(/-/g, '');
  return `PD-${d}-${p.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export default function Billing() {
  const { entitlement, isLoading } = useEntitlement();
  const { data: profile } = useProfile();
  const payments = usePayments();
  const [params, setParams] = useSearchParams();
  const initial = params.get('checkout');
  const [checkout, setCheckout] = useState<PaidPlanId | null>(
    initial === 'pass' || initial === 'agency' ? initial : null,
  );
  const [receipt, setReceipt] = useState<Payment | null>(null);

  useEffect(() => {
    if (params.get('checkout')) {
      const next = new URLSearchParams(params);
      next.delete('checkout');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  return (
    <>
      <Seo title="Billing" noindex path="/app/billing" />
      <h1 className="text-3xl sm:text-4xl">Billing</h1>
      <p className="mt-1 text-muted">One-time passes, no subscriptions. Prices in USD.</p>

      {isLoading || !entitlement ? (
        <Skeleton className="mt-8 h-40" />
      ) : (
        <Card className="mt-8 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-muted">Current plan</p>
              <p className="mt-1 flex items-center gap-2 text-2xl font-black">
                {entitlement.unlimited && <Crown className="h-6 w-6 text-sunflower" aria-hidden />}
                {PLANS[entitlement.plan].name}
              </p>
              {entitlement.unlimited ? (
                <p className="mt-1 text-muted">
                  Unlimited deletions until{' '}
                  <strong className="text-ink">
                    {formatDate(entitlement.expiresAt, { dateStyle: 'long' })}
                  </strong>{' '}
                  · {daysLeft(entitlement.expiresAt)} days left · up to {entitlement.maxConnections} account
                  {entitlement.maxConnections > 1 ? 's' : ''}
                </p>
              ) : (
                <p className="mt-1 text-muted">
                  1 Pinterest account · {FREE_DELETION_LIMIT} lifetime deletions
                </p>
              )}
            </div>
            <div className="w-full sm:w-72">
              <p className="text-sm font-bold">
                Free deletions: {formatNumber(entitlement.freeDeletionsUsed)} used ·{' '}
                {formatNumber(entitlement.freeDeletionsRemaining)} left
              </p>
              <ProgressBar
                className="mt-2"
                value={entitlement.freeDeletionsUsed}
                max={FREE_DELETION_LIMIT}
                label="Free deletions used"
              />
            </div>
          </div>
        </Card>
      )}

      <h2 className="mt-12 text-2xl">{entitlement?.unlimited ? 'Extend or upgrade' : 'Upgrade'}</h2>
      <p className="mt-1 text-muted">
        Buying while a pass is active adds 30 days. Every plan has every feature.
      </p>
      <div className="mt-6">
        <PlanCards plans={['pass', 'agency']} currentPlan={entitlement?.plan ?? null} />
      </div>

      <h2 className="mt-12 text-2xl">Payment history</h2>
      <Card className="mt-4 overflow-hidden">
        {payments.isLoading ? (
          <Skeleton className="m-4 h-24" />
        ) : !payments.data?.length ? (
          <p className="p-6 text-muted">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-tint-violet">
                <tr>
                  <th scope="col" className="px-5 py-3 font-extrabold">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3 font-extrabold">
                    Plan
                  </th>
                  <th scope="col" className="px-5 py-3 font-extrabold">
                    Amount
                  </th>
                  <th scope="col" className="px-5 py-3 font-extrabold">
                    PayPal order ID
                  </th>
                  <th scope="col" className="px-5 py-3 font-extrabold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    <span className="sr-only">Receipt</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.data.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3.5">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="px-5 py-3.5 font-bold">{PLANS[p.plan].name}</td>
                    <td className="px-5 py-3.5 tabular-nums">
                      {formatPrice(p.amount_cents)} {p.currency}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs">{p.paypal_order_id ?? '—'}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={statusTone[p.status]}>{p.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(p.status === 'paid' || p.status === 'refunded') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReceipt(p)}
                          icon={<Receipt className="h-4 w-4" aria-hidden />}
                        >
                          Receipt
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Need a refund? See the refund policy or contact {SITE.supportEmail} with your PayPal order ID.
      </p>

      <Modal open={!!checkout} onClose={() => setCheckout(null)} title="Checkout">
        {checkout && <Checkout plan={checkout} onPaid={() => setCheckout(null)} />}
      </Modal>

      <Modal open={!!receipt} onClose={() => setReceipt(null)} title="Receipt" size="md">
        {receipt && (
          <div className="space-y-4 text-sm">
            <dl className="divide-y divide-line rounded-2xl border border-line">
              {[
                ['Receipt / invoice no.', receiptNo(receipt)],
                ['Billed to', profile?.email ?? '—'],
                ['Plan', `${PLANS[receipt.plan].name} (30 days, one-time)`],
                ['Amount', `${formatPrice(receipt.amount_cents)} ${receipt.currency}`],
                ['Paid', formatDateTime(receipt.paid_at)],
                ['Status', receipt.status],
                ['PayPal order ID', receipt.paypal_order_id ?? '—'],
                ['PayPal capture ID', receipt.paypal_capture_id ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">
              Seller: {SITE.operator} (proprietor: {SITE.proprietor}), {fullAddress()}. Export of services,
              charged in USD.
            </p>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              icon={<Printer className="h-4 w-4" aria-hidden />}
            >
              Print
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
