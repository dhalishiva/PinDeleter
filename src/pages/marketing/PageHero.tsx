import type { ReactNode } from 'react';
import { Blobs } from '@/components/ui';

export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden pb-12 pt-12 sm:pt-16">
      <Blobs className="opacity-70" />
      <div className="container-page max-w-3xl text-center">
        <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {children && <div className="mx-auto mt-5 max-w-2xl text-lg text-muted">{children}</div>}
      </div>
    </section>
  );
}
