// Creates a PayPal order at the server-side price and a matching payments row.
import { requireUser } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { errorFields, log } from '../_shared/log.ts';
import { paypalClient } from '../_shared/payments-db.ts';
import { centsToPayPalValue, PLANS } from '../_shared/plans.ts';
import { enforceRateLimit } from '../_shared/ratelimit.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({ plan: z.enum(['pass', 'agency']) });

Deno.serve(
  handler({ name: 'paypal-create-order', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { plan } = await parseJson(req, Body);
    await enforceRateLimit('paypal-create-order', user.id, 20, 3600);
    const def = PLANS[plan];
    const db = adminClient();

    const { data: payment, error } = await db
      .from('payments')
      .insert({ user_id: user.id, plan, amount_cents: def.priceCents, currency: 'USD', status: 'created' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    try {
      const order = await paypalClient().createOrder({
        paymentId: payment.id,
        amountValue: centsToPayPalValue(def.priceCents),
        description: `PinDeleter ${def.name} – 30 days`,
        brandName: 'PinDeleter by Kriosity',
        requestId: `order-${payment.id}`,
      });
      const { error: upErr } = await db
        .from('payments')
        .update({ paypal_order_id: order.id })
        .eq('id', payment.id);
      if (upErr) throw new Error(upErr.message);
      return json(req, { orderId: order.id });
    } catch (err) {
      log.error('paypal_create_order_failed', { paymentId: payment.id, ...errorFields(err) });
      await db.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      throw new HttpError(
        502,
        'paypal_unavailable',
        'We could not start the PayPal checkout. Please try again in a moment.',
      );
    }
  }),
);
