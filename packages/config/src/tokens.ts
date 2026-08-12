/**
 * ResearchTrics brand design tokens — single source of truth (Spec §3, §96).
 *
 * RULES (Spec §3):
 * - Blue is the dominant brand color; White is the primary surface.
 * - Gold is a RESTRAINED accent (RVM highlights, premium indicators, key metrics,
 *   badges, subtle borders) — never large sections, never body text on white.
 * - Maintain WCAG 2.2 AA contrast.
 *
 * Do not scatter raw hex values through components — consume these tokens
 * (via the Tailwind preset / CSS variables) instead.
 */

export const brandColors = {
  // Primary blues
  blue: '#0B3A82', // ResearchTrics Blue (dominant)
  blueDark: '#082B61', // Deep Academic Blue
  blueRoyal: '#1456A0', // Royal Research Blue
  blueLight: '#EEF5FF', // Light Blue Background

  // Accent golds (restrained)
  gold: '#C9A227',
  goldLight: '#E6D28A',
  goldDark: '#9A7610',

  // Surfaces
  white: '#FFFFFF',
  background: '#F7F9FC', // Neutral Background

  // Text
  text: '#172033', // Text Primary
  muted: '#5E6878', // Text Secondary
  border: '#DCE3ED', // Border

  // Semantic
  success: '#1F7A4D',
  warning: '#B7791F',
  error: '#C53030',
  info: '#2563EB',
} as const;

export type BrandColorToken = keyof typeof brandColors;

/**
 * CSS custom properties (the `--rt-*` contract from Spec §96).
 * Injected into :root by the web app's global stylesheet.
 */
export const cssVariables: Record<string, string> = {
  '--rt-blue': brandColors.blue,
  '--rt-blue-dark': brandColors.blueDark,
  '--rt-blue-royal': brandColors.blueRoyal,
  '--rt-blue-light': brandColors.blueLight,
  '--rt-gold': brandColors.gold,
  '--rt-gold-light': brandColors.goldLight,
  '--rt-gold-dark': brandColors.goldDark,
  '--rt-white': brandColors.white,
  '--rt-background': brandColors.background,
  '--rt-text': brandColors.text,
  '--rt-muted': brandColors.muted,
  '--rt-border': brandColors.border,
  '--rt-success': brandColors.success,
  '--rt-warning': brandColors.warning,
  '--rt-error': brandColors.error,
  '--rt-info': brandColors.info,
};

export function cssVariablesBlock(): string {
  const body = Object.entries(cssVariables)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
  return `:root {\n${body}\n}`;
}

/** Typography (Spec §4): Inter with a robust system fallback. */
export const typography = {
  fontSans:
    'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const radii = {
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
} as const;
