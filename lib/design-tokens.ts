import type { CSSProperties } from 'react';

export const dnaTokens = {
  colors: {
    background: '#FFFFFF',
    surface: '#F5F5F7',
    textPrimary: '#1D1D1F',
    textSecondary: '#6E6E73',
    textMuted: '#9A9A9E',
    accent: '#0071E3',
    success: '#34C759',
    successText: '#248A3D',
    warning: '#FF9F0A',
    danger: '#FF3B30',
    border: '#E5E5E7',
  },
  radius: {
    card: '20px',
    control: '18px',
    pill: '999px',
  },
  spacing: {
    unit: '8px',
    touchTarget: '44px',
    authenticatedNavHeight: '64px',
  },
  fontWeight: {
    regular: 400,
    medium: 500,
  },
} as const;

export const dnaCssVariables: CSSProperties & Record<string, string> = {
  '--dna-background': dnaTokens.colors.background,
  '--dna-surface': dnaTokens.colors.surface,
  '--dna-text-primary': dnaTokens.colors.textPrimary,
  '--dna-text-secondary': dnaTokens.colors.textSecondary,
  '--dna-text-muted': dnaTokens.colors.textMuted,
  '--dna-accent': dnaTokens.colors.accent,
  '--dna-success': dnaTokens.colors.success,
  '--dna-success-text': dnaTokens.colors.successText,
  '--dna-warning': dnaTokens.colors.warning,
  '--dna-danger': dnaTokens.colors.danger,
  '--dna-border': dnaTokens.colors.border,
  '--dna-card-radius': dnaTokens.radius.card,
  '--dna-control-radius': dnaTokens.radius.control,
  '--dna-pill-radius': dnaTokens.radius.pill,
  '--dna-touch-target': dnaTokens.spacing.touchTarget,
  '--dna-nav-height': dnaTokens.spacing.authenticatedNavHeight,
};

export const ui = {
  page: 'min-h-screen bg-[var(--dna-background)] text-[var(--dna-text-primary)]',
  appPage: 'min-h-screen bg-[var(--dna-surface)] text-[var(--dna-text-primary)]',
  panel: 'rounded-[var(--dna-card-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)]',
  field:
    'min-h-[var(--dna-touch-target)] w-full rounded-[var(--dna-control-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] px-4 text-[15px] font-normal text-[var(--dna-text-primary)] outline-none placeholder:text-[var(--dna-text-secondary)] focus:border-[var(--dna-accent)] disabled:bg-[var(--dna-surface)] disabled:text-[var(--dna-text-secondary)]',
  primaryButton:
    'inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[var(--dna-pill-radius)] bg-[var(--dna-accent)] px-5 text-center text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[var(--dna-border)] disabled:text-[var(--dna-text-muted)]',
  secondaryButton:
    'inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[var(--dna-pill-radius)] border border-[var(--dna-border)] bg-[var(--dna-background)] px-5 text-center text-[15px] font-medium text-[var(--dna-text-primary)] disabled:cursor-not-allowed disabled:opacity-50',
  textSecondary: 'text-[var(--dna-text-secondary)]',
  textPrimary: 'text-[var(--dna-text-primary)]',
  link: 'text-[var(--dna-accent)]',
} as const;
