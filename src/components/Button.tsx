import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'dark';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 select-none disabled:cursor-not-allowed disabled:opacity-55 focus-visible:ring-[3px] focus-visible:ring-sky/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]',
  secondary: 'bg-violet-soft text-ink hover:bg-[#E2E2E2] active:scale-[0.98] dark:hover:bg-white/20',
  ghost: 'text-ink hover:bg-ink/5',
  soft: 'bg-violet-soft text-ink hover:bg-[#E2E2E2] dark:hover:bg-white/20',
  danger: 'bg-primary text-white hover:bg-primary-dark active:scale-[0.98]',
  dark: 'bg-ink text-surface hover:opacity-90 active:scale-[0.98]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-base',
};

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
  external?: boolean;
}

export function ButtonLink({
  to,
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  external,
}: ButtonLinkProps) {
  if (external) {
    return (
      <a
        href={to}
        className={buttonClasses(variant, size, className)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={buttonClasses(variant, size, className)}>
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/80 transition hover:bg-ink/5 hover:text-ink disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
