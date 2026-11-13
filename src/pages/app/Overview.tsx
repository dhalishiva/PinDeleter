import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, CalendarClock, Crown, Grid3x3, RefreshCw, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { Badge, Card, ProgressBar, Skeleton } from '@/components/ui';
import { StatTile } from '@/components/widgets';
import { ConnectPrompt } from '@/features/connections/ConnectPrompt';
import { useActiveConnection } from '@/features/connections/hooks';
import { useEntitlement, useProfile } from '@/features/settings/hooks';
import { useJobs } from '@/features/jobs/hooks';
import { JobStatusPill } from '@/features/jobs/components';
import { supabase } from '@/lib/supabase';
import { daysLeft, formatDate, formatNumber, timeAgo } from '@/lib/format';
import { FREE_DELETION_LIMIT, PLANS } from '@/config/site';

function useCounts(connectionId: string | null) {
  return useQuery({
    queryKey: ['overviewCounts', connectionId],
    enabled: !!connectionId,
    queryFn: async () => {
      const [pins, boards] = await Promise.all([
        supabase
          .from('pins')
          .select('id', { count: 'exact', head: true })
          .eq('connection_id', connectionId!)
          .in('status', ['active', 'failed']),
        supabase
          .from('boards')
          .select('id', { count: 'exact', head: true })
          .eq('connection_id', connectionId!),
      ]);
      return { pins: pins.count ?? 0, boards: boards.count ?? 0 };
    },
  });
}

export default function Overview() {
  const { connection, connections, isLoading } = useActiveConnection();
  const { data: profile } = useProfile();
  const { entitlement } = useEntitlement();
  const counts = useCounts(connection?.id ?? null);
  const jobs = useJobs(5);
  const name = profile?.display_name || profile?.email?.split('@')[0] || 'there';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  return (
    <>
      <Seo title="Overview" noindex path="/app" />
      <h1 className="text-3xl sm:text-4xl">Hi {name} 👋</h1>
      <p className="mt-1 text-muted">Here’s your cleanup at a glance.</p>

      {connections.length === 0 ? (
        <div className="mt-8">
          <ConnectPrompt />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Pins"
              value={counts.data?.pins ?? 0}
              icon={<Grid3x3 className="h-5 w-5 text-primary" aria-hidden />}
              tone="pink"
            />
            <StatTile
              label="Boards"
              value={counts.data?.boards ?? 0}
              icon={<Boxes className="h-5 w-5 text-violet" aria-hidden />}
              tone="violet"
            />
            <StatTile
              label="Accounts"
              value={connections.length}
              icon={<Sparkles className="h-5 w-5 text-teal" aria-hidden />}
              tone="teal"
            />
            {entitlement?.unlimited ? (
              <StatTile
                label="Pass days left"
                value={daysLeft(entitlement.expiresAt)}
                icon={<Crown className="h-5 w-5 text-[#5C4A00]" aria-hidden />}
                tone="sun"
              />
            ) : (
              <StatTile
                label="Free deletions left"
                value={entitlement?.freeDeletionsRemaining ?? FREE_DELETION_LIMIT}
                icon={<Crown className="h-5 w-5 text-[#5C4A00]" aria-hidden />}
                tone="sun"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl">Connected accounts</h2>
                <Link to="/app/accounts" className="text-sm font-bold text-violet hover:underline">
                  Manage
                </Link>
              </div>
              <ul className="mt-4 divide-y divide-line">
                {connections.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                    {c.profile_image ? (
                      <img src={c.profile_image} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sunset font-black text-white">
                        {c.username[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">@{c.username}</p>
                      <p className="flex items-center gap-1 text-sm text-muted">
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Last sync{' '}
                        {timeAgo(c.last_synced_at)}
                      </p>
                    </div>
                    {c.status === 'error' ? (
                      <Badge tone="danger">Needs reconnect</Badge>
                    ) : (
                      <ButtonLink
                        to={`/app/pins?connection=${c.id}`}
                        size="sm"
                        variant="soft"
                        icon={<ArrowRight className="h-4 w-4" aria-hidden />}
                      >
                        View pins
                      </ButtonLink>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl">Your plan</h2>
              {entitlement?.unlimited ? (
                <div className="mt-4">
                  <Badge tone="pink" icon={<Crown className="h-3.5 w-3.5" aria-hidden />}>
                    {PLANS[entitlement.plan].name}
                  </Badge>
                  <p className="mt-3 text-muted">
                    Unlimited deletions until{' '}
                    <strong className="text-ink">{formatDate(entitlement.expiresAt)}</strong> (
                    {daysLeft(entitlement.expiresAt)} days left).
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  <p className="font-bold">
                    {formatNumber(entitlement?.freeDeletionsUsed ?? 0)} of {FREE_DELETION_LIMIT} free
                    deletions used
                  </p>
                  <ProgressBar
                    className="mt-3"
                    value={entitlement?.freeDeletionsUsed ?? 0}
                    max={FREE_DELETION_LIMIT}
                    label="Free deletions used"
                  />
                  <ButtonLink to="/app/billing" size="sm" className="mt-5">
                    Upgrade for unlimited
                  </ButtonLink>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl">Recent jobs</h2>
              <Link to="/app/jobs" className="text-sm font-bold text-violet hover:underline">
                All jobs
              </Link>
            </div>
            {jobs.data?.length ? (
              <ul className="mt-4 divide-y divide-line">
                {jobs.data.map((j) => (
                  <li key={j.id}>
                    <Link
                      to={`/app/jobs/${j.id}`}
                      className="flex flex-wrap items-center gap-3 rounded-2xl px-2 py-3 hover:bg-ink/[0.03]"
                    >
                      <CalendarClock className="h-5 w-5 text-muted" aria-hidden />
                      <span className="font-bold">
                        {formatDate(j.created_at, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className="text-sm text-muted">
                        {formatNumber(j.deleted_count)} deleted · {formatNumber(j.failed_count)} failed ·{' '}
                        {formatNumber(j.total)} total
                      </span>
                      <span className="ml-auto">
                        <JobStatusPill job={j} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-muted">
                No jobs yet. Head to{' '}
                <Link to="/app/pins" className="font-bold text-violet hover:underline">
                  your pins
                </Link>{' '}
                to start a cleanup.
              </p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
