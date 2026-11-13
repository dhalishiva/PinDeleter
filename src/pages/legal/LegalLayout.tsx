import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import { SITE } from '@/config/site';

const LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/refund-policy', label: 'Refund Policy' },
  { to: '/cookies', label: 'Cookie Notice' },
  { to: '/disclaimer', label: 'Disclaimer' },
];

export function LegalLayout({
  title,
  path,
  description,
  children,
}: {
  title: string;
  path: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <Seo title={title} path={path} description={description} />
      <div className="bg-tint-violet py-12">
        <div className="container-page max-w-3xl">
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-primary">Legal</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-3 text-muted">
            Effective date: {SITE.legalEffectiveDate} · Last updated: {SITE.legalEffectiveDate}
          </p>
        </div>
      </div>
      <div className="container-page grid max-w-5xl grid-cols-1 gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article className="prose-legal min-w-0">{children}</article>
        <nav aria-label="Legal documents" className="order-first lg:order-none">
          <div className="sticky top-24 rounded-3xl border border-line bg-raised p-4">
            <ul className="space-y-1">
              {LINKS.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className={`block rounded-2xl px-3 py-2 text-sm font-bold ${l.to === path ? 'bg-primary-soft text-primary' : 'text-ink/75 hover:bg-ink/5'}`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>
    </>
  );
}
