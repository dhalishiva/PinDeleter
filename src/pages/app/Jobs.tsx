import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, History } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button, ButtonLink } from '@/components/Button';
import { Card, Skeleton } from '@/components/ui';
import { EmptyState } from '@/components/widgets';
import { EmptyPinsIllustration } from '@/components/Illustrations';
import { useJobs, isActiveJob } from '@/features/jobs/hooks';
import { downloadJobReport, JobStatusPill } from '@/features/jobs/components';
import { useConnections } from '@/features/connections/hooks';
import { errorMessage } from '@/lib/api';
import { formatDateTime, formatNumber } from '@/lib/format';
import { toast } from '@/stores/ui';

export default function Jobs() {
  const { data: jobs, isLoading } = useJobs(100);
  const { data: connections } = useConnections();
  const [params, setParams] = useSearchParams();
  const [busy, setBusy] = useState<string | null>(null);
  const autoReport = useRef(false);

  const report = async (jobId: string) => {
    setBusy(jobId);
    try {
      const n = await downloadJobReport(jobId);
      toast.success('Report downloaded', `${formatNumber(n)} rows`);
    } catch (err) {
      toast.error('Could not build the report', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  // Links from the "job finished" email: /app/jobs?report=<jobId>
  useEffect(() => {
    const id = params.get('report');
    if (id && !autoReport.current) {
      autoReport.current = true;
      void report(id).then(() => {
        const next = new URLSearchParams(params);
        next.delete('report');
        setParams(next, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const name = (id: string) => connections?.find((c) => c.id === id)?.username ?? 'disconnected account';

  return (
    <>
      <Seo title="Jobs" noindex path="/app/jobs" />
      <h1 className="text-3xl sm:text-4xl">Job history</h1>
      <p className="mt-1 text-muted">Reports are available for 30 days after a job runs.</p>
      <div className="mt-8">
        {isLoading ? (
          <Skeleton className="h-64" />
        ) : !jobs?.length ? (
          <EmptyState
            illustration={<EmptyPinsIllustration className="h-36 w-44" />}
            title="No jobs yet"
            action={<ButtonLink to="/app/pins">Choose pins to clean up</ButtonLink>}
          >
            When you start a deletion or a dry run, it shows up here.
          </EmptyState>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-tint-violet">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-extrabold">
                      Started
                    </th>
                    <th scope="col" className="px-5 py-3 font-extrabold">
                      Account
                    </th>
                    <th scope="col" className="px-5 py-3 font-extrabold">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-extrabold">
                      Deleted
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-extrabold">
                      Failed
                    </th>
                    <th scope="col" className="px-5 py-3 text-right font-extrabold">
                      Total
                    </th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {jobs.map((j) => (
                    <tr key={j.id} className="hover:bg-ink/[0.02]">
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/app/jobs/${j.id}`}
                          className="inline-flex items-center gap-2 font-bold text-ink hover:text-primary"
                        >
                          <History className="h-4 w-4 text-muted" aria-hidden />
                          {formatDateTime(j.created_at)}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5">@{name(j.connection_id)}</td>
                      <td className="px-5 py-3.5">
                        <JobStatusPill job={j} />
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                        {formatNumber(j.deleted_count)}
                      </td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{formatNumber(j.failed_count)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums">{formatNumber(j.total)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {isActiveJob(j.status) ? (
                          <ButtonLink to={`/app/jobs/${j.id}`} size="sm" variant="soft">
                            Watch
                          </ButtonLink>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => report(j.id)}
                            loading={busy === j.id}
                            icon={<Download className="h-4 w-4" aria-hidden />}
                          >
                            Download report
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
