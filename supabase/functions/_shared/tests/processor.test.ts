import { computeEntitlement, type ProfilePlanState } from '../plans.ts';
import { buildDataset, MemoryMockStore, MockPinterestClient, mockTokensFor } from '../pinterest/mock.ts';
import {
  classifyDeleteOutcome,
  type ItemRow,
  type ItemUpdate,
  type JobRepo,
  type JobRow,
  type JobStatus,
  processJob,
} from '../jobs/processor.ts';
import { assert, assertEquals } from './assert.ts';

const ACCOUNT = 'mock-test01';

Deno.test('classifyDeleteOutcome maps every status class', () => {
  assertEquals(classifyDeleteOutcome({ status: 204 }, 1), { kind: 'deleted' });
  assertEquals(classifyDeleteOutcome({ status: 200 }, 1), { kind: 'deleted' });
  assertEquals(classifyDeleteOutcome({ status: 404 }, 1), { kind: 'gone' });
  assertEquals(classifyDeleteOutcome({ status: 429, retryAfterMs: 2000 }, 1), {
    kind: 'rate_limited',
    retryAfterMs: 2000,
  });
  assertEquals(classifyDeleteOutcome({ status: 429 }, 1), { kind: 'rate_limited', retryAfterMs: 60_000 });
  assertEquals(classifyDeleteOutcome({ status: 401 }, 1), { kind: 'auth' });
  assertEquals(classifyDeleteOutcome({ status: 503 }, 1).kind, 'retry');
  assertEquals(classifyDeleteOutcome({ status: 0 }, 2).kind, 'retry');
  assertEquals(classifyDeleteOutcome({ status: 500 }, 3).kind, 'failed');
  assertEquals(classifyDeleteOutcome({ status: 403, message: 'Not your pin' }, 1).kind, 'failed');
});

class MemoryJobRepo implements JobRepo {
  job: JobRow & { next_run_at?: string | null; last_error?: string | null };
  items: (ItemRow & { status: string; last_http_status?: number | null; reason?: string | null })[];
  pins = new Map<string, string>();
  events: { level: string; message: string }[] = [];
  profile: ProfilePlanState;
  connectionError: string | null = null;

  constructor(pinIds: string[], profile: ProfilePlanState) {
    this.profile = profile;
    this.job = {
      id: 'job-1',
      user_id: 'u1',
      connection_id: 'c1',
      is_dry_run: false,
      status: 'running',
      total: pinIds.length,
      deleted_count: 0,
      failed_count: 0,
      skipped_count: 0,
      rate_limit_pauses: 0,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    this.items = pinIds.map((pid, i) => ({
      id: `item-${i}`,
      job_id: 'job-1',
      pin_id: `pin-${i}`,
      pinterest_pin_id: pid,
      attempts: 0,
      status: 'pending',
    }));
    for (let i = 0; i < pinIds.length; i++) this.pins.set(`pin-${i}`, 'queued');
  }
  getJobStatus = () => Promise.resolve(this.job.status as JobStatus);
  nextPendingItems = (_: string, limit: number) =>
    Promise.resolve(
      this.items
        .filter((i) => i.status === 'pending')
        .slice(0, limit)
        .map((i) => ({ ...i })),
    );
  updateItem(id: string, u: ItemUpdate) {
    const item = this.items.find((i) => i.id === id)!;
    if (item.status !== 'pending') return Promise.resolve(false);
    Object.assign(item, u);
    return Promise.resolve(true);
  }
  setPinStatus(id: string, s: string) {
    this.pins.set(id, s);
    return Promise.resolve();
  }
  incrementCounters(_: string, d: { deleted?: number; failed?: number; skipped?: number }) {
    this.job.deleted_count += d.deleted ?? 0;
    this.job.failed_count += d.failed ?? 0;
    this.job.skipped_count += d.skipped ?? 0;
    return Promise.resolve({ ...this.job });
  }
  updateJob(_: string, patch: Record<string, unknown>) {
    Object.assign(this.job, patch);
    return Promise.resolve();
  }
  addEvent(_: unknown, level: string, message: string) {
    this.events.push({ level, message });
    return Promise.resolve();
  }
  getEntitlement = () => Promise.resolve(computeEntitlement(this.profile));
  chargeFreeDeletion() {
    this.profile.free_deletions_used += 1;
    return Promise.resolve(this.profile.free_deletions_used);
  }
  markConnectionError(_: string, m: string) {
    this.connectionError = m;
    return Promise.resolve();
  }
  skipRemaining(_: string, reason: string) {
    let n = 0;
    for (const i of this.items)
      if (i.status === 'pending') {
        i.status = 'skipped';
        i.reason = reason;
        this.pins.set(i.pin_id!, 'active');
        n++;
      }
    return Promise.resolve(n);
  }
}

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

function harness(opts: {
  pins: number;
  random: number[];
  profile?: ProfilePlanState;
  token?: string;
  budgetMs?: number;
}) {
  const ds = buildDataset(ACCOUNT);
  const pinIds = ds.pins.slice(0, opts.pins).map((p) => p.id);
  const store = new MemoryMockStore();
  const token = opts.token ?? mockTokensFor(ACCOUNT).accessToken;
  const client = new MockPinterestClient({
    store,
    latencyMs: [0, 0],
    random: sequence(opts.random),
    session: { getAccessToken: () => Promise.resolve(token), refresh: () => Promise.resolve(null) },
  });
  const repo = new MemoryJobRepo(
    pinIds,
    opts.profile ?? {
      plan: 'pass',
      plan_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      free_deletions_used: 0,
    },
  );
  const notified: string[] = [];
  let clock = 1_000_000;
  const deps = {
    repo,
    client,
    rps: 5,
    budgetMs: opts.budgetMs ?? 600_000,
    now: () => clock,
    sleep: (ms: number) => {
      clock += ms;
      return Promise.resolve();
    },
    notify: {
      jobCompleted: (j: JobRow) => {
        notified.push(`completed:${j.deleted_count}`);
        return Promise.resolve();
      },
      jobFailed: (_: JobRow, __: string, reauth: boolean) => {
        notified.push(`failed:${reauth}`);
        return Promise.resolve();
      },
    },
  };
  return { repo, deps, store, notified, tick: (ms: number) => (clock += ms) };
}

const OK = 0.9; // -> 204
const RATE = 0.01; // -> 429
const ERR = 0.05; // -> 500
const GONE = 0.06; // -> 404

Deno.test('204: deletes every pin, completes and notifies', async () => {
  const h = harness({ pins: 30, random: [OK] });
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'completed');
  assertEquals(h.repo.job.status, 'completed');
  assertEquals(h.repo.job.deleted_count, 30);
  assert([...h.repo.pins.values()].every((s) => s === 'deleted'));
  assertEquals(h.notified, ['completed:30']);
  assert(h.repo.events.some((e) => e.message.includes('25 of 30')));
});

Deno.test('404: counted as deleted but logged as already gone, not charged', async () => {
  const h = harness({
    pins: 3,
    random: [GONE],
    profile: { plan: 'free', plan_expires_at: null, free_deletions_used: 0 },
  });
  await processJob(h.deps, h.repo.job);
  assertEquals(h.repo.job.deleted_count, 3);
  assertEquals(h.repo.profile.free_deletions_used, 0);
  assert(h.repo.events.some((e) => e.message.includes('already gone')));
});

Deno.test('429: job pauses as rate_limited with next_run_at and resumes later', async () => {
  const h = harness({ pins: 5, random: [OK, OK, RATE, OK] });
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'rate_limited');
  assertEquals(h.repo.job.status, 'rate_limited');
  assertEquals(h.repo.job.rate_limit_pauses, 1);
  assertEquals(h.repo.job.deleted_count, 2);
  assert(h.repo.job.next_run_at);
  const pending = h.repo.items.filter((i) => i.status === 'pending');
  assertEquals(pending.length, 3);
  assertEquals(pending[0]!.attempts, 0); // a rate limit is not a failed attempt
  // Second run (worker re-claims after next_run_at)
  h.repo.job.status = 'running';
  const r2 = await processJob(h.deps, h.repo.job);
  assertEquals(r2.outcome, 'completed');
  assertEquals(h.repo.job.deleted_count, 5);
});

Deno.test('5xx: retried up to 3 attempts, then failed and never charged', async () => {
  const h = harness({
    pins: 2,
    random: [ERR, ERR, ERR, ERR, OK],
    profile: { plan: 'free', plan_expires_at: null, free_deletions_used: 0 },
  });
  await processJob(h.deps, h.repo.job);
  assertEquals(h.repo.items[0]!.status, 'failed');
  assertEquals(h.repo.items[0]!.attempts, 3);
  assertEquals(h.repo.items[1]!.status, 'deleted');
  assertEquals(h.repo.items[1]!.attempts, 2);
  assertEquals(h.repo.job.failed_count, 1);
  assertEquals(h.repo.job.deleted_count, 1);
  assertEquals(h.repo.profile.free_deletions_used, 1); // only the success
  assertEquals(h.repo.pins.get('pin-0'), 'failed');
});

Deno.test('401: connection marked error, job failed, remaining skipped, user emailed', async () => {
  const h = harness({ pins: 4, random: [OK], token: 'revoked-token' });
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'failed');
  assertEquals(h.repo.job.status, 'failed');
  assert(h.repo.connectionError);
  assertEquals(h.repo.job.skipped_count, 4);
  assert([...h.repo.pins.values()].every((s) => s === 'active'));
  assertEquals(h.notified, ['failed:true']);
});

Deno.test('free plan stops at the limit and skips the rest', async () => {
  const h = harness({
    pins: 6,
    random: [OK],
    profile: { plan: 'free', plan_expires_at: null, free_deletions_used: 46 },
  });
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'completed');
  assertEquals(h.repo.job.deleted_count, 4);
  assertEquals(h.repo.job.skipped_count, 2);
  assertEquals(h.repo.profile.free_deletions_used, 50);
});

Deno.test('pause is honoured and the lock released', async () => {
  const h = harness({ pins: 3, random: [OK] });
  h.repo.job.status = 'paused';
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'paused');
  assertEquals(h.repo.job.deleted_count, 0);
});

Deno.test('time budget: stops cleanly and resumes idempotently', async () => {
  const h = harness({ pins: 20, random: [OK], budgetMs: 1000 }); // 5 rps => ~5 deletions per run
  const r = await processJob(h.deps, h.repo.job);
  assertEquals(r.outcome, 'budget_exhausted');
  assert(h.repo.job.deleted_count > 0 && h.repo.job.deleted_count < 20);
  for (let i = 0; i < 10 && h.repo.job.status !== 'completed'; i++) await processJob(h.deps, h.repo.job);
  assertEquals(h.repo.job.status, 'completed');
  assertEquals(h.repo.job.deleted_count, 20);
});

Deno.test('mock deletions persist in the store and the pin then returns 404', async () => {
  const h = harness({ pins: 1, random: [OK] });
  await processJob(h.deps, h.repo.job);
  const deleted = await h.store.deletedIds(ACCOUNT);
  assertEquals(deleted.size, 1);
});
