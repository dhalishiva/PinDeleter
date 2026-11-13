import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { Spinner } from '@/components/ui';
import { OopsIllustration } from '@/components/Illustrations';
import { supabase } from '@/lib/supabase';
import { safeNext } from '@/features/auth/ProtectedRoute';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const urlError =
    params.get('error_description') ??
    new URLSearchParams(window.location.hash.slice(1)).get('error_description');
  const [error, setError] = useState<string | null>(urlError);

  useEffect(() => {
    if (urlError) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigate(next, { replace: true });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const timer = setTimeout(() => {
      if (!done) setError('This sign-in link is invalid or has expired. Please request a new one.');
    }, 12_000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate, next, urlError]);

  return (
    <>
      <Seo title="Signing you in" noindex path="/auth/callback" />
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        {error ? (
          <>
            <OopsIllustration className="h-32 w-32" />
            <h1 className="mt-4 text-2xl">Sign-in didn’t work</h1>
            <p className="mt-2 max-w-sm text-muted">{error}</p>
            <ButtonLink to="/login" className="mt-6">
              Back to log in
            </ButtonLink>
          </>
        ) : (
          <>
            <Spinner className="h-10 w-10" />
            <p className="mt-4 font-bold">Signing you in…</p>
          </>
        )}
      </div>
    </>
  );
}
