'use client';

import { cn } from '@/lib/utils';

/* ---------- Button ---------- */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'relative inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none',
        'transition-all duration-200 active:scale-[0.98]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'px-3.5 py-1.5 text-[13px]',
        size === 'md' && 'px-5 py-2.5 text-sm',
        size === 'lg' && 'px-7 py-3 text-[15px]',
        variant === 'primary' &&
          'text-white bg-linear-to-r from-primary to-[var(--primary-2)] shadow-[0_4px_14px_rgba(99,102,241,.35)] hover:shadow-[0_6px_20px_rgba(99,102,241,.45)] hover:-translate-y-px',
        variant === 'outline' &&
          'border border-edge bg-surface text-text hover:border-primary hover:text-primary',
        variant === 'ghost' && 'text-muted-fg hover:text-primary hover:bg-primary/5',
        variant === 'danger' && 'border border-edge text-red-500 hover:bg-red-500/10 hover:border-red-300',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      )}
      {children}
    </button>
  );
}

/* ---------- Card ---------- */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-edge bg-surface shadow-[0_10px_30px_-12px_rgba(99,102,241,.12)]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ---------- Input ---------- */
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };
export function Input({ className, hasError, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-text placeholder:text-muted-fg/60',
        'transition focus:outline-none focus:ring-4',
        hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : 'border-edge focus:border-primary focus:ring-primary/15',
        className
      )}
      {...props}
    />
  );
}

/* ---------- Label ---------- */
export function Label({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-fg"
      {...props}
    >
      {children}
    </label>
  );
}

/* ---------- Spinner ---------- */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-12 w-12 animate-spin rounded-full border-4 border-edge border-t-primary mx-auto',
        className
      )}
    />
  );
}

/* ---------- Logo ---------- */
export function Logo({ size = 'md', href }: { size?: 'sm' | 'md' | 'lg'; href?: string }) {
  const badge = size === 'sm' ? 'h-6 w-6 rounded-[7px]' : size === 'lg' ? 'h-10 w-10 rounded-xl' : 'h-7.5 w-7.5 rounded-lg';
  const spark = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-4.5 w-4.5';
  const inner = (
    <span className="inline-flex items-center gap-2.5 font-extrabold">
      <span className={cn('grid shrink-0 place-items-center bg-linear-to-br from-primary to-[var(--primary-2)] shadow-[0_3px_10px_-2px_rgba(99,102,241,.5)]', badge)}>
        <svg viewBox="0 0 24 24" className={spark}>
          <path fill="#fff" d="M12 4l2.2 5.8L20 12l-5.8 2.2L12 20l-2.2-5.8L4 12l5.8-2.2z" />
        </svg>
      </span>
      <span className={cn('bg-linear-to-r from-primary to-[var(--primary-2)] bg-clip-text text-transparent', size === 'sm' && 'text-lg', size === 'md' && 'text-[21px]', size === 'lg' && 'text-3xl')}>
        Easier
      </span>
    </span>
  );
  return href ? <a href={href}>{inner}</a> : inner;
}

/* ---------- Badge / Chip ---------- */
export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary',
        className
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Toast (uses sonner) ---------- */
export { toast as notify } from 'sonner';

/* ---------- EmptyState ---------- */
export function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 animate-fade-up">
      <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-3xl">
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-fg">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
