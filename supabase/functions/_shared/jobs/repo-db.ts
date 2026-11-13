// Supabase-backed JobRepo + email notifier for the jobs worker.
import { jobCompletedEmail, jobFailedEmail } from '../emails/templates.ts';
import { siteUrl } from '../env.ts';
import { log } from '../log.ts';
import { computeEntitlement, type ProfilePlanState } from '../plans.ts';
import { sendEmail } from '../resend.ts';
import { adminClient } from '../supabase.ts';
import type { EventLevel, ItemRow, JobRepo, JobRow, JobStatus, Notifier } from './processor.ts';

export const JOB_COLUMNS =
  'id, user_id, connection_id, is_dry_run, status, total, deleted_count, failed_count, skipped_count, rate_limit_pauses, started_at, created_at';

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getProfilePlan(
  userId: string,
): Promise<ProfilePlanState & { email: string | null; notify_on_job_complete: boolean }> {
  const { data, error } = await adminClient()
    .from('profiles')
    .select('plan, plan_expires_at, free_deletions_used, email, notify_on_job_complete')
    .eq('id', userId)
    .single();
  check(error);
  return data as ProfilePlanState & { email: string | null; notify_on_job_complete: boolean };
}

export async function addJobEvent(job: Pick<JobRow, 'id' | 'user_id'>, level: EventLevel, message: string) {
  const { error } = await adminClient()
    .from('job_events')
    .insert({ job_id: job.id, user_id: job.user_id, level, message });
  if (error) log.warn('job_event_insert_failed', { jobId: job.id, error: error.message });
}

export const dbJobRepo: JobRepo = {
  async getJobStatus(jobId) {
    const { data, error } = await adminClient()
      .from('delete_jobs')
      .select('status')
      .eq('id', jobId)
      .maybeSingle();
    check(error);
    return (data?.status as JobStatus | undefined) ?? null;
  },

  async nextPendingItems(jobId, limit) {
    const { data, error } = await adminClient()
      .from('delete_job_items')
      .select('id, job_id, pin_id, pinterest_pin_id, attempts')
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .order('created_at')
      .order('id')
      .limit(limit);
    check(error);
    return (data ?? []) as ItemRow[];
  },

  async updateItem(itemId, update) {
    const patch: Record<string, unknown> = { ...update };
    if (update.status !== 'pending') patch.processed_at = new Date().toISOString();
    if (update.reason === undefined) delete patch.reason;
    const { data, error } = await adminClient()
      .from('delete_job_items')
      .update(patch)
      .eq('id', itemId)
      .eq('status', 'pending')
      .select('id');
    check(error);
    return (data ?? []).length > 0;
  },

  async setPinStatus(pinId, status) {
    const { error } = await adminClient().from('pins').update({ status }).eq('id', pinId);
    check(error);
  },

  async incrementCounters(jobId, delta) {
    const { data, error } = await adminClient()
      .rpc('increment_job_counters', {
        p_job_id: jobId,
        p_deleted: delta.deleted ?? 0,
        p_failed: delta.failed ?? 0,
        p_skipped: delta.skipped ?? 0,
      })
      .single();
    check(error);
    return data as JobRow;
  },

  async updateJob(jobId, patch) {
    const { error } = await adminClient().from('delete_jobs').update(patch).eq('id', jobId);
    check(error);
  },

  addEvent: addJobEvent,

  async getEntitlement(userId) {
    return computeEntitlement(await getProfilePlan(userId));
  },

  async chargeFreeDeletion(userId) {
    const { data, error } = await adminClient().rpc('increment_free_deletions', {
      p_user_id: userId,
      p_n: 1,
    });
    check(error);
    return Number(data);
  },

  async markConnectionError(connectionId, message) {
    const { error } = await adminClient()
      .from('pinterest_connections')
      .update({ status: 'error', last_error: message })
      .eq('id', connectionId);
    check(error);
  },

  async skipRemaining(jobId, reason) {
    const { data, error } = await adminClient()
      .from('delete_job_items')
      .update({ status: 'skipped', reason, processed_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('status', 'pending')
      .select('pin_id');
    check(error);
    const pinIds = (data ?? []).map((r) => r.pin_id as string | null).filter((id): id is string => !!id);
    for (let i = 0; i < pinIds.length; i += 200) {
      const { error: pinErr } = await adminClient()
        .from('pins')
        .update({ status: 'active' })
        .in('id', pinIds.slice(i, i + 200))
        .eq('status', 'queued');
      check(pinErr);
    }
    return (data ?? []).length;
  },
};

async function connectionUsername(connectionId: string): Promise<string> {
  const { data } = await adminClient()
    .from('pinterest_connections')
    .select('username')
    .eq('id', connectionId)
    .maybeSingle();
  return (data?.username as string | undefined) ?? 'your account';
}

export const emailNotifier: Notifier = {
  async jobCompleted(job) {
    if (job.is_dry_run) return;
    const profile = await getProfilePlan(job.user_id);
    if (!profile.notify_on_job_complete || !profile.email) return;
    const email = jobCompletedEmail({
      siteUrl: siteUrl(),
      jobId: job.id,
      username: await connectionUsername(job.connection_id),
      deleted: job.deleted_count,
      failed: job.failed_count,
      skipped: job.skipped_count,
      durationMs: Date.now() - new Date(job.started_at ?? job.created_at).getTime(),
    });
    await sendEmail({ to: profile.email, ...email, tags: [{ name: 'type', value: 'job_completed' }] });
  },
  async jobFailed(job, reason, needsReauth) {
    const profile = await getProfilePlan(job.user_id);
    if (!profile.email) return;
    const email = jobFailedEmail({
      siteUrl: siteUrl(),
      jobId: job.id,
      username: await connectionUsername(job.connection_id),
      reason,
      needsReauth,
    });
    await sendEmail({ to: profile.email, ...email, tags: [{ name: 'type', value: 'job_failed' }] });
  },
};
