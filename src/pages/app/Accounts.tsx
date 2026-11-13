import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Plug, Plus, RefreshCw, Unplug } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { Modal } from '@/components/Modal';
import { Badge, Card, Skeleton } from '@/components/ui';
import { ConnectPrompt } from '@/features/connections/ConnectPrompt';
import { useConnections, useDisconnect, useStartConnect, useStartSync } from '@/features/connections/hooks';
import { useEntitlement } from '@/features/settings/hooks';
import { errorMessage } from '@/lib/api';
import { formatDate, timeAgo } from '@/lib/format';
import { toast } from '@/stores/ui';
import type { Connection } from '@/lib/types';

export default function Accounts() {
  const { data: connections, isLoading } = useConnections();
  const { entitlement } = useEntitlement();
  const connect = useStartConnect();
  const sync = useStartSync();
  const disconnect = useDisconnect();
  const navigate = useNavigate();
  const [toDisconnect, setToDisconnect] = useState<Connection | null>(null);

  const max = entitlement?.maxConnections ?? 1;
  const atLimit = (connections?.length ?? 0) >= max;

  const startConnect = (reconnectId?: string) =>
    connect.mutate(reconnectId, {
      onError: (e) => toast.error('Could not start connecting', errorMessage(e)),
    });

  return (
    <>
      <Seo title="Accounts" noindex path="/app/accounts" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Pinterest accounts</h1>
          <p className="mt-1 text-muted">
            {connections?.length ?? 0} of {max} account{max === 1 ? '' : 's'} connected on your plan.
          </p>
        </div>
        {!!connections?.length &&
          (atLimit ? (
            <p className="text-sm text-muted">
              {max === 1 ? (
                <>
                  Need more accounts?{' '}
                  <Link to="/app/billing" className="font-bold text-violet hover:underline">
                    Agency
                  </Link>{' '}
                  allows up to 5.
                </>
              ) : (
                'Disconnect an account to add another.'
              )}
            </p>
          ) : (
            <Button
              onClick={() => startConnect()}
              loading={connect.isPending}
              icon={<Plus className="h-4 w-4" aria-hidden />}
            >
              Connect another account
            </Button>
          ))}
      </div>

      <div className="mt-8">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : !connections?.length ? (
          <ConnectPrompt />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {connections.map((c) => (
              <Card key={c.id} className="p-6">
                <div className="flex items-center gap-4">
                  {c.profile_image ? (
                    <img src={c.profile_image} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sunset text-xl font-black text-white">
                      {c.username[0]?.toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-extrabold">@{c.username}</p>
                    <p className="text-sm text-muted">
                      {c.account_type ? `${c.account_type.toLowerCase()} account` : 'Pinterest account'}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {c.status === 'error' ? (
                      <Badge tone="danger">Needs reconnect</Badge>
                    ) : (
                      <Badge tone="success">Connected</Badge>
                    )}
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-tint-violet p-3">
                    <dt className="font-bold text-muted">Connected</dt>
                    <dd className="font-extrabold">{formatDate(c.created_at)}</dd>
                  </div>
                  <div className="rounded-2xl bg-tint-teal p-3">
                    <dt className="font-bold text-muted">Last sync</dt>
                    <dd className="font-extrabold">{timeAgo(c.last_synced_at)}</dd>
                  </div>
                </dl>
                {c.status === 'error' && c.last_error && (
                  <p className="mt-4 flex items-start gap-2 rounded-2xl bg-sunflower-soft p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />{' '}
                    {c.last_error}
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {c.status === 'error' ? (
                    <Button
                      size="sm"
                      onClick={() => startConnect(c.id)}
                      loading={connect.isPending}
                      icon={<Plug className="h-4 w-4" aria-hidden />}
                    >
                      Reconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="soft"
                      loading={sync.isPending && sync.variables === c.id}
                      icon={<RefreshCw className="h-4 w-4" aria-hidden />}
                      onClick={() =>
                        sync.mutate(c.id, {
                          onSuccess: ({ syncRunId }) =>
                            navigate(`/app/accounts/${c.id}/sync?run=${syncRunId}`),
                          onError: (e) => toast.error('Could not start sync', errorMessage(e)),
                        })
                      }
                    >
                      Re-sync
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setToDisconnect(c)}
                    icon={<Unplug className="h-4 w-4" aria-hidden />}
                  >
                    Disconnect
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!toDisconnect}
        onClose={() => setToDisconnect(null)}
        title={`Disconnect @${toDisconnect?.username ?? ''}?`}
        description="We’ll cancel any running job for this account, delete its access tokens and all cached boards and pins. Pins on Pinterest are not affected."
      >
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setToDisconnect(null)}>
            Keep connected
          </Button>
          <Button
            variant="danger"
            loading={disconnect.isPending}
            onClick={() =>
              toDisconnect &&
              disconnect.mutate(toDisconnect.id, {
                onSuccess: () => {
                  toast.success('Account disconnected', 'Tokens and cached data were deleted.');
                  setToDisconnect(null);
                },
                onError: (e) => toast.error('Could not disconnect', errorMessage(e)),
              })
            }
          >
            Disconnect
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted">
          Tip: you can also remove PinDeleter from Pinterest at any time in your Pinterest settings under
          Security → Apps.
        </p>
      </Modal>
    </>
  );
}
