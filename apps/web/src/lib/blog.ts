/**
 * Blog cover design tokens. Posts themselves live in the database (authored in
 * the admin console); this only maps a post's `tone` to its branded cover
 * gradient, used as the display picture across the blog and the Discover rail.
 */
export type CoverTone = 'blue' | 'gold' | 'green' | 'violet';

export const COVER_GRADIENT: Record<CoverTone, string> = {
  blue: 'from-rt-blue to-rt-blue-dark',
  gold: 'from-rt-gold to-rt-blue',
  green: 'from-rt-success to-rt-blue',
  violet: 'from-[#6d5ae6] to-rt-blue',
};

export function coverGradient(tone: string): string {
  return COVER_GRADIENT[(tone as CoverTone) in COVER_GRADIENT ? (tone as CoverTone) : 'blue'];
}
