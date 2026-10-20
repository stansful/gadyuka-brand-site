import { clsx } from 'clsx';
import { LoaderCircle } from 'lucide-react';

import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-beige';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-beige text-ink hover:bg-beige-hi',
  secondary: 'bg-blue text-fg hover:bg-blue-hi',
  ghost: 'text-fg/80 hover:bg-raised-hi hover:text-fg',
  outline: 'border border-line-strong text-fg hover:border-beige/60 hover:bg-raised',
  danger: 'bg-red text-white hover:bg-red-hi',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
};

/** Class string for links styled as buttons (<Link className={buttonClasses(…)}>). */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
): string {
  return clsx(base, variants[variant], sizes[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button. */
  pending?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  pending = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps): ReactElement {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...rest}
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
