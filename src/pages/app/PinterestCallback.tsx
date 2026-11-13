import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { Spinner } from '@/components/ui';
import { OopsIllustration } from '@/components/Illustrations';
import { callFunction, errorMessage } from '@/lib/api';
import { qk } from '@/lib/queryClient';
import { useActiveConnectionStore } from '@/stores/connection';

export default function PinterestCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setActive = useActiveConnectionStore((s) => s.setActive);
  const started = useRef(false);
  const code = params.get('code');
  const state = params.get('state');
  const denied = params.get('error');
  const [error, setError] = useState<string | null>(
    denied
      ? 'You cancelled the connection on Pinterest, so nothing was connected.'
      : !code || !state
        ? 'This connection link is incomplete. Please try connecting again.'
        : null,
  );

  useEffect(() => {
    if (started.current || !code || !state || denied) return;
    started.current = true;
    callFunction<{ connectionId: string; syncRunId: string }>('pinterest-oauth-callback', { code, state })
      .then(async ({ connectionId, syncRunId }) => {
        setActive(connectionId);
        await qc.invalidateQueries({ queryKey: qk.connections });
        navigate(`/app/accounts/${connectionId}/sync?run=${syncRunId}`, { replace: true });
      })
      .catch((err) => setError(errorMessage(err)));
  }, [code, state, denied, navigate, qc, setActive]);

  return (
    <>
      <Seo title="Connecting Pinterest" noindex path="/app/connect/pinterest/callback" />
      <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        {error ? (
          <>
            <OopsIllustration className="h-32 w-32" />
            <h1 className="mt-4 text-2xl">We couldn’t connect your account</h1>
            <p className="mt-2 max-w-md text-muted">{error}</p>
            <ButtonLink to="/app/accounts" className="mt-6">
              Back to accounts
            </ButtonLink>
          </>
        ) : (
          <>
            <Spinner className="h-10 w-10" />
            <h1 className="mt-4 text-2xl">Connecting your Pinterest account…</h1>
            <p className="mt-1 text-muted">This only takes a moment.</p>
          </>
        )}
      </div>
    </>
  );
}
