import { createClient, type SupabaseClient } from './deps.ts';
import { env } from './env.ts';

let admin: SupabaseClient | null = null;

/** Service-role client. Bypasses RLS — use only after verifying ownership in code. */
export function adminClient(): SupabaseClient {
  if (!admin) {
    admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
