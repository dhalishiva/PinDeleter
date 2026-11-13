// Connection helpers shared by oauth, disconnect and account deletion.
import { decryptString } from './crypto.ts';
import { env } from './env.ts';
import { addJobEvent, JOB_COLUMNS } from './jobs/repo-db.ts';
import { errorFields, log } from './log.ts';
import { type ConnectionRow, pinterestClient } from './pinterest/index.ts';
import { adminClient } from './supabase.ts';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Connections that occupy a plan slot (active or needing re-auth). */
export async function usedConnectionSlots(
  userId: string,
): Promise<{ id: string; pinterest_user_id: string }[]> {
  const { data, error } = await adminClient()
    .from('pinterest_connections')
    .select('id, pinterest_user_id')
    .eq('user_id', userId)
    .in('status', ['active', 'error']);
  check(error);
  return (data ?? []) as { id: string; pinterest_user_id: string }[];
}

export const ACTIVE_JOB_STATUSES = ['queued', 'running', 'paused', 'rate_limited'] as const;

/** Cancels every non-terminal job of a connection and returns their pins to 'active'. */
export async function cancelActiveJobs(connectionId: string, reason: string) {
  const { data: jobs, error } = await adminClient()
    .from('delete_jobs')
    .select(JOB_COLUMNS)
    .eq('connection_id', connectionId)
    .in('status', [...ACTIVE_JOB_STATUSES]);
  check(error);
  for (const job of jobs ?? []) {
    const { data: items, error: itemErr } = await adminClient()
      .from('delete_job_items')
      .update({ status: 'skipped', reason: 'cancelled', processed_at: new Date().toISOString() })
      .eq('job_id', job.id)
      .eq('status', 'pending')
      .select('pin_id');
    check(itemErr);
    const skipped = (items ?? []).length;
    const pinIds = (items ?? []).map((i) => i.pin_id as string | null).filter((x): x is string => !!x);
    for (let i = 0; i < pinIds.length; i += 200) {
      await adminClient()
        .from('pins')
        .update({ status: 'active' })
        .in('id', pinIds.slice(i, i + 200))
        .eq('status', 'queued');
    }
    await adminClient().rpc('increment_job_counters', { p_job_id: job.id, p_skipped: skipped });
    await adminClient()
      .from('delete_jobs')
      .update({
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        locked_until: null,
        last_error: reason,
      })
      .eq('id', job.id);
    await addJobEvent(job, 'warn', `Cancelled: ${reason}`);
  }
}

/**
 * Disconnects a Pinterest account: cancels jobs, revokes the token remotely if the API supports it,
 * deletes tokens and all cached Pinterest data for the connection, and marks it revoked.
 */
export async function disconnectConnection(conn: ConnectionRow): Promise<{ remoteRevoked: boolean }> {
  await cancelActiveJobs(conn.id, 'the Pinterest account was disconnected.');

  let remoteRevoked = false;
  if (conn.access_token_enc) {
    try {
      const token = await decryptString(conn.access_token_enc, env('TOKEN_ENCRYPTION_KEY'));
      remoteRevoked = await pinterestClient().revokeToken(token);
    } catch (err) {
      log.warn('pinterest_revoke_failed', { connectionId: conn.id, ...errorFields(err) });
    }
  }

  // Order matters: job items reference pins (set null), pins reference boards (set null).
  for (const table of ['pins', 'boards', 'sync_runs'] as const) {
    const { error } = await adminClient().from(table).delete().eq('connection_id', conn.id);
    check(error);
  }
  const { error } = await adminClient()
    .from('pinterest_connections')
    .update({
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: null,
      refresh_expires_at: null,
      status: 'revoked',
      last_synced_at: null,
      last_error: null,
    })
    .eq('id', conn.id);
  check(error);
  log.info('connection_disconnected', { connectionId: conn.id, remoteRevoked });
  return { remoteRevoked };
}
