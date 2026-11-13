import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Info } from 'lucide-react';
import { Button } from '@/components/Button';
import { ProgressBar } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { formatNumber, formatTime } from '@/lib/format';
import { toast } from '@/stores/ui';
import { countMissingEngagement, useLoadEngagement } from './hooks';

/**
 * Engagement stats are optional and fetched per board (analytics calls are expensive).
 * Shown when the "No engagement" filter is on and some pins in scope have no stats yet.
 */
export function EngagementLoader({ connectionId, boards }: { connectionId: string; boards: string[] }) {
  const qc = useQueryClient();
  const key = ['missingEngagement', connectionId, boards];
  const missing = useQuery({ queryKey: key, queryFn: () => countMissingEngagement(connectionId, boards) });
  const load = useLoadEngagement();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const cancelled = useRef(false);
  useEffect(() => () => void (cancelled.current = true), []);

  const run = async () => {
    const total = missing.data ?? 0;
    cancelled.current = false;
    setRunning(true);
    setProgress({ done: 0, total });
    let done = 0;
    try {
      for (let guard = 0; guard < 500 && !cancelled.current; guard++) {
        const body = { connectionId, ...(boards.length === 1 ? { pinterestBoardId: boards[0] } : {}) };
        const res = await load.mutateAsync(body);
        done += res.processed;
        setProgress({ done, total: Math.max(total, done + res.remaining) });
        if (res.rateLimited) {
          const wait = res.retryAfterMs ?? 60_000;
          setPausedUntil(Date.now() + wait);
          await new Promise((r) => setTimeout(r, wait));
          setPausedUntil(null);
          continue;
        }
        if (res.remaining === 0 || res.processed === 0) break;
        if (boards.length > 1) {
          // Multi-board scope: stop once the selected boards are complete.
          const left = await countMissingEngagement(connectionId, boards);
          if (left === 0) break;
        }
      }
      toast.success('Engagement stats loaded', 'The “No engagement” filter is now accurate for these pins.');
    } catch (err) {
      toast.error('Could not load stats', errorMessage(err));
    } finally {
      setRunning(false);
      void qc.invalidateQueries({ queryKey: ['missingEngagement', connectionId] });
    }
  };

  if (!missing.data && !running) return null;

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-line bg-tint-sun p-4 sm:flex-row sm:items-center">
      <BarChart3 className="h-6 w-6 shrink-0 text-[#5C4A00]" aria-hidden />
      <div className="flex-1 text-sm">
        {running ? (
          <>
            <p className="font-bold" aria-live="polite">
              {pausedUntil
                ? `Pinterest asked us to slow down — continuing at ${formatTime(new Date(pausedUntil).toISOString())}`
                : 'Loading engagement stats…'}{' '}
              {formatNumber(progress.done)} / {formatNumber(progress.total)}
            </p>
            <ProgressBar
              className="mt-2"
              value={progress.done}
              max={Math.max(progress.total, 1)}
              label="Engagement stats progress"
            />
          </>
        ) : (
          <p>
            <strong>{formatNumber(missing.data ?? 0)} pins</strong>{' '}
            {boards.length ? 'on the selected boards ' : ''}don’t have engagement stats yet, so they can’t be
            matched by “No engagement”.{' '}
            <span className="inline-flex items-center gap-1 text-muted">
              <Info className="h-3.5 w-3.5" aria-hidden /> Tip: pick a board first — stats are fetched pin by
              pin (last 90 days).
            </span>
          </p>
        )}
      </div>
      {!running && (
        <Button size="sm" onClick={run}>
          Load engagement stats
        </Button>
      )}
      {running && (
        <Button size="sm" variant="secondary" onClick={() => (cancelled.current = true)}>
          Stop
        </Button>
      )}
    </div>
  );
}
