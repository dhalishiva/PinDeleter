// Request authentication: user JWTs and service-role calls (cron workers).
import { timingSafeEqual } from './crypto.ts';
import { env } from './env.ts';
import { HttpError } from './http.ts';
import { adminClient } from './supabase.ts';

export interface AuthedUser {
  id: string;
  email: string | null;
}

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

/** Verifies the Supabase JWT and returns the user. user_id is never taken from the request body. */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const token = bearer(req);
  if (!token) throw new HttpError(401, 'unauthorized', 'Please sign in again.');
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user)
    throw new HttpError(401, 'unauthorized', 'Your session has expired. Please sign in again.');
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Only allows calls carrying the service role key (pg_cron / internal calls). */
export function requireServiceRole(req: Request): void {
  const token = bearer(req);
  const keys = [env('SUPABASE_SERVICE_ROLE_KEY')];
  if (!token || !keys.some((k) => timingSafeEqual(token, k))) {
    throw new HttpError(401, 'unauthorized', 'Service role required.');
  }
}

export function clientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
