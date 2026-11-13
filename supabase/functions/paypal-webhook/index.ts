// PayPal webhooks: signature verified with PayPal's verify-webhook-signature API; idempotent by event id.
import { z } from '../_shared/deps.ts';
import { env } from '../_shared/env.ts';
import { errorJson, handler, json } from '../_shared/http.ts';
import { errorFields, log } from '../_shared/log.ts';
import { paypalClient, webhookDeps } from '../_shared/payments-db.ts';
import { handleWebhookEvent } from '../_shared/payments.ts';
import { webhookHeadersFrom } from '../_shared/paypal.ts';

const Event = z.object({
  id: z.string().min(1).max(100),
  event_type: z.string().min(1).max(100),
  resource_type: z.string().optional(),
  resource: z.record(z.unknown()),
});

Deno.serve(
  handler({ name: 'paypal-webhook', methods: ['POST'] }, async (req) => {
    const headers = webhookHeadersFrom(req);
    if (!headers) return errorJson(req, 400, 'missing_signature', 'Missing PayPal transmission headers.');
    let raw: unknown;
    try {
      raw = JSON.parse(await req.text());
    } catch {
      return errorJson(req, 400, 'invalid_json', 'Invalid JSON.');
    }
    const parsed = Event.safeParse(raw);
    if (!parsed.success) return errorJson(req, 400, 'invalid_event', 'Unrecognised event payload.');

    const verified = await paypalClient().verifyWebhookSignature(headers, raw, env('PAYPAL_WEBHOOK_ID'));
    if (!verified) {
      log.warn('paypal_webhook_signature_invalid', { eventId: parsed.data.id, type: parsed.data.event_type });
      return errorJson(req, 400, 'invalid_signature', 'Signature verification failed.');
    }

    try {
      const outcome = await handleWebhookEvent(webhookDeps(), parsed.data);
      log.info('paypal_webhook', { eventId: parsed.data.id, type: parsed.data.event_type, outcome });
      return json(req, { received: true, outcome });
    } catch (err) {
      log.error('paypal_webhook_failed', { eventId: parsed.data.id, ...errorFields(err) });
      // 5xx => PayPal retries the delivery later.
      return errorJson(req, 500, 'processing_failed', 'Webhook processing failed.');
    }
  }),
);
