// Loaded on demand (React.lazy) so the PayPal SDK only downloads on checkout screens.
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { useQueryClient } from '@tanstack/react-query';
import { callFunction, errorMessage } from '@/lib/api';
import { celebrate } from '@/lib/confetti';
import { qk } from '@/lib/queryClient';
import { toast } from '@/stores/ui';
import { Spinner } from '@/components/ui';
import type { PaidPlanId } from '@/config/site';

interface Props {
  clientId: string;
  plan: PaidPlanId;
  onPaid?: () => void;
}

function Buttons({ plan, onPaid }: Omit<Props, 'clientId'>) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const qc = useQueryClient();
  if (isRejected) {
    return (
      <p role="alert" className="rounded-2xl bg-sunflower-soft p-4 text-sm font-semibold">
        PayPal could not load. Check that ad blockers or privacy extensions aren’t blocking paypal.com, then
        reload the page.
      </p>
    );
  }
  return (
    <div className="relative min-h-[150px]">
      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      <PayPalButtons
        style={{ layout: 'vertical', shape: 'pill', color: 'gold', label: 'pay', height: 48 }}
        forceReRender={[plan]}
        createOrder={async () => {
          const { orderId } = await callFunction<{ orderId: string }>('paypal-create-order', { plan });
          return orderId;
        }}
        onApprove={async (data) => {
          try {
            const res = await callFunction<{ status: string; message?: string }>('paypal-capture-order', {
              orderId: data.orderID,
            });
            await qc.invalidateQueries({ queryKey: qk.profile });
            await qc.invalidateQueries({ queryKey: qk.payments });
            if (res.status === 'pending') {
              toast.info('Payment is processing', res.message);
              return;
            }
            void celebrate();
            toast.success(
              'You’re all set! 🎉',
              'Your plan is active now. A receipt is on its way to your inbox.',
            );
            onPaid?.();
          } catch (err) {
            toast.error('Payment not completed', errorMessage(err));
          }
        }}
        onCancel={() => toast.info('Checkout cancelled', 'No worries — you have not been charged.')}
        onError={(err) => {
          console.error('PayPal error', err);
          toast.error(
            'PayPal had a problem',
            'You have not been charged. Please try again or use another payment method.',
          );
        }}
      />
    </div>
  );
}

export default function PayPalButtonsPanel({ clientId, plan, onPaid }: Props) {
  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: 'USD',
        intent: 'capture',
        components: 'buttons',
        enableFunding: 'card',
        disableFunding: 'paylater,venmo',
      }}
    >
      <Buttons plan={plan} onPaid={onPaid} />
    </PayPalScriptProvider>
  );
}
