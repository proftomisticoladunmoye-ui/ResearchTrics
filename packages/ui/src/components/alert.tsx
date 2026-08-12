import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

/** Alert — never relies on color alone; includes a text label (Spec §51). */
const alertVariants = cva('flex gap-3 rounded-lg border p-4 text-sm', {
  variants: {
    variant: {
      info: 'border-rt-info/30 bg-rt-blue-light text-rt-text',
      success: 'border-rt-success/30 bg-rt-success/5 text-rt-text',
      warning: 'border-rt-warning/30 bg-rt-warning/5 text-rt-text',
      error: 'border-rt-error/30 bg-rt-error/5 text-rt-text',
    },
  },
  defaultVariants: { variant: 'info' },
});

const LABELS: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, string> = {
  info: 'Information',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

export function Alert({ className, variant = 'info', title, children, ...props }: AlertProps) {
  const v = variant ?? 'info';
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <div className="flex-1">
        <p className="font-semibold">{title ?? LABELS[v]}</p>
        {children ? <div className="mt-1 text-rt-muted">{children}</div> : null}
      </div>
    </div>
  );
}
