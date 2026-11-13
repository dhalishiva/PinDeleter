// Deletion job processor. Pure orchestration over a JobRepo + PinterestClient, so it is unit-testable.
import type { Entitlement } from '../plans.ts';
import type { DeleteOutcome, PinterestClient } from '../pinterest/types.ts';
import { DEFAULT_RETRY_AFTER_MS } from '../pinterest/types.ts';

export type JobStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'rate_limited'
  | 'completed'
  | 'cancelled'
  | 'failed';
export type ItemStatus = 'pending' | 'deleted' | 'failed' | 'skipped';
export type EventLevel = 'info' | 'warn' | 'error';

export const MAX_ATTEMPTS = 3;
export const EVENT_EVERY = 25;

export interface JobRow {
  id: string;
  user_id: string;
  connection_id: string;
  is_dry_run: boolean;
  status: JobStatus;
  total: number;
  deleted_count: number;
  failed_count: number;
  skipped_count: number;
  rate_limit_pauses: number;
  started_at: string | null;
  created_at: string;
}

export interface ItemRow {
  id: string;
  job_id: string;
  pin_id: string | null;
  pinterest_pin_id: string;
  attempts: number;
}

export interface ItemUpdate {
  status: ItemStatus;
  attempts: number;
  last_http_status: number | null;
  last_error: string | null;
  reason?: string | null;
}

export interface JobRepo {
  getJobStatus(jobId: string): Promise<JobStatus | null>;
  nextPendingItems(jobId: string, limit: number): Promise<ItemRow[]>;
  /** Updates an item only while it is still pending. Returns false if someone else already processed it. */
  updateItem(itemId: string, update: ItemUpdate): Promise<boolean>;
  setPinStatus(pinId: string, status: 'active' | 'deleted' | 'failed'): Promise<void>;
  incrementCounters(
    jobId: string,
    delta: { deleted?: number; failed?: number; skipped?: number },
  ): Promise<JobRow>;
  updateJob(jobId: string, patch: Record<string, unknown>): Promise<void>;
  addEvent(job: Pick<JobRow, 'id' | 'user_id'>, level: EventLevel, message: string): Promise<void>;
  getEntitlement(userId: string): Promise<Entitlement>;
  /** Atomically adds one to profiles.free_deletions_used and returns the new value. */
  chargeFreeDeletion(userId: string): Promise<number>;
  markConnectionError(connectionId: string, message: string): Promise<void>;
  /** pending -> skipped (with reason); their pins return to 'active'. Returns the number of items skipped. */
  skipRemaining(jobId: string, reason: string): Promise<number>;
}

export interface Notifier {
  jobCompleted(job: JobRow): Promise<void>;
  jobFailed(job: JobRow, reason: string, needsReauth: boolean): Promise<void>;
}

export interface ProcessorDeps {
  repo: JobRepo;
  client: PinterestClient;
  notify: Notifier;
  rps: number;
  budgetMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type ItemDecision =
  | { kind: 'deleted' }
  | { kind: 'gone' }
  | { kind: 'rate_limited'; retryAfterMs: number }
  | { kind: 'auth' }
  | { kind: 'retry'; backoffMs: number }
  | { kind: 'failed'; reason: string };

/** Maps one Pinterest delete response to what the worker should do. `attempt` is 1-based (this attempt). */
export function classifyDeleteOutcome(outcome: DeleteOutcome, attempt: number): ItemDecision {
  const s = outcome.status;
  if (s === 200 || s === 204) return { kind: 'deleted' };
  if (s === 404) return { kind: 'gone' };
  if (s === 429)
    return { kind: 'rate_limited', retryAfterMs: outcome.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS };
  if (s === 401) return { kind: 'auth' };
  if (s === 0 || s >= 500 || s === 408) {
    if (attempt < MAX_ATTEMPTS) return { kind: 'retry', backoffMs: 500 * 2 ** (attempt - 1) };
    return { kind: 'failed', reason: `HTTP ${s || 'network error'} after ${MAX_ATTEMPTS} attempts` };
  }
  // Other 4xx (e.g. 403 not your pin) are permanent.
  return { kind: 'failed', reason: outcome.message ? `HTTP ${s}: ${outcome.message}` : `HTTP ${s}` };
}

export interface ProcessResult {
  outcome: 'completed' | 'budget_exhausted' | 'rate_limited' | 'paused' | 'cancelled' | 'failed';
  processed: number;
}

function hhmmss(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19) + ' UTC';
}

export async function processJob(deps: ProcessorDeps, job: JobRow): Promise<ProcessResult> {
  const { repo, client, notify } = deps;
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = now() + deps.budgetMs;
  const minGapMs = 1000 / Math.max(0.1, deps.rps);
  let lastRequestAt = 0;
  let processed = 0;
  let current = job;

  const releaseLock = () => repo.updateJob(job.id, { locked_until: null, locked_by: null });

  const complete = async (): Promise<ProcessResult> => {
    await repo.updateJob(job.id, {
      status: 'completed',
      finished_at: new Date(now()).toISOString(),
      locked_until: null,
      locked_by: null,
    });
    const finalRow = await repo.incrementCounters(job.id, {});
    await repo.addEvent(
      job,
      'info',
      `Completed: ${finalRow.deleted_count} deleted, ${finalRow.failed_count} failed, ${finalRow.skipped_count} skipped.`,
    );
    await notify.jobCompleted(finalRow);
    return { outcome: 'completed', processed };
  };

  const done = current.deleted_count + current.failed_count + current.skipped_count;
  await repo.addEvent(
    job,
    'info',
    done === 0
      ? `Started deleting ${current.total} pins.`
      : `Resumed — ${current.total - done} pins remaining.`,
  );

  let ent = await repo.getEntitlement(job.user_id);
  let freeRemaining = ent.freeDeletionsRemaining;

  while (now() < deadline) {
    const status = await repo.getJobStatus(job.id);
    if (status === 'paused' || status === 'cancelled') {
      await releaseLock();
      return { outcome: status, processed };
    }
    const items = await repo.nextPendingItems(job.id, 25);
    if (items.length === 0) return complete();

    for (const item of items) {
      if (processed > 0 && processed % 10 === 0) {
        const s = await repo.getJobStatus(job.id);
        if (s === 'paused' || s === 'cancelled') {
          await releaseLock();
          return { outcome: s, processed };
        }
      }

      if (!ent.unlimited && freeRemaining <= 0) {
        // Re-check: the user may have just bought a pass.
        ent = await repo.getEntitlement(job.user_id);
        freeRemaining = ent.freeDeletionsRemaining;
        if (!ent.unlimited && freeRemaining <= 0) {
          const skipped = await repo.skipRemaining(job.id, 'free_limit');
          if (skipped > 0) await repo.incrementCounters(job.id, { skipped });
          await repo.addEvent(
            job,
            'warn',
            `Free limit reached — ${skipped} pins were skipped and not deleted. Upgrade to delete the rest.`,
          );
          return complete();
        }
      }

      let attempt = item.attempts;
      // Retry loop for transient errors on this item.
      while (true) {
        if (now() >= deadline) {
          await releaseLock();
          return { outcome: 'budget_exhausted', processed };
        }
        const wait = lastRequestAt + minGapMs - now();
        if (wait > 0) await sleep(wait);
        lastRequestAt = now();
        attempt += 1;
        const outcome = await client.deletePin(item.pinterest_pin_id);
        const decision = classifyDeleteOutcome(outcome, attempt);

        if (decision.kind === 'deleted' || decision.kind === 'gone') {
          const updated = await repo.updateItem(item.id, {
            status: 'deleted',
            attempts: attempt,
            last_http_status: outcome.status,
            last_error: null,
            reason: decision.kind === 'gone' ? 'already_gone' : null,
          });
          if (updated) {
            if (item.pin_id) await repo.setPinStatus(item.pin_id, 'deleted');
            current = await repo.incrementCounters(job.id, { deleted: 1 });
            if (decision.kind === 'deleted' && !ent.unlimited) {
              const used = await repo.chargeFreeDeletion(job.user_id);
              freeRemaining = Math.max(0, ent.freeDeletionsRemaining + ent.freeDeletionsUsed - used);
            }
            if (decision.kind === 'gone') {
              await repo.addEvent(job, 'info', `Pin ${item.pinterest_pin_id} was already gone on Pinterest.`);
            }
            if (current.deleted_count % EVENT_EVERY === 0) {
              await repo.addEvent(job, 'info', `${current.deleted_count} of ${current.total} pins deleted.`);
            }
          }
          processed++;
          break;
        }

        if (decision.kind === 'rate_limited') {
          const resumeAt = now() + decision.retryAfterMs;
          await repo.updateItem(item.id, {
            status: 'pending',
            attempts: attempt - 1, // a rate limit is not a failed attempt
            last_http_status: 429,
            last_error: 'Rate limited',
          });
          await repo.updateJob(job.id, {
            status: 'rate_limited',
            next_run_at: new Date(resumeAt).toISOString(),
            rate_limit_pauses: current.rate_limit_pauses + 1,
            locked_until: null,
            locked_by: null,
          });
          await repo.addEvent(
            job,
            'warn',
            `Pinterest is rate-limiting us. Resuming automatically at ${hhmmss(resumeAt)}.`,
          );
          return { outcome: 'rate_limited', processed };
        }

        if (decision.kind === 'auth') {
          const reason =
            'Pinterest rejected our access to this account (HTTP 401) even after refreshing the token. Please reconnect the account.';
          await repo.markConnectionError(job.connection_id, reason);
          const skipped = await repo.skipRemaining(job.id, 'connection_error');
          const row = await repo.incrementCounters(job.id, { skipped });
          await repo.updateJob(job.id, {
            status: 'failed',
            last_error: reason,
            finished_at: new Date(now()).toISOString(),
            locked_until: null,
            locked_by: null,
          });
          await repo.addEvent(job, 'error', reason);
          await notify.jobFailed(row, reason, true);
          return { outcome: 'failed', processed };
        }

        if (decision.kind === 'retry') {
          await repo.updateItem(item.id, {
            status: 'pending',
            attempts: attempt,
            last_http_status: outcome.status || null,
            last_error: outcome.message ?? 'Transient error',
          });
          await sleep(Math.min(decision.backoffMs, Math.max(0, deadline - now())));
          continue;
        }

        // failed
        const updated = await repo.updateItem(item.id, {
          status: 'failed',
          attempts: attempt,
          last_http_status: outcome.status || null,
          last_error: decision.reason,
        });
        if (updated) {
          if (item.pin_id) await repo.setPinStatus(item.pin_id, 'failed');
          current = await repo.incrementCounters(job.id, { failed: 1 });
          await repo.addEvent(
            job,
            'error',
            `Could not delete pin ${item.pinterest_pin_id}: ${decision.reason}.`,
          );
        }
        processed++;
        break;
      }
    }
  }

  await releaseLock();
  return { outcome: 'budget_exhausted', processed };
}
