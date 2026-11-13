// Pause / resume / cancel a job, or retry only its failed items in a new job.
import { requireUser } from '../_shared/auth.ts';
import { ACTIVE_JOB_STATUSES, cancelActiveJobs } from '../_shared/connections.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { createJob, kickWorker, type NewItem } from '../_shared/jobs/create.ts';
import { addJobEvent, getProfilePlan, JOB_COLUMNS } from '../_shared/jobs/repo-db.ts';
import type { JobRow } from '../_shared/jobs/processor.ts';
import { loadConnection } from '../_shared/pinterest/index.ts';
import { computeEntitlement, deletionAllowance, PLANS } from '../_shared/plans.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({
  jobId: z.string().uuid(),
  action: z.enum(['pause', 'resume', 'cancel', 'retry_failed']),
});

Deno.serve(
  handler({ name: 'jobs-control', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const { jobId, action } = await parseJson(req, Body);
    const db = adminClient();
    const { data, error } = await db
      .from('delete_jobs')
      .select(JOB_COLUMNS)
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new HttpError(404, 'not_found', 'Job not found.');
    const job = data as JobRow;
    const isActive = (ACTIVE_JOB_STATUSES as readonly string[]).includes(job.status);

    const transition = async (from: string[], patch: Record<string, unknown>) => {
      const { data: rows, error: upErr } = await db
        .from('delete_jobs')
        .update(patch)
        .eq('id', job.id)
        .in('status', from)
        .select('id');
      if (upErr) throw new Error(upErr.message);
      return (rows ?? []).length > 0;
    };

    switch (action) {
      case 'pause': {
        if (!(await transition(['queued', 'running', 'rate_limited'], { status: 'paused' }))) {
          throw new HttpError(409, 'invalid_state', 'Only a queued or running job can be paused.');
        }
        await addJobEvent(job, 'info', 'Paused by you.');
        return json(req, { jobId: job.id, status: 'paused' });
      }
      case 'resume': {
        if (!(await transition(['paused'], { status: 'queued', next_run_at: null, locked_until: null }))) {
          throw new HttpError(409, 'invalid_state', 'Only a paused job can be resumed.');
        }
        await addJobEvent(job, 'info', 'Resumed by you.');
        kickWorker(job.id);
        return json(req, { jobId: job.id, status: 'queued' });
      }
      case 'cancel': {
        if (!isActive) throw new HttpError(409, 'invalid_state', 'This job has already finished.');
        await cancelActiveJobs(
          job.connection_id,
          'cancelled by you. Pins that were not deleted yet are untouched.',
        );
        return json(req, { jobId: job.id, status: 'cancelled' });
      }
      case 'retry_failed': {
        if (isActive)
          throw new HttpError(409, 'invalid_state', 'Wait for this job to finish before retrying.');
        const conn = await loadConnection(job.connection_id, user.id);
        if (!conn || conn.status !== 'active') {
          throw new HttpError(
            409,
            'connection_inactive',
            'Reconnect this Pinterest account before retrying.',
          );
        }
        const { data: failed, error: fErr } = await db
          .from('delete_job_items')
          .select('pin_id, pinterest_pin_id, title, link, board_name, image_url, created_at_pinterest')
          .eq('job_id', job.id)
          .eq('status', 'failed')
          .not('pin_id', 'is', null)
          .limit(10_000);
        if (fErr) throw new Error(fErr.message);
        const pinIds = (failed ?? []).map((f) => f.pin_id as string);
        const { data: stillThere } = pinIds.length
          ? await db
              .from('pins')
              .select('id')
              .in('id', pinIds.slice(0, 10_000))
              .in('status', ['active', 'failed'])
          : { data: [] };
        const live = new Set((stillThere ?? []).map((p) => p.id as string));
        const items = (failed ?? []).filter((f) => live.has(f.pin_id as string)) as NewItem[];
        if (!items.length)
          throw new HttpError(409, 'nothing_to_retry', 'There are no failed pins left to retry.');

        const ent = computeEntitlement(await getProfilePlan(user.id));
        if (items.length > deletionAllowance(ent)) {
          throw new HttpError(
            402,
            'upgrade_required',
            `Your free plan has ${ent.freeDeletionsRemaining} deletions left.`,
            {
              requested: items.length,
              freeDeletionsRemaining: ent.freeDeletionsRemaining,
              plans: [PLANS.pass, PLANS.agency],
            },
          );
        }
        const newJobId = await createJob({
          userId: user.id,
          connectionId: job.connection_id,
          items,
          dryRun: false,
          parentJobId: job.id,
        });
        await addJobEvent(job, 'info', `Retry started as a new job for ${items.length} failed pins.`);
        return json(req, { jobId: newJobId, status: 'queued' }, 201);
      }
    }
  }),
);
