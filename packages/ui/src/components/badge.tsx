import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        neutral: 'bg-rt-blue-light text-rt-blue-dark',
        blue: 'bg-rt-blue text-rt-white',
        gold: 'border border-rt-gold bg-rt-gold-light/40 text-rt-gold-dark',
        success: 'bg-rt-success/10 text-rt-success',
        warning: 'bg-rt-warning/10 text-rt-warning',
        error: 'bg-rt-error/10 text-rt-error',
        outline: 'border border-rt-border text-rt-muted',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
