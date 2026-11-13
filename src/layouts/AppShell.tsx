import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  CreditCard,
  Grid3x3,
  History,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { DemoBadge } from '@/components/widgets';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthProvider';
import { useActiveConnection } from '@/features/connections/hooks';
import { SITE } from '@/config/site';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/pins', label: 'Pins', icon: Grid3x3 },
  { to: '/app/jobs', label: 'Jobs', icon: History },
  { to: '/app/accounts', label: 'Accounts', icon: Users },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function Avatar({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full bg-sunset font-black text-white"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AccountSwitcher() {
  const { connection, connections, setActive } = useActiveConnection();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!connection) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border-2 border-line bg-raised py-1 pl-1 pr-3 text-sm font-bold hover:border-violet/40"
      >
        <Avatar src={connection.profile_image} name={connection.username} />
        <span className="max-w-[9rem] truncate">@{connection.username}</span>
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Pinterest accounts"
          className="absolute right-0 z-50 mt-2 w-64 rounded-3xl border border-line bg-raised p-2 shadow-lift"
        >
          {connections.map((c) => (
            <button
              key={c.id}
              role="option"
              aria-selected={c.id === connection.id}
              type="button"
              onClick={() => {
                setActive(c.id);
                setOpen(false);
                if (location.pathname.startsWith('/app/pins')) navigate(`/app/pins?connection=${c.id}`);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm font-bold hover:bg-ink/5',
                c.id === connection.id && 'bg-primary-soft',
              )}
            >
              <Avatar src={c.profile_image} name={c.username} />
              <span className="truncate">@{c.username}</span>
              {c.status === 'error' && <span className="ml-auto text-xs text-danger">reconnect</span>}
            </button>
          ))}
          <Link
            to="/app/accounts"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-violet hover:bg-violet-soft"
          >
            <Plus className="h-4 w-4" aria-hidden /> Manage accounts
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-xl">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-surface"
        >
          Skip to content
        </a>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Link to="/app" aria-label="PinDeleter app home" className="shrink-0">
            <span className="hidden sm:inline">
              <Logo size={30} />
            </span>
            <span className="sm:hidden">
              <Logo variant="mark" size={32} />
            </span>
          </Link>
          <DemoBadge className="hidden sm:inline-flex" />
          <nav aria-label="App" className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-bold transition',
                    isActive ? 'bg-primary-soft text-primary' : 'text-ink/70 hover:bg-ink/5 hover:text-ink',
                  )
                }
              >
                <n.icon className="h-4 w-4" aria-hidden />
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <DemoBadge className="sm:hidden" />
            <AccountSwitcher />
            <Link
              to="/app/settings"
              aria-label="Settings"
              title="Settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink md:hidden"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              aria-label={`Sign out ${user?.email ?? ''}`}
              title="Sign out"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-ink/5 hover:text-ink"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-12">
        <Outlet />
      </main>
      <footer className="hidden border-t border-line py-6 md:block">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 text-xs text-muted">
          <p className="max-w-3xl">{SITE.disclaimer}</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link to="/contact" className="hover:text-ink">
              Support
            </Link>
            <ThemeToggle compact />
          </div>
        </div>
      </footer>
      <nav
        aria-label="App mobile"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <div className="grid grid-cols-5">
          {NAV.filter((n) => n.to !== '/app/settings').map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] font-bold',
                  isActive ? 'text-primary' : 'text-muted',
                )
              }
            >
              <n.icon className="h-5 w-5" aria-hidden />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
