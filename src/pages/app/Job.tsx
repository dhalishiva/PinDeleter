import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Pause,
  Play,
  RotateCcw,
  Square,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Card, ProgressBar, Skeleton } from '@/components/ui';
import { StatTile } from '@/components/widgets';
import { SuccessIllustration } from '@/components/Illustrations';
import { isActiveJob, useJob, useJobControl, useJobEvents, useJobPending } from '@/features/jobs/hooks';
import { downloadJobReport, JobStatusPill } from '@/features/jobs/components';
import { useConnections } from '@/features/connections/hooks';
import { errorMessage } from '@/lib/api';
import { celebrate } from '@/lib/confetti';
import { cn } from '@/lib/cn';
import { durationBetween, formatNumber, formatTime } from '@/lib/format';
import { toast } from '@/stores/ui';

const levelIcon = {
  info: <Info className="h-4 w-4 text-sky" aria-hidden />,
  warn: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden />,
  error: <XCircle className="h-4 w-4 text-danger" aria-hidden />,
};

export default function Job() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: job, isLoading, isError } = useJob(jobId);
  const events = useJobEvents(jobId);
  const active = !!job && isActiveJob(job.status);
  const pending = useJobPending(jobId, active && !job?.is_dry_run);
  const control = useJobControl();
  const { data: connections } = useConnections();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    if (!job) return;
    if (
      prevStatus.current &&
      prevStatus.current !== 'completed' &&
      job.status === 'completed' &&
      !job.is_dry_run
    )
      void celebrate();
    prevStatus.current = job.status;
  }, [job]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !job) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl">Job not found</h1>
        <Link to="/app/jobs" className="mt-4 inline-block font-bold text-violet hover:underline">
          See all jobs
        </Link>
      </div>
    );
  }

  const processed = job.deleted_count + job.failed_count + job.skipped_count;
  const remaining = Math.max(0, job.total - processed);
  const username = connections?.find((c) => c.id === job.connection_id)?.username;

  const act = (action: 'pause' | 'resume' | 'cancel' | 'retry_failed') =>
    control.mutate(
      { jobId: job.id, action },
      {
        onSuccess: (res) => {
          if (action === 'retry_failed') {
            toast.success('Retry started', 'Only the failed pins are in the new job.');
            navigate(`/app/jobs/${res.jobId}`);
          } else {
            toast.success(
              action === 'pause' ? 'Job paused' : action === 'resume' ? 'Job resumed' : 'Job cancelled',
            );
          }
          setConfirmCancel(false);
        },
        onError: (err) => toast.error('That didn’t work', errorMessage(err)),
      },
    );

  const report = async () => {
    setDownloading(true);
    try {
      await downloadJobReport(job.id);
    } catch (err) {
      toast.error('Could not build the report', errorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Seo title="Job" noindex path="/app/jobs" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/jobs" className="text-sm font-bold text-violet hover:underline">
            ← All jobs
          </Link>
          <h1 className="mt-2 text-3xl sm:text-4xl">
            {job.is_dry_run ? 'Dry run' : 'Deletion job'}
            {username && <span className="text-muted"> · @{username}</span>}
          </h1>
          <div className="mt-2">
            <JobStatusPill job={job} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(job.status === 'queued' || job.status === 'running' || job.status === 'rate_limited') && (
            <Button
              variant="secondary"
              onClick={() => act('pause')}
              loading={control.isPending && control.variables?.action === 'pause'}
              icon={<Pause className="h-4 w-4" aria-hidden />}
            >
              Pause
            </Button>
          )}
          {job.status === 'paused' && (
            <Button
              onClick={() => act('resume')}
              loading={control.isPending && control.variables?.action === 'resume'}
              icon={<Play className="h-4 w-4" aria-hidden />}
            >
              Resume
            </Button>
          )}
          {active && (
            <Button
              variant="ghost"
              onClick={() => setConfirmCancel(true)}
              icon={<Square className="h-4 w-4" aria-hidden />}
            >
              Cancel
            </Button>
          )}
          {!active && job.failed_count > 0 && (
            <Button
              onClick={() => act('retry_failed')}
              loading={control.isPending && control.variables?.action === 'retry_failed'}
              icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            >
              Retry {formatNumber(job.failed_count)} failed
            </Button>
          )}
          {!active && (
            <Button
              variant="secondary"
              onClick={report}
              loading={downloading}
              icon={<Download className="h-4 w-4" aria-hidden />}
            >
              Download report
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-6 p-6">
        {job.status === 'completed' && !job.is_dry_run ? (
          <div className="mb-5 flex items-center gap-4">
            <SuccessIllustration className="h-20 w-20 shrink-0" />
            <div>
              <p className="text-2xl font-black">All done! 🎉</p>
              <p className="text-muted">Finished in {durationBetween(job.started_at, job.finished_at)}.</p>
            </div>
          </div>
        ) : job.status === 'completed' && job.is_dry_run ? (
          <p className="mb-5 rounded-2xl bg-sunflower-soft p-4 font-bold">
            Dry run complete: {formatNumber(job.total)} pins would be deleted. Nothing was changed on
            Pinterest. Download the report to check the list.
          </p>
        ) : job.status === 'rate_limited' ? (
          <p className="mb-5 rounded-2xl bg-sunflower-soft p-4 font-bold">
            Pinterest is rate-limiting us, your job will continue automatically
            {job.next_run_at ? ` at ${formatTime(job.next_run_at)}` : ''}.
          </p>
        ) : job.status === 'failed' ? (
          <p className="mb-5 rounded-2xl bg-primary-soft p-4 font-bold text-[#B60000] dark:text-[#FF8F9F]">
            {job.last_error ?? 'The job stopped.'}
          </p>
        ) : null}

        <div className="mb-2 flex justify-between text-sm font-bold">
          <span>
            {formatNumber(processed)} of {formatNumber(job.total)} processed
          </span>
          <span>{job.total ? Math.round((processed / job.total) * 100) : 0}%</span>
        </div>
        <ProgressBar value={processed} max={job.total} label="Job progress" className="h-4" />

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            label="Deleted"
            value={job.deleted_count}
            tone="teal"
            icon={<CheckCircle2 className="h-5 w-5 text-teal" aria-hidden />}
          />
          <StatTile
            label="Failed"
            value={job.failed_count}
            tone="pink"
            icon={<XCircle className="h-5 w-5 text-primary" aria-hidden />}
          />
          <StatTile label="Skipped" value={job.skipped_count} tone="sun" />
          <StatTile label="Remaining" value={remaining} tone="violet" />
        </div>

        {active && !job.is_dry_run && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-bold text-muted">Up next</p>
            <div className="flex h-20 gap-2 overflow-hidden" aria-hidden>
              <AnimatePresence initial={false} mode="popLayout">
                {(pending.data ?? []).map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.6, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{
                      opacity: 0,
                      x: -140,
                      rotate: -18,
                      scale: 0.4,
                      transition: { duration: 0.45, ease: 'easeIn' },
                    }}
                    className="relative h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-sunset-soft"
                    title={item.title ?? undefined}
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt=""
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <Trash2 className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {active && (
          <p className="mt-6 rounded-2xl bg-tint-violet p-4 text-sm font-semibold">
            You can close this tab. We’ll email you when it’s done.
          </p>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="text-xl">Live log</h2>
        <ol className="mt-4 max-h-[420px] space-y-1 overflow-y-auto pr-1 text-sm" aria-live="polite">
          <AnimatePresence initial={false}>
            {(events.data ?? []).map((e) => (
              <motion.li
                key={e.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-2',
                  e.level === 'error'
                    ? 'bg-primary-soft/60'
                    : e.level === 'warn'
                      ? 'bg-sunflower-soft/70'
                      : '',
                )}
              >
                <span className="mt-0.5">{levelIcon[e.level]}</span>
                <span className="w-20 shrink-0 font-mono text-xs leading-5 text-muted">
                  {formatTime(e.created_at)}
                </span>
                <span className="min-w-0 flex-1 break-words">{e.message}</span>
              </motion.li>
            ))}
          </AnimatePresence>
          {!events.data?.length && <li className="text-muted">Waiting for the first update…</li>}
        </ol>
      </Card>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel this job?"
        description="Pins already deleted stay deleted. Everything not yet processed is left untouched on Pinterest."
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
            Keep running
          </Button>
          <Button
            variant="danger"
            onClick={() => act('cancel')}
            loading={control.isPending && control.variables?.action === 'cancel'}
          >
            Cancel job
          </Button>
        </div>
      </Modal>
    </>
  );
}
