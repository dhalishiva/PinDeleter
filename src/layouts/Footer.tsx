import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { fullAddress, SITE } from '@/config/site';

const columns: { title: string; links: { to: string; label: string; external?: boolean }[] }[] = [
  {
    title: 'Product',
    links: [
      { to: '/how-it-works', label: 'How it works' },
      { to: '/pricing', label: 'Pricing' },
      { to: '/faq', label: 'FAQ' },
      { to: '/signup', label: 'Get started free' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/contact', label: 'Contact' },
      { to: SITE.operatorUrl, label: 'Kriosity', external: true },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/privacy', label: 'Privacy Policy' },
      { to: '/terms', label: 'Terms of Service' },
      { to: '/refund-policy', label: 'Refund Policy' },
      { to: '/cookies', label: 'Cookie Notice' },
      { to: '/disclaimer', label: 'Disclaimer' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-tint-pink">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-muted">
              Bulk-delete your own Pinterest pins safely — with filters, a backup and a dry run.
            </p>
            <a
              href={`mailto:${SITE.supportEmail}`}
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-violet hover:underline"
            >
              <Mail className="h-4 w-4" aria-hidden /> {SITE.supportEmail}
            </a>
            <div className="mt-5">
              <ThemeToggle />
            </div>
          </div>
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-ink/60">
                {col.title}
              </h2>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.to}>
                    {l.external ? (
                      <a
                        href={l.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-ink/80 hover:text-primary"
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link to={l.to} className="text-sm font-semibold text-ink/80 hover:text-primary">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-12 space-y-2 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p>{SITE.disclaimer}</p>
          <p>
            © {new Date().getFullYear()} {SITE.operator} (proprietor: {SITE.proprietor}) · {fullAddress()}
          </p>
        </div>
      </div>
    </footer>
  );
}
