import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/ui';
import { EmptyState } from '@/components/widgets';
import { EmptyPinsIllustration } from '@/components/Illustrations';
import { ConnectPrompt } from '@/features/connections/ConnectPrompt';
import { useActiveConnection, useLatestSync } from '@/features/connections/hooks';
import { useBoards, usePinCount, usePins, selectAllMatching } from '@/features/pins/hooks';
import { FilterBar } from '@/features/pins/FilterBar';
import { PinGrid } from '@/features/pins/PinGrid';
import { SelectionBar } from '@/features/pins/SelectionBar';
import { EngagementLoader } from '@/features/pins/EngagementLoader';
import {
  activeFilterCount,
  buildPinQuery,
  DEFAULT_FILTERS,
  parseFilters,
  writeFilters,
  type PinFilterState,
} from '@/lib/pinFilters';
import { errorMessage } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import { useSelection } from '@/stores/selection';
import { toast } from '@/stores/ui';
import { LIMITS } from '@/config/site';

export default function Pins() {
  const [params, setParams] = useSearchParams();
  const { connection, connections, isLoading: connLoading } = useActiveConnection();
  const connectionId = connection?.id ?? null;
  const filters = useMemo(() => parseFilters(params), [params]);
  // Recompute "older than" boundaries at most once a day so cache keys stay stable.
  const today = new Date().toISOString().slice(0, 10);
  const query = useMemo(() => buildPinQuery(filters, new Date(`${today}T00:00:00Z`)), [filters, today]);

  const pins = usePins(connectionId, query);
  const count = usePinCount(connectionId, query);
  const allCount = usePinCount(connectionId, { sort: 'newest' });
  const boards = useBoards(connectionId);
  const latestSync = useLatestSync(connectionId);
  const { ids: selected, toggle, addMany, removeMany, clear, forConnection } = useSelection();
  const [selectingAll, setSelectingAll] = useState(false);

  useEffect(() => {
    if (connectionId) forConnection(connectionId);
  }, [connectionId, forConnection]);

  // Keep ?connection= in the URL so links are shareable and the filter state belongs to one account.
  useEffect(() => {
    if (connectionId && params.get('connection') !== connectionId) {
      const next = new URLSearchParams(params);
      next.set('connection', connectionId);
      setParams(next, { replace: true });
    }
  }, [connectionId, params, setParams]);

  const update = useCallback(
    (patch: Partial<PinFilterState>) => {
      setParams((prev) => writeFilters(prev, { ...parseFilters(prev), ...patch }), { replace: true });
    },
    [setParams],
  );

  const loaded = useMemo(() => pins.data?.pages.flat() ?? [], [pins.data]);
  const matching = count.data ?? 0;

  const selectAll = async () => {
    if (!connectionId) return;
    setSelectingAll(true);
    try {
      const ids = await selectAllMatching(connectionId, query);
      addMany(ids);
      if (matching > LIMITS.selectAllCap)
        toast.info(
          `Selected the first ${formatNumber(LIMITS.selectAllCap)}`,
          'Jobs are limited to 10,000 pins at a time.',
        );
      else toast.success(`Selected ${formatNumber(ids.length)} pins`);
    } catch (err) {
      toast.error('Could not select all', errorMessage(err));
    } finally {
      setSelectingAll(false);
    }
  };

  if (connLoading) return <Skeleton className="h-96" />;
  if (!connections.length) return <ConnectPrompt />;

  const syncing = latestSync.data?.status === 'running';
  const noPinsAtAll = !pins.isLoading && (allCount.data ?? 0) === 0;

  return (
    <>
      <Seo title="Pins" noindex path="/app/pins" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl sm:text-4xl">Your pins</h1>
          <p className="mt-1 text-muted">
            @{connection?.username} · {formatNumber(allCount.data ?? 0)} pins
            {syncing && (
              <Link
                to={`/app/accounts/${connectionId}/sync`}
                className="ml-2 inline-flex items-center gap-1 font-bold text-violet hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden /> syncing…
              </Link>
            )}
          </p>
        </div>
      </div>

      {noPinsAtAll ? (
        <EmptyState
          illustration={<EmptyPinsIllustration className="h-40 w-48" />}
          title={syncing ? 'Your pins are on their way' : 'No pins here yet'}
          action={
            <Link to={`/app/accounts/${connectionId}/sync`} className="font-bold text-violet hover:underline">
              {syncing ? 'Watch sync progress' : 'Sync this account'}
            </Link>
          }
        >
          {syncing
            ? 'We’re fetching your boards and pins right now.'
            : 'Sync your account to load your boards and pins.'}
        </EmptyState>
      ) : (
        <>
          <FilterBar
            filters={filters}
            onChange={update}
            boards={boards.data ?? []}
            totalPins={allCount.data ?? 0}
          />

          {filters.noEngagement && connectionId && (
            <div className="mt-4">
              <EngagementLoader connectionId={connectionId} boards={filters.boards} />
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="font-extrabold" aria-live="polite">
              {formatNumber(matching)} shown
            </span>
            <Button
              size="sm"
              variant="soft"
              onClick={selectAll}
              loading={selectingAll}
              disabled={matching === 0}
            >
              Select all {formatNumber(Math.min(matching, LIMITS.selectAllCap))}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeMany(loaded.map((p) => p.id))}
              disabled={!loaded.some((p) => selected.has(p.id))}
            >
              Unselect shown
            </Button>
            {activeFilterCount(filters) > 0 && (
              <button
                type="button"
                onClick={() => setParams(writeFilters(params, DEFAULT_FILTERS), { replace: true })}
                className="font-bold text-violet hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="mt-5">
            {pins.isLoading ? (
              <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} className={i % 3 === 0 ? 'h-72' : 'h-56'} />
                ))}
              </div>
            ) : pins.isError ? (
              <EmptyState
                illustration={<EmptyPinsIllustration className="h-32 w-40" />}
                title="Couldn’t load pins"
                action={<Button onClick={() => void pins.refetch()}>Try again</Button>}
              >
                {errorMessage(pins.error)}
              </EmptyState>
            ) : loaded.length === 0 ? (
              <EmptyState
                illustration={<EmptyPinsIllustration className="h-36 w-44" />}
                title="No pins match these filters"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => setParams(writeFilters(params, DEFAULT_FILTERS), { replace: true })}
                  >
                    Reset filters
                  </Button>
                }
              >
                {filters.noEngagement
                  ? 'If stats aren’t loaded yet, use “Load engagement stats” above.'
                  : 'Try a different search or fewer filters.'}
              </EmptyState>
            ) : (
              <PinGrid
                pins={loaded}
                selected={selected}
                onToggle={toggle}
                hasNextPage={!!pins.hasNextPage}
                isFetchingNextPage={pins.isFetchingNextPage}
                fetchNextPage={() => void pins.fetchNextPage()}
              />
            )}
            {pins.isFetchingNextPage && (
              <p className="py-6 text-center text-sm font-bold text-muted">Loading more pins…</p>
            )}
          </div>
        </>
      )}
      <SelectionBar count={selected.size} onClear={clear} />
    </>
  );
}
