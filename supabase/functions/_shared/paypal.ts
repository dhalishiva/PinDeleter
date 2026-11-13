// PayPal REST client (Orders v2 + webhook signature verification).
// Docs: https://developer.paypal.com/docs/api/orders/v2/ and https://developer.paypal.com/docs/api/webhooks/v1/

export type PayPalEnv = 'sandbox' | 'live';

export interface PayPalAmount {
  currency_code: string;
  value: string;
}
export interface PayPalCapture {
  id: string;
  status: string;
  amount?: PayPalAmount;
  custom_id?: string;
}
export interface PayPalPurchaseUnit {
  reference_id?: string;
  custom_id?: string;
  amount?: PayPalAmount;
  payments?: { captures?: PayPalCapture[] };
}
export interface PayPalOrder {
  id: string;
  status: string;
  purchase_units?: PayPalPurchaseUnit[];
  payer?: { email_address?: string; address?: { country_code?: string } };
  payment_source?: {
    paypal?: { email_address?: string; address?: { country_code?: string } };
    card?: { billing_address?: { country_code?: string } };
  };
}

export interface WebhookHeaders {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
}

export class PayPalError extends Error {
  constructor(
    public readonly status: number,
    public readonly issue: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = 'PayPalError';
  }
}

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  env: PayPalEnv;
  fetchImpl?: typeof fetch;
}

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export function payPalBaseUrl(env: PayPalEnv): string {
  return env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export class PayPalClient {
  private readonly fetch: typeof fetch;
  readonly baseUrl: string;

  constructor(private readonly cfg: PayPalConfig) {
    this.fetch = cfg.fetchImpl ?? fetch;
    this.baseUrl = payPalBaseUrl(cfg.env);
  }

  /** Client-credentials token, cached until 60s before expiry. */
  async getAccessToken(): Promise<string> {
    const cacheKey = `${this.cfg.env}:${this.cfg.clientId}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await this.fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw await toError(res);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache.set(cacheKey, { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 });
    return body.access_token;
  }

  private async call<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const token = await this.getAccessToken();
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw await toError(res);
    return (await res.json()) as T;
  }

  createOrder(p: {
    paymentId: string;
    amountValue: string;
    description: string;
    brandName: string;
    requestId: string;
  }) {
    return this.call<PayPalOrder>(
      'POST',
      '/v2/checkout/orders',
      {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: p.paymentId,
            custom_id: p.paymentId,
            description: p.description,
            soft_descriptor: 'PINDELETER',
            amount: { currency_code: 'USD', value: p.amountValue },
          },
        ],
        application_context: {
          brand_name: p.brandName,
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
        },
      },
      { 'PayPal-Request-Id': p.requestId, Prefer: 'return=representation' },
    );
  }

  getOrder(orderId: string) {
    return this.call<PayPalOrder>('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }

  /** Captures an order. Idempotent via PayPal-Request-Id; an already-captured order is fetched instead. */
  async captureOrder(orderId: string, requestId: string): Promise<PayPalOrder> {
    try {
      return await this.call<PayPalOrder>(
        'POST',
        `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {},
        {
          'PayPal-Request-Id': requestId,
          Prefer: 'return=representation',
        },
      );
    } catch (err) {
      if (err instanceof PayPalError && err.issue === 'ORDER_ALREADY_CAPTURED') return this.getOrder(orderId);
      throw err;
    }
  }

  async verifyWebhookSignature(headers: WebhookHeaders, event: unknown, webhookId: string): Promise<boolean> {
    const body = await this.call<{ verification_status: string }>(
      'POST',
      '/v1/notifications/verify-webhook-signature',
      {
        auth_algo: headers.authAlgo,
        cert_url: headers.certUrl,
        transmission_id: headers.transmissionId,
        transmission_sig: headers.transmissionSig,
        transmission_time: headers.transmissionTime,
        webhook_id: webhookId,
        webhook_event: event,
      },
    );
    return body.verification_status === 'SUCCESS';
  }
}

export function webhookHeadersFrom(req: Request): WebhookHeaders | null {
  const h = (name: string) => req.headers.get(name);
  const authAlgo = h('paypal-auth-algo');
  const certUrl = h('paypal-cert-url');
  const transmissionId = h('paypal-transmission-id');
  const transmissionSig = h('paypal-transmission-sig');
  const transmissionTime = h('paypal-transmission-time');
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) return null;
  return { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime };
}

async function toError(res: Response): Promise<PayPalError> {
  let issue: string | undefined;
  let message = `PayPal API error ${res.status}`;
  try {
    const body = (await res.json()) as {
      name?: string;
      message?: string;
      details?: { issue?: string; description?: string }[];
      error_description?: string;
    };
    issue = body.details?.[0]?.issue ?? body.name;
    message = body.details?.[0]?.description ?? body.message ?? body.error_description ?? message;
  } catch {
    // ignore
  }
  return new PayPalError(res.status, issue, message);
}
