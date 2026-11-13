import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, MailCheck } from 'lucide-react';
import { Seo } from '@/components/Seo';
import { Button } from '@/components/Button';
import { LogoMark } from '@/components/Logo';
import { Blobs, FieldError, Input, Label } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { isConfigured } from '@/lib/env';
import { toast } from '@/stores/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { safeNext } from '@/features/auth/ProtectedRoute';
import { FREE_DELETION_LIMIT, PLANS, type PaidPlanId } from '@/config/site';
import { cn } from '@/lib/cn';

const emailSchema = z.object({ email: z.string().trim().email('Please enter a valid email address') });
const codeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from the email'),
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"
      />
      <path
        fill="#34A853"
        d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"
      />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
      <path
        fill="#EA4335"
        d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"
      />
    </svg>
  );
}

export default function Login({ mode }: { mode: 'login' | 'signup' }) {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const plan = params.get('plan');
  const paidPlan: PaidPlanId | null = plan === 'pass' || plan === 'agency' ? plan : null;
  const next = paidPlan ? `/app/billing?checkout=${paidPlan}` : safeNext(params.get('next'));
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const emailForm = useForm<{ email: string }>({ resolver: zodResolver(emailSchema) });
  const codeForm = useForm<{ code: string }>({ resolver: zodResolver(codeSchema) });

  if (!loading && user) return <Navigate to={next} replace />;

  const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const sendLink = async ({ email }: { email: string }) => {
    if (!isConfigured) {
      toast.error('Sign-in is not available', 'The app is not connected to its backend yet.');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) {
      toast.error('Could not send the link', error.message);
      return;
    }
    setSentTo(email);
  };

  const verifyCode = async ({ code }: { code: string }) => {
    if (!sentTo) return;
    const { error } = await supabase.auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
    if (error) toast.error('That code didn’t work', error.message);
  };

  const google = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) {
      setGoogleLoading(false);
      toast.error('Google sign-in failed', error.message);
    }
  };

  const isSignup = mode === 'signup';
  return (
    <>
      <Seo
        title={isSignup ? 'Create your account' : 'Log in'}
        path={isSignup ? '/signup' : '/login'}
        noindex={false}
      />
      <section className="relative isolate flex min-h-[calc(100vh-4.5rem)] items-center justify-center overflow-hidden px-4 py-12">
        <Blobs />
        <div className="w-full max-w-md">
          <div className="card p-7 sm:p-9">
            <div className="flex flex-col items-center text-center">
              <LogoMark size={52} />
              <h1 className="mt-4 text-3xl">{isSignup ? 'Create your free account' : 'Welcome back'}</h1>
              <p className="mt-2 text-muted">
                {paidPlan
                  ? `Sign in to continue to checkout for the ${PLANS[paidPlan].name}.`
                  : isSignup
                    ? `${FREE_DELETION_LIMIT} free deletions. No password needed.`
                    : 'Sign in with a magic link or Google.'}
              </p>
            </div>

            <div
              className="mt-6 grid grid-cols-2 rounded-full bg-ink/5 p-1 text-sm font-bold"
              role="tablist"
              aria-label="Account"
            >
              <Link
                role="tab"
                aria-selected={!isSignup}
                to={`/login${params.toString() ? `?${params}` : ''}`}
                className={cn(
                  'rounded-full py-2 text-center',
                  !isSignup ? 'bg-raised shadow-card' : 'text-muted',
                )}
              >
                Log in
              </Link>
              <Link
                role="tab"
                aria-selected={isSignup}
                to={`/signup${params.toString() ? `?${params}` : ''}`}
                className={cn(
                  'rounded-full py-2 text-center',
                  isSignup ? 'bg-raised shadow-card' : 'text-muted',
                )}
              >
                Sign up
              </Link>
            </div>

            {sentTo ? (
              <div className="mt-6">
                <div className="flex flex-col items-center rounded-3xl bg-teal-soft p-5 text-center">
                  <MailCheck className="h-8 w-8 text-teal" aria-hidden />
                  <p className="mt-2 font-extrabold">Check your inbox</p>
                  <p className="mt-1 text-sm text-ink/80">
                    We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device to continue.
                  </p>
                </div>
                <form onSubmit={codeForm.handleSubmit(verifyCode)} className="mt-5 space-y-3" noValidate>
                  <Label htmlFor="code" hint="(if your email shows one)">
                    Or enter the 6-digit code
                  </Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    {...codeForm.register('code')}
                    aria-describedby="code-error"
                  />
                  <FieldError id="code-error" message={codeForm.formState.errors.code?.message} />
                  <Button
                    type="submit"
                    variant="secondary"
                    className="w-full"
                    loading={codeForm.formState.isSubmitting}
                  >
                    Verify code
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="mt-4 w-full text-sm font-bold text-violet hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={emailForm.handleSubmit(sendLink)} className="mt-6 space-y-3" noValidate>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-describedby="email-error"
                    {...emailForm.register('email')}
                  />
                  <FieldError id="email-error" message={emailForm.formState.errors.email?.message} />
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    loading={emailForm.formState.isSubmitting}
                    icon={<Mail className="h-5 w-5" aria-hidden />}
                  >
                    {isSignup ? 'Email me a sign-up link' : 'Email me a magic link'}
                  </Button>
                </form>
                <div className="my-5 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-muted">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={google}
                  loading={googleLoading}
                  icon={<GoogleIcon />}
                >
                  Continue with Google
                </Button>
              </>
            )}
            <p className="mt-6 text-center text-xs text-muted">
              By continuing you agree to our{' '}
              <Link to="/terms" className="font-bold text-violet hover:underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link to="/privacy" className="font-bold text-violet hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
