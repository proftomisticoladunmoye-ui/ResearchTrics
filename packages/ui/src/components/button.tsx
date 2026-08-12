import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

/**
 * Button — brand-tokened, accessible (Spec §5, §51).
 * Blue is dominant; gold is reserved for premium/RVM CTAs, used sparingly.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rt-blue-royal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-rt-blue text-rt-white hover:bg-rt-blue-dark',
        secondary:
          'border border-rt-border bg-rt-white text-rt-text hover:bg-rt-blue-light',
        ghost: 'text-rt-blue hover:bg-rt-blue-light',
        // Restrained gold accent CTA (Spec §3) — for premium/RVM actions only.
        accent: 'bg-rt-gold text-rt-blue-dark hover:bg-rt-gold-dark hover:text-rt-white',
        danger: 'bg-rt-error text-rt-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
