import * as React from 'react';
import { cn } from '../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** Text input with accessible focus + invalid states (Spec §51). */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded border bg-rt-white px-3 text-sm text-rt-text placeholder:text-rt-muted',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rt-blue-royal focus-visible:ring-offset-1',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-rt-error' : 'border-rt-border',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

/** Accessible label + optional error message wrapper. */
export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-rt-text">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-rt-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
