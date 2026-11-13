import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { callFunction } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useRealtime } from '@/lib/realtime';
import type { DeleteJob, JobEvent, JobItem } from '@/lib/types';
import { LIMITS } from '@/config/site';

export const JOB_FIELDS =
  'id, user_id, connection_id, parent_job_id, is_dry_run, status, total, deleted_count, failed_count, skipped_count, rate_limit_pauses, next_run_at, started_at, finished_at, last_error, created_at';

export const ACTIVE_STATUSES = ['queued', 'running', 'paused', 'rate_limited'] as const;
export const isActiveJob = (status: DeleteJob['status']) =>
  (ACTIVE_STATUSES as readonly string[]).includes(status);

export function useJobs(limit = 50) {
  return useQuery({
    queryKey: [...qk.jobs, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delete_jobs')
        .select(JOB_FIELDS)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as DeleteJob[];
    },
  });
}

export function useJob(jobId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.job(jobId ?? 'none'),
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase.from('delete_jobs').select(JOB_FIELDS).eq('id', jobId!).single();
      if (error) throw error;
      return data as DeleteJob;
    },
    // Safety net in case a Realtime message is missed.
    refetchInterval: (q) => (q.state.data && isActiveJob(q.state.data.status) ? 15_000 : false),
  });
  useRealtime<Record<string, unknown>>('delete_jobs', jobId ? `id=eq.${jobId}` : null, (payload) => {
    if (payload.eventType === 'UPDATE') {
      qc.setQueryData(qk.job(jobId!), (old: DeleteJob | undefined) => ({
        ...(old as DeleteJob),
        ...(payload.new as Partial<DeleteJob>),
      }));
      void qc.invalidateQueries({ queryKey: qk.jobPending(jobId!) });
    }
  });
  return query;
}

export function useJobEvents(jobId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.jobEvents(jobId ?? 'none'),
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_events')
        .select('id, job_id, level, message, created_at')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: false })
        .limit(LIMITS.jobEventsShown);
      if (error) throw error;
      return (data ?? []) as JobEvent[];
    },
  });
  useRealtime<Record<string, unknown>>('job_events', jobId ? `job_id=eq.${jobId}` : null, (payload) => {
    if (payload.eventType === 'INSERT') {
      const ev = payload.new as unknown as JobEvent;
      qc.setQueryData(qk.jobEvents(jobId!), (old: JobEvent[] | undefined) =>
        [ev, ...(old ?? []).filter((e) => e.id !== ev.id)].slice(0, LIMITS.jobEventsShown),
      );
    }
  });
  return query;
}

/** A few upcoming items, for the "sweep" animation on the job page. */
export function useJobPending(jobId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.jobPending(jobId ?? 'none'),
    enabled: !!jobId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delete_job_items')
        .select('id, pinterest_pin_id, title, image_url, board_name')
        .eq('job_id', jobId!)
        .eq('status', 'pending')
        .order('created_at')
        .order('id')
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Pick<
        JobItem,
        'id' | 'pinterest_pin_id' | 'title' | 'image_url' | 'board_name'
      >[];
    },
    staleTime: 1500,
  });
}

export async function fetchAllJobItems(jobId: string): Promise<JobItem[]> {
  const out: JobItem[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('delete_job_items')
      .select(
        'id, job_id, pinterest_pin_id, status, reason, attempts, last_http_status, last_error, processed_at, title, link, board_name, image_url, created_at_pinterest',
      )
      .eq('job_id', jobId)
      .order('created_at')
      .order('id')
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as JobItem[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      connectionId: string;
      pinIds: string[];
      dryRun: boolean;
      backupConfirmed: boolean;
    }) => callFunction<{ jobId: string }>('jobs-create', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: ['pins'] });
      void qc.invalidateQueries({ queryKey: ['pinCount'] });
      void qc.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useJobControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { jobId: string; action: 'pause' | 'resume' | 'cancel' | 'retry_failed' }) =>
      callFunction<{ jobId: string; status: string }>('jobs-control', body),
    onSuccess: (_r, vars) => {
      void qc.invalidateQueries({ queryKey: qk.job(vars.jobId) });
      void qc.invalidateQueries({ queryKey: qk.jobs });
      void qc.invalidateQueries({ queryKey: ['pins'] });
    },
  });
}
