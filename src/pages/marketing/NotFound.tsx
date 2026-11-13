import { Seo } from '@/components/Seo';
import { ButtonLink } from '@/components/Button';
import { NotFoundIllustration } from '@/components/Illustrations';

export default function NotFound({ inApp }: { inApp?: boolean }) {
  return (
    <>
      <Seo title="Page not found" noindex path="/404" />
      <section className="container-page flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <NotFoundIllustration className="h-48 w-60" />
        <p className="mt-6 text-sm font-extrabold uppercase tracking-[0.14em] text-primary">404</p>
        <h1 className="mt-2 text-4xl">This pin wandered off</h1>
        <p className="mt-3 max-w-md text-muted">
          The page you’re looking for doesn’t exist or has moved. Let’s get you back on track.
        </p>
        <div className="mt-8 flex gap-3">
          <ButtonLink to={inApp ? '/app' : '/'}>{inApp ? 'Back to the app' : 'Go home'}</ButtonLink>
          <ButtonLink to="/contact" variant="secondary">
            Contact support
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
