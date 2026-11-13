import { useId } from 'react';
import { cn } from '@/lib/cn';

interface LogoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Original app mark: sunset rounded square, white location-style pin with an "×" and a sweep trail. */
export function LogoMark({ size = 36, className, title }: LogoMarkProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E60023" />
          <stop offset="0.55" stopColor="#E60023" />
          <stop offset="1" stopColor="#E60023" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#g-${id})`} />
      <path
        d="M47 44c4-1.5 6.5-4.5 7.5-8.5"
        stroke="#fff"
        strokeOpacity=".75"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M50.5 48.5c2.2-.6 3.8-1.8 5-3.4"
        stroke="#fff"
        strokeOpacity=".5"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 10.5c-9.1 0-16.5 7.2-16.5 16.1 0 11.4 13.7 24.6 15.4 26.2a1.6 1.6 0 0 0 2.2 0c1.7-1.6 15.4-14.8 15.4-26.2 0-8.9-7.4-16.1-16.5-16.1z"
        fill="#fff"
      />
      <path
        d="M24.6 21.4l10.8 10.8M35.4 21.4L24.6 32.2"
        stroke={`url(#g-${id})`}
        strokeWidth="4.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface LogoProps {
  variant?: 'mark' | 'full';
  tone?: 'dark' | 'light';
  size?: number;
  className?: string;
}

export function Logo({ variant = 'full', tone = 'dark', size = 34, className }: LogoProps) {
  if (variant === 'mark') return <LogoMark size={size} className={className} title="PinDeleter" />;
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark size={size} />
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span
          className={cn(
            'text-[1.2rem] font-extrabold leading-none tracking-tight',
            tone === 'light' ? 'text-white' : 'text-ink',
          )}
          style={{ letterSpacing: '-0.035em' }}
        >
          PinDeleter
        </span>
        <span className={cn('text-[0.68rem] font-medium', tone === 'light' ? 'text-white/70' : 'text-muted')}>
          by Kriosity
        </span>
      </span>
    </span>
  );
}
