import { CheckCircle2, CircleDashed, Clock, Loader2, PauseCircle, Timer, XCircle, Ban } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui';
import { downloadText, dateStamp } from '@/lib/download';
import { reportCsv } from '@/lib/backup';
import { formatTime } from '@/lib/format';
import type { DeleteJob } from '@/lib/types';
import { fetchAllJobItems } from './hooks';

const META: Record<DeleteJob['status'], { tone: Tone; label: string; icon: JSX.Element }> = {
  queued: { tone: 'sky', label: 'Queued', icon: <Clock className="h-3.5 w-3.5" aria-hidden /> },
  running: {
    tone: 'violet',
    label: 'Running',
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />,
  },
  paused: { tone: 'sun', label: 'Paused', icon: <PauseCircle className="h-3.5 w-3.5" aria-hidden /> },
  rate_limited: {
    tone: 'warning',
    label: 'Rate-limited',
    icon: <Timer className="h-3.5 w-3.5" aria-hidden />,
  },
  completed: {
    tone: 'success',
    label: 'Completed',
    icon: <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />,
  },
  cancelled: { tone: 'gray', label: 'Cancelled', icon: <Ban className="h-3.5 w-3.5" aria-hidden /> },
  failed: { tone: 'danger', label: 'Failed', icon: <XCircle className="h-3.5 w-3.5" aria-hidden /> },
};

export function JobStatusPill({ job }: { job: Pick<DeleteJob, 'status' | 'next_run_at' | 'is_dry_run'> }) {
  const m = META[job.status] ?? {
    tone: 'gray' as Tone,
    label: job.status,
    icon: <CircleDashed className="h-3.5 w-3.5" />,
  };
  const label =
    job.status === 'rate_limited' && job.next_run_at
      ? `Rate-limited until ${formatTime(job.next_run_at)}`
      : m.label;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={m.tone} icon={m.icon}>
        {label}
      </Badge>
      {job.is_dry_run && <Badge tone="sun">Dry run</Badge>}
    </span>
  );
}

export async function downloadJobReport(jobId: string): Promise<number> {
  const items = await fetchAllJobItems(jobId);
  downloadText(
    `pindeleter-report-${jobId.slice(0, 8)}-${dateStamp()}.csv`,
    reportCsv(items),
    'text/csv;charset=utf-8',
  );
  return items.length;
}
