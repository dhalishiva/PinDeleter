// Creates a deletion job (or a dry run) for pins the user owns on one connection.
import { requireUser } from '../_shared/auth.ts';
import { ACTIVE_JOB_STATUSES } from '../_shared/connections.ts';
import { z } from '../_shared/deps.ts';
import { handler, HttpError, json, parseJson } from '../_shared/http.ts';
import { createJob, type NewItem } from '../_shared/jobs/create.ts';
import { getProfilePlan } from '../_shared/jobs/repo-db.ts';
import { loadConnection } from '../_shared/pinterest/index.ts';
import { computeEntitlement, deletionAllowance, PLANS } from '../_shared/plans.ts';
import { adminClient } from '../_shared/supabase.ts';

const Body = z.object({
  connectionId: z.string().uuid(),
  pinIds: z.array(z.string().uuid()).min(1).max(10_000),
  dryRun: z.boolean().default(false),
  backupConfirmed: z.boolean().default(false),
});

Deno.serve(
  handler({ name: 'jobs-create', methods: ['POST'] }, async (req) => {
    const user = await requireUser(req);
    const body = await parseJson(req, Body);
    const pinIds = [...new Set(body.pinIds)];
    if (!body.dryRun && !body.backupConfirmed) {
      throw new HttpError(
        400,
        'backup_required',
        'Please download your backup and confirm it before deleting.',
      );
    }

    const conn = await loadConnection(body.connectionId, user.id);
    if (!conn) throw new HttpError(404, 'not_found', 'Connection not found.');
    if (conn.status !== 'active')
      throw new HttpError(409, 'connection_inactive', 'Reconnect this Pinterest account first.');

    const db = adminClient();
    const { data: active } = await db
      .from('delete_jobs')
      .select('id')
      .eq('connection_id', conn.id)
      .in('status', [...ACTIVE_JOB_STATUSES])
      .limit(1);
    if (active?.length) {
      throw new HttpError(409, 'job_already_active', 'This account already has a deletion job in progress.', {
        jobId: active[0]!.id,
      });
    }

    if (!body.dryRun) {
      const ent = computeEntitlement(await getProfilePlan(user.id));
      const allowance = deletionAllowance(ent);
      if (pinIds.length > allowance) {
        throw new HttpError(
          402,
          'upgrade_required',
          `Your free plan has ${ent.freeDeletionsRemaining} deletions left.`,
          {
            requested: pinIds.length,
            freeDeletionsRemaining: ent.freeDeletionsRemaining,
            plans: [PLANS.pass, PLANS.agency],
          },
        );
      }
    }

    // Ownership: every pin must belong to this user + connection and still be on Pinterest.
    const { data: boards } = await db.from('boards').select('id, name').eq('connection_id', conn.id);
    const boardNames = new Map((boards ?? []).map((b) => [b.id as string, b.name as string]));
    const items: NewItem[] = [];
    for (let i = 0; i < pinIds.length; i += 500) {
      const chunk = pinIds.slice(i, i + 500);
      const { data, error } = await db
        .from('pins')
        .select('id, pinterest_pin_id, title, link, board_id, image_url, created_at_pinterest, status')
        .eq('user_id', user.id)
        .eq('connection_id', conn.id)
        .in('id', chunk);
      if (error) throw new Error(error.message);
      for (const p of data ?? []) {
        if (p.status !== 'active' && p.status !== 'failed') continue;
        items.push({
          pin_id: p.id,
          pinterest_pin_id: p.pinterest_pin_id,
          title: p.title,
          link: p.link,
          board_name: p.board_id ? (boardNames.get(p.board_id) ?? null) : null,
          image_url: p.image_url?.startsWith('data:') ? null : p.image_url,
          created_at_pinterest: p.created_at_pinterest,
        });
      }
    }
    if (items.length !== pinIds.length) {
      throw new HttpError(
        409,
        'pins_unavailable',
        `${pinIds.length - items.length} of the selected pins are no longer available (already deleted, queued or not yours). Refresh and try again.`,
      );
    }

    const jobId = await createJob({ userId: user.id, connectionId: conn.id, items, dryRun: body.dryRun });
    return json(req, { jobId }, 201);
  }),
);
