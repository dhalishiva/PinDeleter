import { lazy, Suspense } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAppConfig } from '@/features/config/useAppConfig';
import { formatPrice, PLANS, type PaidPlanId } from '@/config/site';

const PayPalButtonsPanel = lazy(() => import('./PayPalButtonsPanel'));

export function Checkout({ plan, onPaid }: { plan: PaidPlanId; onPaid?: () => void }) {
  const { data: config, isLoading } = useAppConfig();
  const def = PLANS[plan];
  return (
    <div>
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-tint-violet p-4">
        <div>
          <p className="font-extrabold">{def.name}</p>
          <p className="text-sm text-muted">30 days · one-time payment · no auto-renewal</p>
        </div>
        <p className="text-2xl font-black">
          {formatPrice(def.priceCents)}
          <span className="ml-1 text-sm font-bold text-muted">USD</span>
        </p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : config?.paypalClientId ? (
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          }
        >
          <PayPalButtonsPanel clientId={config.paypalClientId} plan={plan} onPaid={onPaid} />
        </Suspense>
      ) : (
        <p role="alert" className="rounded-2xl bg-sunflower-soft p-4 text-sm font-semibold">
          Payments are temporarily unavailable. Please try again later or contact support.
        </p>
      )}
      <p className="mt-4 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        Pay with PayPal or a debit/credit card (no PayPal account needed). Prices are in USD; PayPal may show
        the amount converted into your local currency. Card details go straight to PayPal — we never see them.
        {config?.paypalEnv === 'sandbox' && config.paypalClientId
          ? ' (PayPal sandbox — test payments only.)'
          : ''}
      </p>
    </div>
  );
}
