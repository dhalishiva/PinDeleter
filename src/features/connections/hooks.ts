import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useRealtime } from '@/lib/realtime';
import type { Connection, SyncRun } from '@/lib/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveConnectionStore } from '@/stores/connection';

export function useConnections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: qk.connections,
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pinterest_connections_public')
        .select(
          'id, user_id, pinterest_user_id, username, profile_image, account_type, scopes, last_synced_at, status, last_error, created_at',
        )
        .neq('status', 'revoked')
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as Connection[];
    },
  });
}

/** The connection the app is focused on: ?connection= param, else the remembered one, else the first. */
export function useActiveConnection() {
  const { data: connections, isLoading } = useConnections();
  const [params] = useSearchParams();
  const { activeId, setActive } = useActiveConnectionStore();
  const fromUrl = params.get('connection');
  const active = useMemo(() => {
    const list = connections ?? [];
    return list.find((c) => c.id === fromUrl) ?? list.find((c) => c.id === activeId) ?? list[0] ?? null;
  }, [connections, fromUrl, activeId]);
  useEffect(() => {
    if (active && active.id !== activeId) setActive(active.id);
  }, [active, activeId, setActive]);
  return { connection: active, connections: connections ?? [], isLoading, setActive };
}

export function useStartConnect() {
  return useMutation({
    mutationFn: (reconnectConnectionId?: string) =>
      callFunction<{ url: string }>(
        'pinterest-oauth-start',
        reconnectConnectionId ? { reconnectConnectionId } : {},
      ),
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });
}

export function useStartSync() {
  return useMutation({
    mutationFn: (connectionId: string) =>
      callFunction<{ syncRunId: string }>('pinterest-sync', { connectionId }),
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      callFunction<{ ok: true }>('pinterest-disconnect', { connectionId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.connections });
      void qc.invalidateQueries({ queryKey: qk.jobs });
    },
  });
}

const SYNC_COLUMNS =
  'id, connection_id, status, phase, boards_found, pins_fetched, error, started_at, finished_at';

export function useSyncRun(syncRunId: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.syncRun(syncRunId ?? 'none'),
    enabled: !!syncRunId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select(SYNC_COLUMNS)
        .eq('id', syncRunId!)
        .single();
      if (error) throw error;
      return data as SyncRun;
    },
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 8000 : false),
  });
  useRealtime<Record<string, unknown>>('sync_runs', syncRunId ? `id=eq.${syncRunId}` : null, (payload) => {
    if (payload.eventType === 'UPDATE') {
      qc.setQueryData(qk.syncRun(syncRunId!), (old: SyncRun | undefined) => ({
        ...(old as SyncRun),
        ...(payload.new as Partial<SyncRun>),
      }));
    }
  });
  return query;
}

export function useLatestSync(connectionId: string | null) {
  return useQuery({
    queryKey: qk.latestSync(connectionId ?? 'none'),
    enabled: !!connectionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_runs')
        .select(SYNC_COLUMNS)
        .eq('connection_id', connectionId!)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SyncRun | null) ?? null;
    },
  });
}
