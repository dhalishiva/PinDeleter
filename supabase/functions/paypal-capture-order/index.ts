// Captures an approved PayPal order, verifies amount/currency and activates the plan immediately.
import { requireUser } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { errorFields, log } from '../_shared/log.ts';
import { dbPaymentRepo, paymentDeps, paypalClient } from '../_shared/payments-db.ts';
import { finalizePayment, PaymentValidationError, summarizeOrderCapture } from '../_shared/payments.ts';
import { PayPalError } from '../_shared/paypal.ts';

const Body = z.object({
  orderId: z
    .string()
    .min(5)
    .max(64)
    .regex(/^[A-Z0-9-]+$/i),
});

Deno.serve(
  handler({ name: 'paypal-capture-order', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { orderId } = await parseJson(req, Body);
    const payment = await dbPaymentRepo.findPaymentByOrderId(orderId);
    if (!payment || payment.user_id !== user.id) throw new HttpError(404, 'not_found', 'Order not found.');

    if (payment.status === 'paid') {
      const profile = await dbPaymentRepo.getProfile(user.id);
      return json(req, { status: 'paid', plan: profile?.plan, expiresAt: profile?.plan_expires_at });
    }
    if (payment.status === 'refunded') throw new HttpError(409, 'refunded', 'This payment was refunded.');

    let order;
    try {
      order = await paypalClient().captureOrder(orderId, `capture-${payment.id}`);
    } catch (err) {
      log.warn('paypal_capture_failed', { paymentId: payment.id, ...errorFields(err) });
      if (err instanceof PayPalError && err.issue === 'INSTRUMENT_DECLINED') {
        throw new HttpError(
          402,
          'instrument_declined',
          'Your payment method was declined. Please choose another one.',
        );
      }
      throw new HttpError(
        502,
        'capture_failed',
        'PayPal could not complete the payment. You have not been charged.',
      );
    }

    const capture = summarizeOrderCapture(order);
    if (!capture)
      throw new HttpError(502, 'capture_missing', 'PayPal did not return a capture. Please contact support.');
    if (capture.status === 'PENDING') {
      return json(
        req,
        {
          status: 'pending',
          message:
            'PayPal is still processing this payment. Your plan activates automatically as soon as it clears.',
        },
        202,
      );
    }

    try {
      const result = await finalizePayment(paymentDeps(), payment, capture, {
        source: 'client_capture',
        order,
      });
      return json(req, { status: 'paid', plan: result.plan, expiresAt: result.expiresAt });
    } catch (err) {
      if (err instanceof PaymentValidationError) {
        log.error('payment_validation_failed', { paymentId: payment.id, reason: err.message });
        throw new HttpError(
          400,
          'payment_invalid',
          'The payment did not match the plan price. Please contact support.',
        );
      }
      throw err;
    }
  }),
);
