// Payment domain logic: capture validation, plan activation, refunds and webhook dispatch.
// Database access is behind PaymentRepo so this module is unit-testable.
import type { PayPalCapture, PayPalOrder } from './paypal.ts';
import {
  computeActivation,
  computeRevocation,
  CURRENCY,
  isPaidPlan,
  type PaidPlanId,
  type PlanChange,
  type PlanId,
  PLANS,
  payPalValueToCents,
} from './plans.ts';

export type PaymentStatus = 'created' | 'paid' | 'failed' | 'refunded';

export interface PaymentRow {
  id: string;
  user_id: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  plan: PaidPlanId;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  paid_at: string | null;
}

export interface ProfileRow {
  id: string;
  email: string | null;
  plan: PlanId;
  plan_expires_at: string | null;
}

export interface PaidFields {
  paypal_capture_id: string;
  payer_email: string | null;
  payer_country: string | null;
  paid_at: string;
  raw_webhook?: unknown;
}

export interface PaymentRepo {
  findPaymentById(id: string): Promise<PaymentRow | null>;
  findPaymentByOrderId(orderId: string): Promise<PaymentRow | null>;
  findPaymentByCaptureId(captureId: string): Promise<PaymentRow | null>;
  /** Atomically moves created|failed -> paid. Returns false if it was already paid (or refunded). */
  markPaid(paymentId: string, fields: PaidFields): Promise<boolean>;
  /** Atomically moves `from` -> `to`. Returns false if the row was not in a `from` state. */
  transition(
    paymentId: string,
    from: PaymentStatus[],
    to: PaymentStatus,
    extra?: Record<string, unknown>,
  ): Promise<boolean>;
  getProfile(userId: string): Promise<ProfileRow | null>;
  setPlan(userId: string, change: PlanChange): Promise<void>;
  /** Returns 'new' if inserted, 'processed' if already processed, 'pending' if seen but not processed. */
  recordWebhookEvent(
    id: string,
    type: string,
    resourceId: string | null,
    payload: unknown,
  ): Promise<'new' | 'processed' | 'pending'>;
  markWebhookProcessed(id: string, error?: string): Promise<void>;
}

export interface ReceiptInput {
  payment: PaymentRow;
  profile: ProfileRow;
  capture: CaptureSummary;
  expiresAt: string;
}

export interface PaymentDeps {
  repo: PaymentRepo;
  sendReceipt(input: ReceiptInput): Promise<void>;
  now?: () => Date;
}

export interface CaptureSummary {
  captureId: string;
  status: string;
  amountCents: number;
  currency: string;
  customId: string | null;
  payerEmail: string | null;
  payerCountry: string | null;
}

export function summarizeOrderCapture(order: PayPalOrder): CaptureSummary | null {
  const unit = order.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (!capture) return null;
  return {
    ...summarizeCapture(capture),
    customId: capture.custom_id ?? unit?.custom_id ?? null,
    payerEmail: order.payer?.email_address ?? order.payment_source?.paypal?.email_address ?? null,
    payerCountry:
      order.payer?.address?.country_code ??
      order.payment_source?.paypal?.address?.country_code ??
      order.payment_source?.card?.billing_address?.country_code ??
      null,
  };
}

export function summarizeCapture(capture: PayPalCapture): CaptureSummary {
  return {
    captureId: capture.id,
    status: capture.status,
    amountCents: capture.amount ? payPalValueToCents(capture.amount.value) : Number.NaN,
    currency: capture.amount?.currency_code ?? '',
    customId: capture.custom_id ?? null,
    payerEmail: null,
    payerCountry: null,
  };
}

export type CaptureCheck = { ok: true } | { ok: false; reason: string };

/** The amount and currency must match the server-side price of the plan stored on the payment row. */
export function validateCapture(
  capture: CaptureSummary,
  payment: Pick<PaymentRow, 'id' | 'plan' | 'amount_cents' | 'currency'>,
): CaptureCheck {
  if (capture.status !== 'COMPLETED') return { ok: false, reason: `Capture status is ${capture.status}` };
  if (capture.currency !== CURRENCY || payment.currency !== CURRENCY) {
    return { ok: false, reason: `Unexpected currency ${capture.currency}` };
  }
  if (!isPaidPlan(payment.plan)) return { ok: false, reason: 'Unknown plan' };
  const expected = PLANS[payment.plan].priceCents;
  if (payment.amount_cents !== expected || capture.amountCents !== expected) {
    return { ok: false, reason: `Amount mismatch: got ${capture.amountCents}, expected ${expected}` };
  }
  if (capture.customId && capture.customId !== payment.id) {
    return { ok: false, reason: 'custom_id does not match the payment' };
  }
  return { ok: true };
}

export interface FinalizeResult {
  activated: boolean;
  plan: PlanId | null;
  expiresAt: string | null;
}

/**
 * Marks a payment paid and activates/extends the plan exactly once
 * (the client capture and the webhook may race — only the winner of markPaid activates).
 */
export async function finalizePayment(
  deps: PaymentDeps,
  payment: PaymentRow,
  capture: CaptureSummary,
  raw?: unknown,
): Promise<FinalizeResult> {
  const check = validateCapture(capture, payment);
  if (!check.ok) {
    await deps.repo.transition(payment.id, ['created'], 'failed', { raw_webhook: raw ?? null });
    throw new PaymentValidationError(check.reason);
  }
  const now = deps.now?.() ?? new Date();
  const won = await deps.repo.markPaid(payment.id, {
    paypal_capture_id: capture.captureId,
    payer_email: capture.payerEmail,
    payer_country: capture.payerCountry,
    paid_at: now.toISOString(),
    raw_webhook: raw,
  });
  if (!payment.user_id) return { activated: false, plan: null, expiresAt: null };
  const profile = await deps.repo.getProfile(payment.user_id);
  if (!profile) return { activated: false, plan: null, expiresAt: null };
  if (!won) return { activated: false, plan: profile.plan, expiresAt: profile.plan_expires_at };

  const change = computeActivation(profile, payment.plan, now);
  await deps.repo.setPlan(profile.id, change);
  const expiresAt = change.plan_expires_at ?? now.toISOString();
  try {
    await deps.sendReceipt({ payment, profile, capture, expiresAt });
  } catch {
    // A failed receipt email must never undo a successful payment.
  }
  return { activated: true, plan: change.plan, expiresAt };
}

export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

/** Refund / reversal: mark refunded once and shorten (or revoke) the plan. */
export async function refundPayment(deps: PaymentDeps, payment: PaymentRow, raw?: unknown): Promise<boolean> {
  const now = deps.now?.() ?? new Date();
  const changed = await deps.repo.transition(payment.id, ['paid'], 'refunded', {
    refunded_at: now.toISOString(),
    raw_webhook: raw ?? null,
  });
  if (!changed || !payment.user_id) return changed;
  const profile = await deps.repo.getProfile(payment.user_id);
  if (profile) await deps.repo.setPlan(profile.id, computeRevocation(profile, now));
  return true;
}

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export interface WebhookEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  resource: Record<string, unknown>;
}

export interface WebhookDeps extends PaymentDeps {
  captureOrder(orderId: string, requestId: string): Promise<PayPalOrder>;
}

export type WebhookOutcome =
  | 'duplicate'
  | 'ignored'
  | 'activated'
  | 'already_paid'
  | 'refunded'
  | 'denied'
  | 'captured'
  | 'payment_not_found';

function captureIdFromLinks(resource: Record<string, unknown>): string | null {
  const links = resource.links as { rel?: string; href?: string }[] | undefined;
  const up = links?.find((l) => l.rel === 'up' && l.href?.includes('/captures/'));
  const match = up?.href?.match(/\/captures\/([^/?#]+)/);
  return match ? match[1]! : null;
}

async function findPaymentForResource(
  repo: PaymentRepo,
  resource: Record<string, unknown>,
  captureId: string | null,
) {
  const customId = typeof resource.custom_id === 'string' ? resource.custom_id : null;
  if (customId) {
    const p = await repo.findPaymentById(customId);
    if (p) return p;
  }
  if (captureId) {
    const p = await repo.findPaymentByCaptureId(captureId);
    if (p) return p;
  }
  const related = (resource.supplementary_data as { related_ids?: { order_id?: string } } | undefined)
    ?.related_ids;
  if (related?.order_id) return repo.findPaymentByOrderId(related.order_id);
  return null;
}

export async function handleWebhookEvent(deps: WebhookDeps, event: WebhookEvent): Promise<WebhookOutcome> {
  const resourceId = typeof event.resource.id === 'string' ? event.resource.id : null;
  const seen = await deps.repo.recordWebhookEvent(event.id, event.event_type, resourceId, event);
  if (seen === 'processed') return 'duplicate';

  try {
    const outcome = await dispatch(deps, event);
    await deps.repo.markWebhookProcessed(event.id);
    return outcome;
  } catch (err) {
    await deps.repo.markWebhookProcessed(event.id, err instanceof Error ? err.message : String(err));
    throw err;
  }
}

async function dispatch(deps: WebhookDeps, event: WebhookEvent): Promise<WebhookOutcome> {
  const { repo } = deps;
  const resource = event.resource;
  switch (event.event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED': {
      const capture = summarizeCapture(resource as unknown as PayPalCapture);
      const payment = await findPaymentForResource(repo, resource, capture.captureId);
      if (!payment) return 'payment_not_found';
      if (payment.status === 'paid' || payment.status === 'refunded') return 'already_paid';
      const payee = resource.payer as { email_address?: string } | undefined;
      const result = await finalizePayment(
        deps,
        payment,
        { ...capture, payerEmail: payee?.email_address ?? null },
        event,
      );
      return result.activated ? 'activated' : 'already_paid';
    }
    case 'PAYMENT.CAPTURE.DENIED': {
      const payment = await findPaymentForResource(repo, resource, resourceIdOf(resource));
      if (!payment) return 'payment_not_found';
      await repo.transition(payment.id, ['created'], 'failed', { raw_webhook: event });
      return 'denied';
    }
    case 'PAYMENT.CAPTURE.REFUNDED':
    case 'PAYMENT.CAPTURE.REVERSED': {
      // REFUNDED: resource is a refund (capture id in links rel=up). REVERSED: resource is the capture.
      const captureId =
        event.event_type === 'PAYMENT.CAPTURE.REVERSED'
          ? resourceIdOf(resource)
          : captureIdFromLinks(resource);
      const payment = await findPaymentForResource(repo, resource, captureId);
      if (!payment) return 'payment_not_found';
      await refundPayment(deps, payment, event);
      return 'refunded';
    }
    case 'CHECKOUT.ORDER.APPROVED': {
      const order = resource as unknown as PayPalOrder;
      const customId = order.purchase_units?.[0]?.custom_id ?? null;
      const payment =
        (customId ? await repo.findPaymentById(customId) : null) ??
        (await repo.findPaymentByOrderId(order.id));
      if (!payment) return 'payment_not_found';
      if (payment.status !== 'created') return 'already_paid';
      // The buyer approved but the client never captured (closed tab, network loss): capture now.
      const captured = await deps.captureOrder(order.id, `capture-${payment.id}`);
      const summary = summarizeOrderCapture(captured);
      if (!summary) return 'ignored';
      const result = await finalizePayment(deps, payment, summary, event);
      return result.activated ? 'captured' : 'already_paid';
    }
    default:
      return 'ignored';
  }
}

function resourceIdOf(resource: Record<string, unknown>): string | null {
  return typeof resource.id === 'string' ? resource.id : null;
}

export function receiptNumber(payment: Pick<PaymentRow, 'id'>, paidAt: string): string {
  const d = paidAt.slice(0, 10).replace(/-/g, '');
  return `PD-${d}-${payment.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
