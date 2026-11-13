// Creates a deletion job with its items (used by jobs-create and retry_failed).
import { env } from '../env.ts';
import { HttpError, runInBackground } from '../http.ts';
import { log } from '../log.ts';
import { adminClient } from '../supabase.ts';
import { addJobEvent } from './repo-db.ts';

export interface NewItem {
  pin_id: string;
  pinterest_pin_id: string;
  title: string | null;
  link: string | null;
  board_name: string | null;
  image_url: string | null;
  created_at_pinterest: string | null;
}

const CHUNK = 500;

export async function createJob(p: {
  userId: string;
  connectionId: string;
  items: NewItem[];
  dryRun: boolean;
  parentJobId?: string;
}): Promise<string> {
  const db = adminClient();
  const now = new Date().toISOString();
  const { data: job, error } = await db
    .from('delete_jobs')
    .insert({
      user_id: p.userId,
      connection_id: p.connectionId,
      is_dry_run: p.dryRun,
      total: p.items.length,
      status: p.dryRun ? 'running' : 'queued',
      parent_job_id: p.parentJobId ?? null,
      started_at: p.dryRun ? now : null,
    })
    .select('id, user_id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new HttpError(
        409,
        'job_already_active',
        'This account already has a deletion job in progress. Wait for it to finish or cancel it first.',
      );
    }
    throw new Error(error.message);
  }

  try {
    for (let i = 0; i < p.items.length; i += CHUNK) {
      const rows = p.items.slice(i, i + CHUNK).map((item) => ({
        ...item,
        job_id: job.id,
        user_id: p.userId,
        status: p.dryRun ? 'skipped' : 'pending',
        reason: p.dryRun ? 'dry_run' : null,
        processed_at: p.dryRun ? now : null,
      }));
      const { error: itemErr } = await db.from('delete_job_items').insert(rows);
      if (itemErr) throw new Error(itemErr.message);
      if (!p.dryRun) {
        const { error: pinErr } = await db
          .from('pins')
          .update({ status: 'queued' })
          .in(
            'id',
            rows.map((r) => r.pin_id),
          );
        if (pinErr) throw new Error(pinErr.message);
      }
    }
  } catch (err) {
    // Roll back: remove the half-created job and release its pins.
    await db
      .from('pins')
      .update({ status: 'active' })
      .eq('connection_id', p.connectionId)
      .eq('status', 'queued');
    await db.from('delete_jobs').delete().eq('id', job.id);
    throw err;
  }

  if (p.dryRun) {
    await addJobEvent(
      job,
      'info',
      `Dry run started for ${p.items.length} pins — nothing will be deleted on Pinterest.`,
    );
    await db
      .from('delete_jobs')
      .update({ status: 'completed', skipped_count: p.items.length, finished_at: new Date().toISOString() })
      .eq('id', job.id);
    await addJobEvent(
      job,
      'info',
      `Dry run complete: ${p.items.length} pins would be deleted. Nothing was changed.`,
    );
  } else {
    await addJobEvent(
      job,
      'info',
      p.parentJobId
        ? `Retry job created for ${p.items.length} failed pins.`
        : `Job created for ${p.items.length} pins.`,
    );
    kickWorker(job.id);
  }
  return job.id as string;
}

/** Starts the worker right away instead of waiting for the next cron tick. */
export function kickWorker(jobId: string): void {
  const url = `${env('SUPABASE_URL')}/functions/v1/jobs-worker`;
  runInBackground(
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId }),
    }).then(async (res) => {
      await res.body?.cancel();
      log.info('worker_kicked', { jobId, status: res.status });
    }),
  );
}
