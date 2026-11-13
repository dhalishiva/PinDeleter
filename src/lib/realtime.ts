import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { isConfigured } from './env';

/** Subscribes to Postgres changes for one table/filter. RLS makes sure only the user's rows arrive. */
export function useRealtime<T extends Record<string, unknown>>(
  table: 'sync_runs' | 'delete_jobs' | 'job_events',
  filter: string | null,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!isConfigured || !filter) return;
    const channel = supabase
      .channel(`${table}:${filter}:${Math.random().toString(36).slice(2)}`)
      .on<T>('postgres_changes', { event: '*', schema: 'public', table, filter }, (payload) =>
        cb.current(payload),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
