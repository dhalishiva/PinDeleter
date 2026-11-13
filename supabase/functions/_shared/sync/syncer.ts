// Resumable Pinterest → database sync. Each step runs within a time budget and stores its cursor;
// sync-worker continues unfinished runs every minute.
import { errorFields, log } from '../log.ts';
import { clientForConnection, loadConnection } from '../pinterest/index.ts';
import { PinterestApiError, type PinterestPin } from '../pinterest/types.ts';
import { adminClient } from '../supabase.ts';

export interface SyncRunRow {
  id: string;
  connection_id: string;
  user_id: string;
  status: 'running' | 'completed' | 'failed';
  phase: 'boards' | 'pins' | 'finalize' | 'done';
  boards_found: number;
  pins_fetched: number;
  board_index: number;
  cursor: string | null;
  started_at: string;
}

export const SYNC_RUN_COLUMNS =
  'id, connection_id, user_id, status, phase, boards_found, pins_fetched, board_index, cursor, started_at';

const BATCH = 250;

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

async function saveRun(id: string, patch: Partial<SyncRunRow> & Record<string, unknown>) {
  const { error } = await adminClient().from('sync_runs').update(patch).eq('id', id);
  check(error);
}

export function pinRow(
  pin: PinterestPin,
  ctx: { connectionId: string; userId: string; boardId: string | null; now: string },
) {
  return {
    connection_id: ctx.connectionId,
    user_id: ctx.userId,
    pinterest_pin_id: pin.id,
    board_id: ctx.boardId,
    pinterest_board_id: pin.boardId,
    title: pin.title?.slice(0, 500) ?? null,
    description: pin.description?.slice(0, 2000) ?? null,
    link: pin.link?.slice(0, 2000) ?? null,
    image_url: pin.imageUrl,
    image_width: pin.imageWidth,
    image_height: pin.imageHeight,
    dominant_color: pin.dominantColor,
    created_at_pinterest: pin.createdAt,
    is_owner: pin.isOwner,
    synced_at: ctx.now,
  };
}

/** Creates a run (or returns the one already running for this connection). */
export async function startSyncRun(connectionId: string, userId: string): Promise<SyncRunRow> {
  const { data: existing, error: exErr } = await adminClient()
    .from('sync_runs')
    .select(SYNC_RUN_COLUMNS)
    .eq('connection_id', connectionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  check(exErr);
  if (existing) return existing as SyncRunRow;
  const { data, error } = await adminClient()
    .from('sync_runs')
    .insert({
      connection_id: connectionId,
      user_id: userId,
      locked_until: new Date(Date.now() + 75_000).toISOString(),
    })
    .select(SYNC_RUN_COLUMNS)
    .single();
  check(error);
  return data as SyncRunRow;
}

/** Runs one time-boxed step of a sync. Safe to call repeatedly until the run is completed. */
export async function runSyncStep(run: SyncRunRow, budgetMs = 40_000): Promise<SyncRunRow['status']> {
  const deadline = Date.now() + budgetMs;
  const conn = await loadConnection(run.connection_id);
  if (!conn || conn.status !== 'active') {
    await saveRun(run.id, {
      status: 'failed',
      error: 'This Pinterest account is no longer connected.',
      finished_at: new Date().toISOString(),
      locked_until: null,
    });
    return 'failed';
  }
  const client = clientForConnection(conn);
  const state = { ...run };

  try {
    while (Date.now() < deadline && state.phase !== 'done') {
      if (state.phase === 'boards') {
        const page = await client.listBoards(state.cursor);
        const now = new Date().toISOString();
        if (page.items.length) {
          const { error } = await adminClient()
            .from('boards')
            .upsert(
              page.items.map((b) => ({
                connection_id: conn.id,
                user_id: conn.user_id,
                pinterest_board_id: b.id,
                name: b.name.slice(0, 200),
                description: b.description?.slice(0, 1000) ?? null,
                pin_count: b.pinCount,
                privacy: b.privacy,
                synced_at: now,
              })),
              { onConflict: 'connection_id,pinterest_board_id' },
            );
          check(error);
        }
        state.boards_found += page.items.length;
        state.cursor = page.bookmark;
        if (!page.bookmark) {
          state.phase = 'pins';
          state.board_index = 0;
        }
        await saveRun(run.id, {
          phase: state.phase,
          boards_found: state.boards_found,
          cursor: state.cursor,
          board_index: state.board_index,
        });
        continue;
      }

      if (state.phase === 'pins') {
        const { data: boards, error } = await adminClient()
          .from('boards')
          .select('id, pinterest_board_id')
          .eq('connection_id', conn.id)
          .gte('synced_at', run.started_at)
          .order('pinterest_board_id');
        check(error);
        const board = boards?.[state.board_index];
        if (!board) {
          state.phase = 'finalize';
          await saveRun(run.id, { phase: 'finalize', cursor: null });
          continue;
        }
        const page = await client.listBoardPins(board.pinterest_board_id as string, state.cursor);
        const now = new Date().toISOString();
        for (let i = 0; i < page.items.length; i += BATCH) {
          const rows = page.items
            .slice(i, i + BATCH)
            .map((p) =>
              pinRow(p, { connectionId: conn.id, userId: conn.user_id, boardId: board.id as string, now }),
            );
          const { error: upErr } = await adminClient()
            .from('pins')
            .upsert(rows, { onConflict: 'connection_id,pinterest_pin_id' });
          check(upErr);
        }
        state.pins_fetched += page.items.length;
        state.cursor = page.bookmark;
        if (!page.bookmark) {
          state.board_index += 1;
          state.cursor = null;
        }
        await saveRun(run.id, {
          pins_fetched: state.pins_fetched,
          cursor: state.cursor,
          board_index: state.board_index,
        });
        continue;
      }

      if (state.phase === 'finalize') {
        // Pins we have cached that Pinterest no longer returns are gone.
        const { error: goneErr } = await adminClient()
          .from('pins')
          .update({ status: 'deleted' })
          .eq('connection_id', conn.id)
          .lt('synced_at', run.started_at)
          .in('status', ['active', 'failed']);
        check(goneErr);
        const { error: boardsErr } = await adminClient()
          .from('boards')
          .delete()
          .eq('connection_id', conn.id)
          .lt('synced_at', run.started_at);
        check(boardsErr);
        const finished = new Date().toISOString();
        const { error: connErr } = await adminClient()
          .from('pinterest_connections')
          .update({ last_synced_at: finished })
          .eq('id', conn.id);
        check(connErr);
        state.phase = 'done';
        state.status = 'completed';
        await saveRun(run.id, {
          phase: 'done',
          status: 'completed',
          finished_at: finished,
          cursor: null,
          locked_until: null,
          error: null,
        });
        log.info('sync_completed', {
          syncRunId: run.id,
          boards: state.boards_found,
          pins: state.pins_fetched,
        });
        return 'completed';
      }
    }
    // Out of time: release the lease so sync-worker picks it up next minute.
    await saveRun(run.id, { locked_until: null });
    return 'running';
  } catch (err) {
    if (err instanceof PinterestApiError && err.status === 429) {
      const wait = err.retryAfterMs ?? 60_000;
      await saveRun(run.id, {
        locked_until: new Date(Date.now() + wait).toISOString(),
        error: 'Pinterest is rate-limiting us — the sync will continue automatically.',
      });
      return 'running';
    }
    if (err instanceof PinterestApiError && err.status === 401) {
      const msg = 'Pinterest rejected our access. Please reconnect this account.';
      await adminClient()
        .from('pinterest_connections')
        .update({ status: 'error', last_error: msg })
        .eq('id', conn.id);
      await saveRun(run.id, {
        status: 'failed',
        error: msg,
        finished_at: new Date().toISOString(),
        locked_until: null,
      });
      return 'failed';
    }
    log.error('sync_step_failed', { syncRunId: run.id, ...errorFields(err) });
    const transient = err instanceof PinterestApiError && (err.status === 0 || err.status >= 500);
    if (transient) {
      await saveRun(run.id, {
        locked_until: new Date(Date.now() + 60_000).toISOString(),
        error: 'Pinterest had a temporary problem — retrying shortly.',
      });
      return 'running';
    }
    await saveRun(run.id, {
      status: 'failed',
      error: err instanceof Error ? err.message.slice(0, 300) : 'Sync failed',
      finished_at: new Date().toISOString(),
      locked_until: null,
    });
    return 'failed';
  }
}
