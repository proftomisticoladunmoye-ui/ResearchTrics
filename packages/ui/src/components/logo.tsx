import { cn } from '../utils/cn';

/**
 * ResearchTrics wordmark (Spec §81). Blue wordmark with a restrained gold accent
 * on "Trics" and a subtle research-network node mark. No cliché iconography
 * (no magnifying glass / cap / globe / brain / book).
 *
 * `variant`:
 *  - 'color'  : blue + gold on light surfaces (default)
 *  - 'mono'   : single-color (uses currentColor) for print/monochrome
 *  - 'onDark' : white + gold for dark/blue backgrounds
 */
export interface LogoProps {
  variant?: 'color' | 'mono' | 'onDark';
  showMark?: boolean;
  /**
   * URL of the official brand mark image (e.g. "/logo-mark.png"). When set, the
   * real ResearchTrics R-mark is rendered; otherwise the inline SVG fallback is
   * used (handy for environments without the asset).
   */
  markSrc?: string;
  className?: string;
}

export function Logo({ variant = 'color', showMark = true, markSrc, className }: LogoProps) {
  const research =
    variant === 'onDark'
      ? 'text-rt-white'
      : variant === 'mono'
        ? 'text-current'
        : 'text-rt-blue';
  const trics =
    variant === 'mono'
      ? 'text-current'
      : variant === 'onDark'
        ? 'text-rt-gold-light'
        : 'text-rt-gold';

  const nodeStroke = variant === 'onDark' ? '#FFFFFF' : variant === 'mono' ? 'currentColor' : '#0B3A82';
  const nodeAccent = variant === 'onDark' ? '#E6D28A' : variant === 'mono' ? 'currentColor' : '#C9A227';

  return (
    <span className={cn('inline-flex items-center gap-2 font-sans', className)}>
      {showMark && markSrc ? (
        <img src={markSrc} alt="" aria-hidden="true" className="h-7 w-7 shrink-0 object-contain" />
      ) : showMark ? (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          {/* Research-network nodes + edges (Spec §81) */}
          <line x1="6" y1="6" x2="12" y2="12" stroke={nodeStroke} strokeWidth="1.5" />
          <line x1="18" y1="7" x2="12" y2="12" stroke={nodeStroke} strokeWidth="1.5" />
          <line x1="7" y1="18" x2="12" y2="12" stroke={nodeStroke} strokeWidth="1.5" />
          <circle cx="6" cy="6" r="2.2" fill={nodeStroke} />
          <circle cx="18" cy="7" r="2.2" fill={nodeStroke} />
          <circle cx="7" cy="18" r="2.2" fill={nodeStroke} />
          <circle cx="12" cy="12" r="2.6" fill={nodeAccent} />
        </svg>
      ) : null}
      <span className="text-lg font-semibold tracking-tight">
        <span className={research}>Research</span>
        <span className={trics}>Trics</span>
      </span>
    </span>
  );
}
