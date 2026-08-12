import * as React from 'react';
import { cn } from '../utils/cn';

/** Structured surface. Used sparingly — prefer structure over decoration (Spec §80). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-rt-border bg-rt-white', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('border-b border-rt-border px-5 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-rt-text', className)} {...props} />
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

/**
 * MetricCard — a key statistic. `emphasis="gold"` is the sanctioned restrained
 * use of gold for RVM / premium metrics (Spec §3, §80).
 */
export function MetricCard({
  label,
  value,
  hint,
  emphasis = 'default',
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  emphasis?: 'default' | 'gold';
  className?: string;
}) {
  return (
    <Card className={cn('p-5', className)}>
      <p className="text-sm text-rt-muted">{label}</p>
      <p
        className={cn(
          'mt-1 text-3xl font-semibold tabular-nums',
          emphasis === 'gold' ? 'text-rt-gold-dark' : 'text-rt-text',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-rt-muted">{hint}</p> : null}
    </Card>
  );
}
