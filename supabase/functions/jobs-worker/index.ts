// Cron (every minute) + kicked by jobs-create: claims runnable jobs with a lease and processes them.
import { requireServiceRole } from '../_shared/auth.ts';
import { z } from '../_shared/deps.ts';
import { numberEnv } from '../_shared/env.ts';
import { handler, json, parseJson } from '../_shared/http.ts';
import { type JobRow, processJob } from '../_shared/jobs/processor.ts';
import { dbJobRepo, emailNotifier } from '../_shared/jobs/repo-db.ts';
import { errorFields, log } from '../_shared/log.ts';
import { clientForConnection, loadConnection } from '../_shared/pinterest/index.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({ jobId: z.string().uuid().optional() });
const BUDGET_MS = 45_000;

Deno.serve(
  handler({ name: 'jobs-worker', methods: ['POST'] }, async (req) => {
    requireServiceRole(req);
    const { jobId } = await parseJson(req, Body);
    const workerId = crypto.randomUUID();
    const { data, error } = await adminClient().rpc('claim_delete_jobs', {
      p_worker: workerId,
      p_limit: jobId ? 1 : 3,
      p_job_id: jobId ?? null,
    });
    if (error) throw new Error(error.message);
    const jobs = (data ?? []) as JobRow[];

    const results = await Promise.all(
      jobs.map(async (job) => {
        try {
          const conn = await loadConnection(job.connection_id);
          if (!conn || conn.status !== 'active') {
            const reason = 'The Pinterest account is no longer connected. Reconnect it and start a new job.';
            const skipped = await dbJobRepo.skipRemaining(job.id, 'connection_error');
            const row = await dbJobRepo.incrementCounters(job.id, { skipped });
            await dbJobRepo.updateJob(job.id, {
              status: 'failed',
              last_error: reason,
              finished_at: new Date().toISOString(),
              locked_until: null,
            });
            await dbJobRepo.addEvent(job, 'error', reason);
            await emailNotifier.jobFailed(row, reason, true);
            return { jobId: job.id, outcome: 'failed' };
          }
          const result = await processJob(
            {
              repo: dbJobRepo,
              client: clientForConnection(conn),
              notify: emailNotifier,
              rps: numberEnv('DELETE_RPS', 5),
              budgetMs: BUDGET_MS,
            },
            job,
          );
          return { jobId: job.id, ...result };
        } catch (err) {
          log.error('job_processing_error', { jobId: job.id, ...errorFields(err) });
          // Release the lease; the next tick retries.
          await adminClient()
            .from('delete_jobs')
            .update({ locked_until: null, last_error: 'Temporary worker error, retrying.' })
            .eq('id', job.id);
          return { jobId: job.id, outcome: 'error' };
        }
      }),
    );
    return json(req, { worker: workerId, claimed: jobs.length, results });
  }),
);
