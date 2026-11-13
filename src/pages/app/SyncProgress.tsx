import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Boxes, Grid3x3 } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { Card, ProgressBar, Spinner } from '@/components/ui';
import { StatTile } from '@/components/widgets';
import { SuccessIllustration } from '@/components/Illustrations';
import { useConnections, useLatestSync, useSyncRun } from '@/features/connections/hooks';
import { qk } from '@/lib/queryClient';

const PHASES = {
  boards: 'Finding your boards…',
  pins: 'Fetching your pins…',
  finalize: 'Tidying up…',
  done: 'All done!',
} as const;

export default function SyncProgress() {
  const { connectionId } = useParams();
  const [params] = useSearchParams();
  const qc = useQueryClient();
  const latest = useLatestSync(params.get('run') ? null : (connectionId ?? null));
  const runId = params.get('run') ?? latest.data?.id ?? null;
  const { data: run } = useSyncRun(runId);
  const { data: connections } = useConnections();
  const conn = connections?.find((c) => c.id === connectionId);

  useEffect(() => {
    if (run?.status === 'completed') {
      void qc.invalidateQueries({ queryKey: qk.connections });
      void qc.invalidateQueries({ queryKey: ['pins', connectionId] });
      void qc.invalidateQueries({ queryKey: ['boards', connectionId] });
    }
  }, [run?.status, qc, connectionId]);

  // Progress estimate: boards phase ≈ 10%, pins phase up to 95%, finalize 98%.
  const pct = !run
    ? 2
    : run.status === 'completed'
      ? 100
      : run.phase === 'boards'
        ? 8
        : run.phase === 'finalize'
          ? 97
          : Math.min(94, 12 + Math.log10(1 + run.pins_fetched) * 22);

  return (
    <>
      <Seo title="Syncing" noindex path="/app/accounts/sync" />
      <div className="mx-auto max-w-2xl">
        <Card className="p-6 text-center sm:p-10">
          {run?.status === 'completed' ? (
            <SuccessIllustration className="mx-auto h-32 w-32" />
          ) : run?.status === 'failed' ? (
            <AlertTriangle className="mx-auto h-14 w-14 text-warning" aria-hidden />
          ) : (
            <Spinner className="mx-auto h-12 w-12" />
          )}
          <h1 className="mt-5 text-3xl">
            {run?.status === 'completed'
              ? 'Sync complete'
              : run?.status === 'failed'
                ? 'Sync stopped'
                : `Syncing${conn ? ` @${conn.username}` : ''}`}
          </h1>
          <p className="mt-2 text-muted" aria-live="polite">
            {run?.status === 'failed' ? run.error : run ? PHASES[run.phase] : 'Starting…'}
            {run?.status === 'running' && run.error ? ` ${run.error}` : ''}
          </p>
          <ProgressBar value={pct} className="mt-6" label="Sync progress" />
          <div className="mt-6 grid grid-cols-2 gap-4">
            <StatTile
              label="Boards found"
              value={run?.boards_found ?? 0}
              tone="violet"
              icon={<Boxes className="h-5 w-5 text-violet" aria-hidden />}
            />
            <StatTile
              label="Pins fetched"
              value={run?.pins_fetched ?? 0}
              tone="pink"
              icon={<Grid3x3 className="h-5 w-5 text-primary" aria-hidden />}
            />
          </div>
          {run?.status === 'running' && (
            <p className="mt-6 text-sm text-muted">
              Big account? You can leave this page — the sync keeps running in the background.
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {run?.status === 'completed' && (
              <ButtonLink
                to={`/app/pins?connection=${connectionId}`}
                size="lg"
                icon={<ArrowRight className="h-5 w-5" aria-hidden />}
              >
                Start filtering pins
              </ButtonLink>
            )}
            {run?.status === 'failed' && <ButtonLink to="/app/accounts">Back to accounts</ButtonLink>}
            {run?.status === 'running' && (
              <ButtonLink to={`/app/pins?connection=${connectionId}`} variant="secondary">
                Browse pins fetched so far
              </ButtonLink>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
