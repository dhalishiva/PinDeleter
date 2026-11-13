// Supabase-backed PaymentRepo + wiring for the payment functions.
import { contactSafe } from './text.ts';
import { paymentReceiptEmail } from './emails/templates.ts';
import { env, siteUrl } from './env.ts';
import { log } from './log.ts';
import { PayPalClient, type PayPalEnv } from './paypal.ts';
import type {
  PaymentDeps,
  PaymentRepo,
  PaymentRow,
  PaymentStatus,
  ProfileRow,
  ReceiptInput,
  WebhookDeps,
} from './payments.ts';
import { receiptNumber } from './payments.ts';
import { PLANS } from './plans.ts';
import { sendEmail } from './resend.ts';
import { adminClient } from './supabase.ts';

const PAYMENT_COLUMNS =
  'id, user_id, paypal_order_id, paypal_capture_id, plan, amount_cents, currency, status, paid_at';

export function paypalClient(): PayPalClient {
  const ppEnv = env('PAYPAL_ENV', 'sandbox') === 'live' ? 'live' : 'sandbox';
  return new PayPalClient({
    clientId: env('PAYPAL_CLIENT_ID'),
    clientSecret: env('PAYPAL_CLIENT_SECRET'),
    env: ppEnv as PayPalEnv,
  });
}

async function one(
  query: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<PaymentRow | null> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as PaymentRow | null) ?? null;
}

export const dbPaymentRepo: PaymentRepo = {
  findPaymentById: (id) =>
    one(adminClient().from('payments').select(PAYMENT_COLUMNS).eq('id', id).maybeSingle()),
  findPaymentByOrderId: (orderId) =>
    one(adminClient().from('payments').select(PAYMENT_COLUMNS).eq('paypal_order_id', orderId).maybeSingle()),
  findPaymentByCaptureId: (captureId) =>
    one(
      adminClient().from('payments').select(PAYMENT_COLUMNS).eq('paypal_capture_id', captureId).maybeSingle(),
    ),

  async markPaid(paymentId, fields) {
    const { data, error } = await adminClient()
      .from('payments')
      .update({ ...fields, status: 'paid' })
      .eq('id', paymentId)
      .in('status', ['created', 'failed'])
      .select('id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },

  async transition(paymentId, from: PaymentStatus[], to: PaymentStatus, extra = {}) {
    const { data, error } = await adminClient()
      .from('payments')
      .update({ ...extra, status: to })
      .eq('id', paymentId)
      .in('status', from)
      .select('id');
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },

  async getProfile(userId) {
    const { data, error } = await adminClient()
      .from('profiles')
      .select('id, email, plan, plan_expires_at')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ProfileRow | null) ?? null;
  },

  async setPlan(userId, change) {
    const { error } = await adminClient().from('profiles').update(change).eq('id', userId);
    if (error) throw new Error(error.message);
  },

  async recordWebhookEvent(id, type, resourceId, payload) {
    const { data, error } = await adminClient()
      .from('webhook_events')
      .upsert(
        { id, event_type: type, resource_id: resourceId, payload },
        { onConflict: 'id', ignoreDuplicates: true },
      )
      .select('id');
    if (error) throw new Error(error.message);
    if ((data ?? []).length > 0) return 'new';
    const { data: existing } = await adminClient()
      .from('webhook_events')
      .select('processed_at, error')
      .eq('id', id)
      .maybeSingle();
    return existing?.processed_at && !existing.error ? 'processed' : 'pending';
  },

  async markWebhookProcessed(id, errorMessage) {
    await adminClient()
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), error: errorMessage ?? null })
      .eq('id', id);
  },
};

export async function sendReceipt({ payment, profile, capture, expiresAt }: ReceiptInput): Promise<void> {
  const to = profile.email ?? capture.payerEmail;
  if (!to) return;
  const paidAt = new Date().toISOString();
  const email = paymentReceiptEmail({
    siteUrl: siteUrl(),
    planName: PLANS[payment.plan].name,
    amountCents: payment.amount_cents,
    captureId: capture.captureId,
    orderId: payment.paypal_order_id ?? '—',
    paidAt,
    expiresAt,
    payerEmail: contactSafe(capture.payerEmail),
    receiptNo: receiptNumber(payment, paidAt),
  });
  const sent = await sendEmail({ to, ...email, tags: [{ name: 'type', value: 'receipt' }] });
  log.info('receipt_email', { paymentId: payment.id, sent });
}

export function paymentDeps(): PaymentDeps {
  return { repo: dbPaymentRepo, sendReceipt };
}

export function webhookDeps(): WebhookDeps {
  const client = paypalClient();
  return { ...paymentDeps(), captureOrder: (orderId, requestId) => client.captureOrder(orderId, requestId) };
}
