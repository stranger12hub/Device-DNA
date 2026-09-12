export const deviceTokens = {
  color: {
    surface: '#FFFFFF',
    canvas: '#F5F5F7',
    text: '#1D1D1F',
    secondaryText: '#6E6E73',
    border: '#D2D2D7',
    accent: '#0071E3',
    good: '#34C759',
    warning: '#FF9F0A',
    critical: '#FF3B30',
  },
  radius: {
    card: '20px',
    control: '16px',
    pill: '999px',
  },
  spacing: {
    touch: '44px',
    nav: '64px',
  },
  type: {
    body: 'var(--font-geist-sans), Inter, -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    mono: 'var(--font-geist-mono), "SF Mono", ui-monospace, monospace',
  },
} as const;
