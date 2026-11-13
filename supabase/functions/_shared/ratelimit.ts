import { hmacSha256Hex } from './crypto.ts';
import { env } from './env.ts';
import { HttpError } from './http.ts';
import { log } from './log.ts';
import { adminClient } from './supabase.ts';

/** One-way hash of an IP (or any identifier). Raw IPs are never stored. */
export function hashIdentifier(value: string): Promise<string> {
  return hmacSha256Hex(env('TOKEN_ENCRYPTION_KEY'), `ip:${value}`);
}

export async function enforceRateLimit(
  key: string,
  identifierHash: string,
  limit: number,
  windowSeconds: number,
) {
  const { data, error } = await adminClient().rpc('hit_rate_limit', {
    p_key: key,
    p_ip_hash: identifierHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    log.error('rate_limit_check_failed', { key, error: error.message });
    return; // fail open: a broken limiter must not take the product down
  }
  if (data === false) {
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please wait a while and try again.');
  }
}
