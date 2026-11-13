// Small shared UI primitives.
import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card', className)} {...rest} />;
}

export type Tone = 'pink' | 'violet' | 'teal' | 'sky' | 'sun' | 'gray' | 'success' | 'warning' | 'danger';

const toneClasses: Record<Tone, string> = {
  pink: 'bg-primary-soft text-[#B60000] dark:text-[#FF8F9F]',
  violet: 'bg-violet-soft text-ink',
  teal: 'bg-teal-soft text-[#006B6C] dark:text-[#7FE3CF]',
  sky: 'bg-sky-soft text-[#0060C0] dark:text-[#8CC4FF]',
  sun: 'bg-sunflower-soft text-[#5C4A00] dark:text-[#FFE97A]',
  gray: 'bg-violet-soft text-ink',
  success: 'bg-teal-soft text-[#006B3C] dark:text-[#7FE3B5]',
  warning: 'bg-sunflower-soft text-[#7A3B00] dark:text-[#FFE97A]',
  danger: 'bg-primary-soft text-[#B60000] dark:text-[#FF8F9F]',
};

export function Badge({
  tone = 'gray',
  className,
  children,
  icon,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-primary/25 border-t-primary',
        className,
      )}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-ink/[0.06]', className)} aria-hidden>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent dark:via-white/10" />
    </div>
  );
}

export function ProgressBar({
  value,
  max = 100,
  className,
  label,
}: {
  value: number;
  max?: number;
  className?: string;
  label?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-ink/[0.07]', className)}
    >
      <div
        className="h-full rounded-full bg-sunset transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-muted">{hint}</span>}
    </label>
  );
}

const fieldBase =
  'w-full rounded-2xl border-2 border-line bg-raised px-4 text-[0.95rem] text-ink placeholder:text-muted/70 transition focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, 'h-12', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, 'min-h-[140px] py-3', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        fieldBase,
        'h-12 cursor-pointer appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236E6880' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-semibold text-danger">
      {message}
    </p>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  id,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-bold text-ink">
          {label}
        </label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-sunset' : 'bg-ink/15',
        )}
      >
        <span
          className={cn(
            'absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

export function Checkbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 border-line accent-[#E60023]"
      />
      <span className="text-[0.95rem] text-ink">{children}</span>
    </label>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={cn('mb-10 max-w-2xl', center && 'mx-auto text-center')}>
      {eyebrow && (
        <p className="mb-3 text-sm font-extrabold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      )}
      <h2 className="text-3xl sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-muted">{subtitle}</p>}
    </div>
  );
}

export function Blobs({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute -left-24 -top-24 h-96 w-96 animate-blob rounded-full bg-tint-pink blur-3xl" />
      <div className="absolute -right-24 top-10 h-[28rem] w-[28rem] animate-blob rounded-full bg-tint-teal blur-3xl [animation-delay:-6s]" />
      <div className="absolute bottom-0 left-1/3 h-80 w-80 animate-blob rounded-full bg-tint-sun/70 blur-3xl [animation-delay:-12s]" />
    </div>
  );
}

/** Pinterest-style: every board chip is a neutral grey pill. */
export function boardTone(_key: string): Tone {
  return 'gray';
}

export function toneClass(tone: Tone): string {
  return toneClasses[tone];
}
