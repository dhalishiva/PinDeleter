import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import type { BoardCount, Pin } from '@/lib/types';
import type { PinQuery } from '@/lib/pinFilters';
import { LIMITS } from '@/config/site';

const PIN_FIELDS =
  'id, connection_id, pinterest_pin_id, board_id, pinterest_board_id, board_name, title, description, link, link_domain, image_url, image_width, image_height, dominant_color, created_at_pinterest, is_owner, saves, clicks, impressions, engagement_fetched_at, status, sort_key';

interface Cursor {
  k: number | string;
  id: string;
}

export function usePins(connectionId: string | null, query: PinQuery) {
  return useInfiniteQuery({
    queryKey: qk.pins(connectionId ?? 'none', query),
    enabled: !!connectionId,
    initialPageParam: null as Cursor | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase
        .rpc('list_pins', {
          p_connection_id: connectionId,
          p_filters: query,
          p_cursor: pageParam,
          p_limit: LIMITS.pageSize,
        })
        .select(PIN_FIELDS);
      if (error) throw error;
      return (data ?? []) as Pin[];
    },
    getNextPageParam: (last): Cursor | null => {
      if (last.length < LIMITS.pageSize) return null;
      const tail = last[last.length - 1]!;
      return { k: tail.sort_key, id: tail.id };
    },
  });
}

export function usePinCount(connectionId: string | null, query: PinQuery) {
  return useQuery({
    queryKey: qk.pinCount(connectionId ?? 'none', query),
    enabled: !!connectionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_pins', {
        p_connection_id: connectionId,
        p_filters: query,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export function useBoards(connectionId: string | null) {
  return useQuery({
    queryKey: qk.boards(connectionId ?? 'none'),
    enabled: !!connectionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('board_pin_counts', { p_connection_id: connectionId });
      if (error) throw error;
      return (data ?? []) as BoardCount[];
    },
  });
}

export async function selectAllMatching(connectionId: string, query: PinQuery): Promise<string[]> {
  const { data, error } = await supabase.rpc('select_pin_ids', {
    p_connection_id: connectionId,
    p_filters: query,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** Loads full rows for selected ids (for the review page and backups). */
export async function fetchPinsByIds(connectionId: string, ids: string[]): Promise<Pin[]> {
  const out: Pin[] = [];
  const boardNames = new Map<string, string>();
  const { data: boards } = await supabase.from('boards').select('id, name').eq('connection_id', connectionId);
  for (const b of boards ?? []) boardNames.set(b.id as string, b.name as string);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from('pins')
      .select(
        'id, connection_id, pinterest_pin_id, board_id, pinterest_board_id, title, description, link, link_domain, image_url, image_width, image_height, dominant_color, created_at_pinterest, is_owner, saves, clicks, impressions, engagement_fetched_at, status',
      )
      .eq('connection_id', connectionId)
      .in('id', ids.slice(i, i + 200));
    if (error) throw error;
    for (const p of (data ?? []) as Omit<Pin, 'board_name' | 'sort_key'>[]) {
      out.push({ ...p, board_name: p.board_id ? (boardNames.get(p.board_id) ?? null) : null, sort_key: 0 });
    }
  }
  return out;
}

export interface EngagementResult {
  processed: number;
  remaining: number;
  rateLimited: boolean;
  retryAfterMs: number | null;
}

export function useLoadEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { connectionId: string; pinterestBoardId?: string; pinIds?: string[] }) =>
      callFunction<EngagementResult>('pins-engagement', body),
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: ['pins', vars.connectionId] });
      void qc.invalidateQueries({ queryKey: ['pinCount', vars.connectionId] });
    },
  });
}

export async function countMissingEngagement(
  connectionId: string,
  pinterestBoardIds: string[],
): Promise<number> {
  let q = supabase
    .from('pins')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .in('status', ['active', 'failed'])
    .is('engagement_fetched_at', null);
  if (pinterestBoardIds.length) q = q.in('pinterest_board_id', pinterestBoardIds);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
