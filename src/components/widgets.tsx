import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { useAppConfig } from '@/features/config/useAppConfig';
import { Badge, type Tone } from './ui';

export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const dur = 600;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, reduce]);
  return <span className={cn('tabular-nums', className)}>{formatNumber(display)}</span>;
}

const tileTone: Record<string, string> = {
  pink: 'bg-primary-soft',
  violet: 'bg-violet-soft',
  teal: 'bg-teal-soft',
  sky: 'bg-sky-soft',
  sun: 'bg-sunflower-soft',
};

export function StatTile({
  label,
  value,
  icon,
  tone = 'violet',
  suffix,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
  tone?: 'pink' | 'violet' | 'teal' | 'sky' | 'sun';
  suffix?: ReactNode;
}) {
  return (
    <div className={cn('rounded-3xl p-5 transition hover:-translate-y-0.5', tileTone[tone])}>
      <div className="flex items-center justify-between text-sm font-bold text-ink/70">
        <span>{label}</span>
        {icon}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight text-ink">
        <AnimatedCounter value={value} />
        {suffix}
      </div>
    </div>
  );
}

export function EmptyState({
  illustration,
  title,
  children,
  action,
}: {
  illustration: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12 text-center">
      <div className="mb-6">{illustration}</div>
      <h2 className="text-2xl">{title}</h2>
      {children && <div className="mt-2 text-muted">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  const { data } = useAppConfig();
  if (!data?.mockMode) return null;
  return (
    <Badge tone="sun" className={className} icon={<Sparkles className="h-3.5 w-3.5" aria-hidden />}>
      <span title="Demo mode: Pinterest is simulated with sample data. Nothing real is deleted.">
        Demo mode
      </span>
    </Badge>
  );
}

export function StatusDot({ tone }: { tone: Tone }) {
  const colors: Partial<Record<Tone, string>> = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    violet: 'bg-violet',
    sky: 'bg-sky',
    gray: 'bg-muted',
  };
  return <span className={cn('inline-block h-2 w-2 rounded-full', colors[tone] ?? 'bg-muted')} aria-hidden />;
}
