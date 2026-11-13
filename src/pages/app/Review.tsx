import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeft,
  Crown,
  FileJson,
  FileSpreadsheet,
  FlaskConical,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button, ButtonLink } from '@/components/Button';
import { Badge, Card, Checkbox, Input, Label, Skeleton, Switch, boardTone, toneClass } from '@/components/ui';
import { EmptyState } from '@/components/widgets';
import { EmptyPinsIllustration } from '@/components/Illustrations';
import { Checkout } from '@/features/billing/Checkout';
import { useConnections } from '@/features/connections/hooks';
import { fetchPinsByIds } from '@/features/pins/hooks';
import { useCreateJob } from '@/features/jobs/hooks';
import { useEntitlement } from '@/features/settings/hooks';
import { ApiError, errorMessage } from '@/lib/api';
import { backupCsv, backupJson } from '@/lib/backup';
import { dateStamp, downloadText } from '@/lib/download';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize } from '@/lib/format';
import { useSelection } from '@/stores/selection';
import { toast } from '@/stores/ui';
import { PLANS, type PaidPlanId } from '@/config/site';

export default function Review() {
  const navigate = useNavigate();
  const { ids, connectionId, clear } = useSelection();
  const { data: connections } = useConnections();
  const connection = connections?.find((c) => c.id === connectionId) ?? null;
  const idList = useMemo(() => [...ids], [ids]);
  const { entitlement, refetch: refetchProfile } = useEntitlement();
  const createJob = useCreateJob();

  const [dryRun, setDryRun] = useState(false);
  const [backupDone, setBackupDone] = useState(false);
  const [downloaded, setDownloaded] = useState({ json: false, csv: false });
  const [confirmText, setConfirmText] = useState('');
  const [upgradePlan, setUpgradePlan] = useState<PaidPlanId>('pass');

  const pinsQuery = useQuery({
    queryKey: ['reviewPins', connectionId, idList.length, idList[0], idList[idList.length - 1]],
    enabled: !!connectionId && idList.length > 0,
    queryFn: () => fetchPinsByIds(connectionId!, idList),
  });
  const pins = useMemo(
    () => (pinsQuery.data ?? []).filter((p) => p.status === 'active' || p.status === 'failed'),
    [pinsQuery.data],
  );
  const unavailable = (pinsQuery.data?.length ?? 0) - pins.length;

  const byBoard = useMemo(() => {
    const map = new Map<string, { name: string; key: string; count: number }>();
    for (const p of pins) {
      const key = p.pinterest_board_id ?? 'none';
      const entry = map.get(key) ?? { name: p.board_name ?? 'No board', key, count: 0 };
      entry.count++;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [pins]);

  if (!connectionId || idList.length === 0) {
    return (
      <EmptyState
        illustration={<EmptyPinsIllustration className="h-40 w-48" />}
        title="Nothing selected yet"
        action={<ButtonLink to="/app/pins">Choose pins</ButtonLink>}
      >
        Select pins on the dashboard, then come back here to review them.
      </EmptyState>
    );
  }

  const count = pins.length;
  const overLimit =
    !dryRun && !!entitlement && !entitlement.unlimited && count > entitlement.freeDeletionsRemaining;
  const canSubmit =
    count > 0 &&
    !overLimit &&
    connection?.status === 'active' &&
    (dryRun || (backupDone && confirmText.trim() === 'DELETE'));
  const username = connection?.username ?? 'account';

  const download = (kind: 'json' | 'csv') => {
    const name = `pindeleter-backup-${username}-${dateStamp()}`;
    if (kind === 'json') downloadText(`${name}.json`, backupJson(pins, { username }), 'application/json');
    else downloadText(`${name}.csv`, backupCsv(pins), 'text/csv;charset=utf-8');
    setDownloaded((d) => ({ ...d, [kind]: true }));
  };

  const submit = () => {
    createJob.mutate(
      { connectionId, pinIds: pins.map((p) => p.id), dryRun, backupConfirmed: backupDone },
      {
        onSuccess: ({ jobId }) => {
          clear();
          toast.success(
            dryRun ? 'Dry run complete' : 'Deletion started',
            dryRun ? 'Nothing was deleted.' : 'You can close this tab — we’ll email you when it’s done.',
          );
          navigate(`/app/jobs/${jobId}`);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.code === 'job_already_active') {
            const jobId = (err.details as { jobId?: string } | undefined)?.jobId;
            toast.warning('A job is already running', 'Wait for it to finish or cancel it first.');
            if (jobId) navigate(`/app/jobs/${jobId}`);
            return;
          }
          if (err instanceof ApiError && err.status === 402) void refetchProfile();
          toast.error('Could not start the job', errorMessage(err));
        },
      },
    );
  };

  return (
    <>
      <Seo title="Review" noindex path="/app/review" />
      <Link
        to={`/app/pins?connection=${connectionId}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-violet hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to pins
      </Link>
      <h1 className="mt-3 text-3xl sm:text-4xl">Review & confirm</h1>
      <p className="mt-1 text-muted">Double-check your selection, save a backup, then start the job.</p>

      {pinsQuery.isLoading ? (
        <Skeleton className="mt-8 h-64" />
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card className="p-6">
              <p className="text-sm font-bold text-muted">You’re about to {dryRun ? 'dry-run' : 'delete'}</p>
              <p className="mt-1 text-4xl font-black tracking-tight">
                {formatNumber(count)} <span className="text-gradient">pins</span>
              </p>
              <p className="mt-1 text-muted">
                from {pluralize(byBoard.length, 'board')} on @{username}
              </p>
              {unavailable > 0 && (
                <p className="mt-3 flex items-start gap-2 rounded-2xl bg-sunflower-soft p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
                  {pluralize(unavailable, 'selected pin')} are no longer available (already deleted or in
                  another job) and will be skipped.
                </p>
              )}
              <ul className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
                {byBoard.map((b) => (
                  <li key={b.key} className="flex items-center justify-between gap-3">
                    <span
                      className={cn(
                        'truncate rounded-full px-3 py-1 text-sm font-bold',
                        toneClass(boardTone(b.key)),
                      )}
                    >
                      {b.name}
                    </span>
                    <span className="font-extrabold tabular-nums">{formatNumber(b.count)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-soft text-teal">
                  <ShieldCheck className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xl">Download your backup</h2>
                  <p className="text-sm text-muted">
                    Created in your browser. Deleted pins can’t be restored by anyone.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  variant="soft"
                  onClick={() => download('json')}
                  icon={<FileJson className="h-4 w-4" aria-hidden />}
                >
                  Download JSON {downloaded.json && '✓'}
                </Button>
                <Button
                  variant="soft"
                  onClick={() => download('csv')}
                  icon={<FileSpreadsheet className="h-4 w-4" aria-hidden />}
                >
                  Download CSV {downloaded.csv && '✓'}
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Includes pin ID, board, title, description, link, image URL, created date, saves and clicks.
              </p>
              <div className="mt-5">
                <Checkbox id="backup-done" checked={backupDone} onChange={setBackupDone}>
                  <strong>I have downloaded my backup</strong> and kept it somewhere safe.
                </Checkbox>
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <Switch
                id="dry-run"
                checked={dryRun}
                onChange={setDryRun}
                label="Dry run"
                description="Go through the whole job and get a report, without deleting anything on Pinterest."
              />
            </Card>

            {overLimit && entitlement ? (
              <Card className="overflow-hidden border-2 border-primary/40 p-0">
                <div className="bg-sunset p-5 text-white">
                  <p className="flex items-center gap-2 text-lg font-extrabold">
                    <Crown className="h-5 w-5" aria-hidden /> Unlock unlimited deletions
                  </p>
                  <p className="mt-1 text-white/90">
                    Your free plan has <strong>{formatNumber(entitlement.freeDeletionsRemaining)}</strong>{' '}
                    deletions left; this job needs <strong>{formatNumber(count)}</strong>. Upgrade once — no
                    subscription — or reduce your selection.
                  </p>
                </div>
                <div className="p-5">
                  <div
                    className="mb-4 grid grid-cols-2 gap-2 rounded-full bg-ink/5 p-1 text-sm font-bold"
                    role="radiogroup"
                    aria-label="Plan"
                  >
                    {(['pass', 'agency'] as const).map((p) => (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={upgradePlan === p}
                        onClick={() => setUpgradePlan(p)}
                        className={cn(
                          'rounded-full py-2',
                          upgradePlan === p ? 'bg-raised shadow-card' : 'text-muted',
                        )}
                      >
                        {PLANS[p].name}
                      </button>
                    ))}
                  </div>
                  <Checkout plan={upgradePlan} onPaid={() => void refetchProfile()} />
                </div>
              </Card>
            ) : (
              <Card className="p-6">
                {!dryRun && (
                  <>
                    <Label htmlFor="confirm" hint="(all caps)">
                      Type DELETE to confirm
                    </Label>
                    <Input
                      id="confirm"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="font-mono font-bold tracking-widest"
                      placeholder="DELETE"
                    />
                    {!backupDone && (
                      <p className="mt-2 text-sm text-muted">Tick “I have downloaded my backup” first.</p>
                    )}
                  </>
                )}
                {entitlement && !entitlement.unlimited && !dryRun && (
                  <p className="mt-3 text-sm text-muted">
                    Uses {formatNumber(count)} of your {formatNumber(entitlement.freeDeletionsRemaining)}{' '}
                    remaining free deletions (only successful deletions count).
                  </p>
                )}
                {connection?.status === 'error' && (
                  <p className="mt-3 text-sm font-bold text-danger">
                    This account needs to be reconnected first.{' '}
                    <Link to="/app/accounts" className="underline">
                      Go to accounts
                    </Link>
                  </p>
                )}
                <Button
                  size="lg"
                  variant={dryRun ? 'dark' : 'danger'}
                  className="mt-5 w-full"
                  disabled={!canSubmit}
                  loading={createJob.isPending}
                  onClick={submit}
                  icon={
                    dryRun ? (
                      <FlaskConical className="h-5 w-5" aria-hidden />
                    ) : (
                      <Trash2 className="h-5 w-5" aria-hidden />
                    )
                  }
                >
                  {dryRun
                    ? `Run dry run on ${formatNumber(count)} pins`
                    : `Delete ${formatNumber(count)} pins`}
                </Button>
                <p className="mt-3 text-center text-xs text-muted">
                  {dryRun ? (
                    <Badge tone="sun">Nothing will be deleted</Badge>
                  ) : (
                    'Deletion is permanent. You can pause or cancel the job at any time.'
                  )}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
