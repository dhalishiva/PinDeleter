import { PayPalClient, type PayPalOrder } from '../paypal.ts';
import {
  finalizePayment,
  handleWebhookEvent,
  type PaymentRepo,
  type PaymentRow,
  type PaymentStatus,
  PaymentValidationError,
  type ProfileRow,
  summarizeOrderCapture,
  validateCapture,
  type WebhookDeps,
} from '../payments.ts';
import { assert, assertEquals, assertRejects } from './assert.ts';

const NOW = new Date('2026-11-13T10:00:00Z');

class MemoryRepo implements PaymentRepo {
  payments = new Map<string, PaymentRow>();
  profiles = new Map<string, ProfileRow>();
  events = new Map<string, { processed: boolean; error?: string }>();
  findPaymentById = (id: string) => Promise.resolve(this.payments.get(id) ?? null);
  findPaymentByOrderId = (o: string) =>
    Promise.resolve([...this.payments.values()].find((p) => p.paypal_order_id === o) ?? null);
  findPaymentByCaptureId = (c: string) =>
    Promise.resolve([...this.payments.values()].find((p) => p.paypal_capture_id === c) ?? null);
  markPaid(id: string, f: { paypal_capture_id: string; paid_at: string }) {
    const p = this.payments.get(id)!;
    if (p.status !== 'created' && p.status !== 'failed') return Promise.resolve(false);
    this.payments.set(id, {
      ...p,
      status: 'paid',
      paypal_capture_id: f.paypal_capture_id,
      paid_at: f.paid_at,
    });
    return Promise.resolve(true);
  }
  transition(id: string, from: PaymentStatus[], to: PaymentStatus) {
    const p = this.payments.get(id)!;
    if (!from.includes(p.status)) return Promise.resolve(false);
    this.payments.set(id, { ...p, status: to });
    return Promise.resolve(true);
  }
  getProfile = (id: string) => Promise.resolve(this.profiles.get(id) ?? null);
  setPlan(id: string, change: { plan: ProfileRow['plan']; plan_expires_at: string | null }) {
    this.profiles.set(id, { ...this.profiles.get(id)!, ...change });
    return Promise.resolve();
  }
  recordWebhookEvent(id: string) {
    const e = this.events.get(id);
    if (!e) {
      this.events.set(id, { processed: false });
      return Promise.resolve('new' as const);
    }
    return Promise.resolve(e.processed && !e.error ? ('processed' as const) : ('pending' as const));
  }
  markWebhookProcessed(id: string, error?: string) {
    this.events.set(id, { processed: true, error });
    return Promise.resolve();
  }
}

function setup(plan: 'pass' | 'agency' = 'pass') {
  const repo = new MemoryRepo();
  repo.profiles.set('u1', { id: 'u1', email: 'u@example.com', plan: 'free', plan_expires_at: null });
  repo.payments.set('pay-1', {
    id: 'pay-1',
    user_id: 'u1',
    paypal_order_id: 'ORDER1',
    paypal_capture_id: null,
    plan,
    amount_cents: plan === 'pass' ? 499 : 1499,
    currency: 'USD',
    status: 'created',
    paid_at: null,
  });
  const receipts: string[] = [];
  const captures: string[] = [];
  const deps: WebhookDeps = {
    repo,
    now: () => NOW,
    sendReceipt: (i) => {
      receipts.push(i.payment.id);
      return Promise.resolve();
    },
    captureOrder: (orderId, requestId) => {
      captures.push(`${orderId}:${requestId}`);
      return Promise.resolve(order('COMPLETED', '4.99', 'USD'));
    },
  };
  return { repo, deps, receipts, captures };
}

function order(status: string, value: string, currency: string, customId = 'pay-1'): PayPalOrder {
  return {
    id: 'ORDER1',
    status: 'COMPLETED',
    purchase_units: [
      {
        custom_id: customId,
        payments: {
          captures: [{ id: 'CAP1', status, amount: { currency_code: currency, value }, custom_id: customId }],
        },
      },
    ],
    payer: { email_address: 'buyer@example.com', address: { country_code: 'DE' } },
  };
}

Deno.test('capture check: amount, currency, status and custom_id must match', () => {
  const payment = { id: 'pay-1', plan: 'pass' as const, amount_cents: 499, currency: 'USD' };
  assertEquals(validateCapture(summarizeOrderCapture(order('COMPLETED', '4.99', 'USD'))!, payment), {
    ok: true,
  });
  assert(!validateCapture(summarizeOrderCapture(order('COMPLETED', '0.99', 'USD'))!, payment).ok);
  assert(!validateCapture(summarizeOrderCapture(order('COMPLETED', '4.99', 'EUR'))!, payment).ok);
  assert(!validateCapture(summarizeOrderCapture(order('PENDING', '4.99', 'USD'))!, payment).ok);
  assert(!validateCapture(summarizeOrderCapture(order('COMPLETED', '4.99', 'USD', 'other'))!, payment).ok);
  // A tampered payment row price is rejected too (server price is the source of truth).
  assert(
    !validateCapture(summarizeOrderCapture(order('COMPLETED', '0.01', 'USD'))!, {
      ...payment,
      amount_cents: 1,
    }).ok,
  );
});

Deno.test('summarizeOrderCapture extracts payer details', () => {
  const s = summarizeOrderCapture(order('COMPLETED', '4.99', 'USD'))!;
  assertEquals(s.captureId, 'CAP1');
  assertEquals(s.amountCents, 499);
  assertEquals(s.payerEmail, 'buyer@example.com');
  assertEquals(s.payerCountry, 'DE');
});

Deno.test('finalizePayment activates once even if called twice', async () => {
  const { repo, deps, receipts } = setup();
  const capture = summarizeOrderCapture(order('COMPLETED', '4.99', 'USD'))!;
  const p = (await repo.findPaymentById('pay-1'))!;
  const a = await finalizePayment(deps, p, capture);
  const b = await finalizePayment(deps, p, capture);
  assert(a.activated);
  assert(!b.activated);
  assertEquals(receipts.length, 1);
  const profile = repo.profiles.get('u1')!;
  assertEquals(profile.plan, 'pass');
  assertEquals(new Date(profile.plan_expires_at!).getTime(), NOW.getTime() + 30 * 86_400_000);
});

Deno.test('finalizePayment rejects a wrong amount and marks the payment failed', async () => {
  const { repo, deps } = setup();
  const p = (await repo.findPaymentById('pay-1'))!;
  await assertRejects(
    () => finalizePayment(deps, p, summarizeOrderCapture(order('COMPLETED', '1.00', 'USD'))!),
    PaymentValidationError,
  );
  assertEquals(repo.payments.get('pay-1')!.status, 'failed');
  assertEquals(repo.profiles.get('u1')!.plan, 'free');
});

function captureCompletedEvent(id = 'WH-1') {
  return {
    id,
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAP1',
      status: 'COMPLETED',
      amount: { currency_code: 'USD', value: '4.99' },
      custom_id: 'pay-1',
      supplementary_data: { related_ids: { order_id: 'ORDER1' } },
    },
  };
}

Deno.test('webhook PAYMENT.CAPTURE.COMPLETED activates the plan (safety net) and is idempotent', async () => {
  const { repo, deps, receipts } = setup();
  assertEquals(await handleWebhookEvent(deps, captureCompletedEvent()), 'activated');
  assertEquals(await handleWebhookEvent(deps, captureCompletedEvent()), 'duplicate');
  assertEquals(repo.payments.get('pay-1')!.status, 'paid');
  assertEquals(repo.profiles.get('u1')!.plan, 'pass');
  assertEquals(receipts.length, 1);
});

Deno.test('webhook after client capture does not double-extend', async () => {
  const { repo, deps } = setup();
  await finalizePayment(
    deps,
    (await repo.findPaymentById('pay-1'))!,
    summarizeOrderCapture(order('COMPLETED', '4.99', 'USD'))!,
  );
  const expires = repo.profiles.get('u1')!.plan_expires_at;
  assertEquals(await handleWebhookEvent(deps, captureCompletedEvent('WH-2')), 'already_paid');
  assertEquals(repo.profiles.get('u1')!.plan_expires_at, expires);
});

Deno.test('webhook PAYMENT.CAPTURE.REFUNDED marks refunded and revokes the plan', async () => {
  const { repo, deps } = setup();
  await handleWebhookEvent(deps, captureCompletedEvent());
  const refund = {
    id: 'WH-R',
    event_type: 'PAYMENT.CAPTURE.REFUNDED',
    resource: {
      id: 'REF1',
      status: 'COMPLETED',
      amount: { currency_code: 'USD', value: '4.99' },
      links: [{ rel: 'up', href: 'https://api-m.sandbox.paypal.com/v2/payments/captures/CAP1' }],
    },
  };
  assertEquals(await handleWebhookEvent(deps, refund), 'refunded');
  assertEquals(repo.payments.get('pay-1')!.status, 'refunded');
  assertEquals(repo.profiles.get('u1')!.plan, 'free');
});

Deno.test('webhook PAYMENT.CAPTURE.REVERSED is treated as a refund', async () => {
  const { repo, deps } = setup();
  await handleWebhookEvent(deps, captureCompletedEvent());
  const reversed = {
    id: 'WH-V',
    event_type: 'PAYMENT.CAPTURE.REVERSED',
    resource: { id: 'CAP1', status: 'REVERSED' },
  };
  assertEquals(await handleWebhookEvent(deps, reversed), 'refunded');
  assertEquals(repo.profiles.get('u1')!.plan, 'free');
});

Deno.test('webhook PAYMENT.CAPTURE.DENIED marks an unpaid payment failed', async () => {
  const { repo, deps } = setup();
  const denied = {
    id: 'WH-D',
    event_type: 'PAYMENT.CAPTURE.DENIED',
    resource: { id: 'CAP1', custom_id: 'pay-1', status: 'DECLINED' },
  };
  assertEquals(await handleWebhookEvent(deps, denied), 'denied');
  assertEquals(repo.payments.get('pay-1')!.status, 'failed');
});

Deno.test('webhook CHECKOUT.ORDER.APPROVED captures when the client never did', async () => {
  const { repo, deps, captures } = setup();
  const approved = {
    id: 'WH-A',
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: { id: 'ORDER1', status: 'APPROVED', purchase_units: [{ custom_id: 'pay-1' }] },
  };
  assertEquals(await handleWebhookEvent(deps, approved), 'captured');
  assertEquals(captures, ['ORDER1:capture-pay-1']);
  assertEquals(repo.profiles.get('u1')!.plan, 'pass');
});

Deno.test('unknown events are ignored', async () => {
  const { deps } = setup();
  assertEquals(
    await handleWebhookEvent(deps, { id: 'WH-X', event_type: 'BILLING.PLAN.CREATED', resource: {} }),
    'ignored',
  );
});

Deno.test('PayPal verify-webhook-signature request (mocked)', async () => {
  const calls: { url: string; body: unknown }[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      body: init?.body
        ? String(init.body).startsWith('{')
          ? JSON.parse(String(init.body))
          : init.body
        : null,
    });
    if (url.endsWith('/v1/oauth2/token')) {
      return Promise.resolve(
        new Response(JSON.stringify({ access_token: 'A21', expires_in: 3600 }), { status: 200 }),
      );
    }
    const body = JSON.parse(String(init!.body)) as { transmission_sig: string };
    return Promise.resolve(
      new Response(
        JSON.stringify({ verification_status: body.transmission_sig === 'good' ? 'SUCCESS' : 'FAILURE' }),
        { status: 200 },
      ),
    );
  }) as typeof fetch;
  const client = new PayPalClient({ clientId: 'id-test', clientSecret: 's', env: 'sandbox', fetchImpl });
  const headers = {
    authAlgo: 'SHA256withRSA',
    certUrl: 'https://api.sandbox.paypal.com/cert',
    transmissionId: 't',
    transmissionTime: 'now',
    transmissionSig: 'good',
  };
  assert(await client.verifyWebhookSignature(headers, { id: 'WH-1' }, 'WEBHOOK123'));
  assert(
    !(await client.verifyWebhookSignature(
      { ...headers, transmissionSig: 'bad' },
      { id: 'WH-1' },
      'WEBHOOK123',
    )),
  );
  const verifyCall = calls.find((c) => c.url.endsWith('/v1/notifications/verify-webhook-signature'))!;
  assertEquals((verifyCall.body as { webhook_id: string }).webhook_id, 'WEBHOOK123');
  assert(verifyCall.url.startsWith('https://api-m.sandbox.paypal.com'));
  // token cached: only one oauth call
  assertEquals(calls.filter((c) => c.url.endsWith('/v1/oauth2/token')).length, 1);
});
