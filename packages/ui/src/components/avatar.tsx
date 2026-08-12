import { cn } from '../utils/cn';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

export interface AvatarProps {
  name: string;
  src?: string | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-lg' } as const;

/** Avatar with initials fallback and required alt text (Spec §51). */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const base = cn(
    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
    SIZES[size],
    className,
  );
  if (src) {
    return <img src={src} alt={name} className={cn(base, 'object-cover')} />;
  }
  return (
    <span className={cn(base, 'bg-rt-blue text-rt-white font-medium')} aria-label={name} role="img">
      {initials(name)}
    </span>
  );
}
