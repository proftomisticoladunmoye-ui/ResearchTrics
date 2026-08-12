import type { Config } from 'tailwindcss';
import { brandColors, typography, radii } from './tokens';

/**
 * Shared Tailwind preset. Apps extend this so brand tokens are consumed
 * consistently and never re-declared as raw hex in components (Spec §96).
 */
const preset: Omit<Config, 'content'> = {
  theme: {
    extend: {
      colors: {
        // Brand namespace: text-rt-blue, bg-rt-gold, border-rt-border, etc.
        rt: {
          blue: brandColors.blue,
          'blue-dark': brandColors.blueDark,
          'blue-royal': brandColors.blueRoyal,
          'blue-light': brandColors.blueLight,
          gold: brandColors.gold,
          'gold-light': brandColors.goldLight,
          'gold-dark': brandColors.goldDark,
          white: brandColors.white,
          background: brandColors.background,
          text: brandColors.text,
          muted: brandColors.muted,
          border: brandColors.border,
          success: brandColors.success,
          warning: brandColors.warning,
          error: brandColors.error,
          info: brandColors.info,
        },
      },
      fontFamily: {
        sans: typography.fontSans.split(',').map((s) => s.trim()),
        mono: typography.fontMono.split(',').map((s) => s.trim()),
      },
      borderRadius: {
        sm: radii.sm,
        DEFAULT: radii.md,
        lg: radii.lg,
      },
    },
  },
  plugins: [],
};

export default preset;
