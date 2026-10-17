import { clsx } from "clsx";
import type { InputHTMLAttributes, ReactElement, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Shared look of text inputs / textareas / selects. */
export function inputClasses(invalid?: boolean, className?: string): string {
  return clsx(
    "w-full rounded-md border bg-panel px-3 text-sm text-fg placeholder:text-muted/70 transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-beige/40 disabled:opacity-60",
    invalid ? "border-red-fg/70 focus:border-red-fg" : "border-line-strong hover:border-muted/60 focus:border-beige/70",
    className,
  );
}

type InvalidProp = { invalid?: boolean };

export function TextInput({ invalid, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & InvalidProp): ReactElement {
  return <input aria-invalid={invalid || undefined} className={inputClasses(invalid, clsx("h-10", className))} {...rest} />;
}

export function TextArea({
  invalid,
  className,
  rows = 4,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp): ReactElement {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      rows={rows}
      className={inputClasses(invalid, clsx("min-h-20 resize-y py-2 leading-relaxed", className))}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & InvalidProp): ReactElement {
  return (
    <select aria-invalid={invalid || undefined} className={inputClasses(invalid, clsx("h-10 pr-8", className))} {...rest}>
      {children}
    </select>
  );
}
