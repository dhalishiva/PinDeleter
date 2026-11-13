// HTTP helpers: CORS, consistent JSON errors, input validation and a request wrapper.
import { z, type ZodType, type ZodTypeDef } from './deps.ts';
import { isDevelopment, siteUrl } from './env.ts';
import { errorFields, log } from './log.ts';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function allowedOrigins(): string[] {
  const origins = [siteUrl()];
  if (isDevelopment()) origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  return origins;
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = allowedOrigins();
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : allowed[0]!,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(
  req: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req), ...extra },
  });
}

export function errorJson(req: Request, status: number, code: string, message: string, details?: unknown) {
  return json(req, { error: { code, message, ...(details === undefined ? {} : { details }) } }, status);
}

export async function parseJson<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'invalid_json', 'Request body must be valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, 'invalid_input', 'Some fields are invalid.', parsed.error.flatten());
  }
  return parsed.data;
}

export interface HandlerOptions {
  name: string;
  methods: ReadonlyArray<'GET' | 'POST'>;
}

export function handler(opts: HandlerOptions, fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
    if (!opts.methods.includes(req.method as 'GET' | 'POST')) {
      return errorJson(req, 405, 'method_not_allowed', `Use ${opts.methods.join(' or ')}.`);
    }
    const started = Date.now();
    try {
      const res = await fn(req);
      log.info('request', { fn: opts.name, status: res.status, ms: Date.now() - started });
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        log.warn('request_error', {
          fn: opts.name,
          status: err.status,
          code: err.code,
          ms: Date.now() - started,
        });
        return errorJson(req, err.status, err.code, err.message, err.details);
      }
      if (err instanceof z.ZodError) {
        return errorJson(req, 400, 'invalid_input', 'Some fields are invalid.', err.flatten());
      }
      log.error('unhandled_error', { fn: opts.name, ...errorFields(err), ms: Date.now() - started });
      return errorJson(req, 500, 'internal_error', 'Something went wrong on our side. Please try again.');
    }
  };
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Keeps a promise running after the response is sent (Supabase Edge Runtime), or awaits it elsewhere. */
export function runInBackground(promise: Promise<unknown>): void {
  const safe = promise.catch((err) => log.error('background_task_failed', errorFields(err)));
  const rt = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(safe);
}
