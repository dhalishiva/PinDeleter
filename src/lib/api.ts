// Typed wrapper for calling Supabase Edge Functions with the user's session.
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './env';
import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export async function callFunction<T>(
  name: string,
  body?: unknown,
  opts: { method?: 'GET' | 'POST'; auth?: boolean } = {},
): Promise<T> {
  if (!isConfigured) throw new ApiError(0, 'not_configured', 'The app is not connected to its backend yet.');
  const method = opts.method ?? 'POST';
  const headers: Record<string, string> = { apikey: SUPABASE_ANON_KEY };
  if (opts.auth !== false) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, 'unauthorized', 'Please sign in again.');
    headers.Authorization = `Bearer ${token}`;
  } else {
    headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  }
  if (method === 'POST') headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Network error — check your connection and try again.');
  }
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const err = (parsed as ErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'error',
      err?.message ??
        (res.status === 429
          ? 'Too many requests. Please wait a moment.'
          : 'Something went wrong. Please try again.'),
      err?.details,
    );
  }
  return parsed as T;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
