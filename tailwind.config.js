/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        device: {
          blue: '#0071E3',
          cobalt: '#0066CC',
          cyan: '#0071E3',
          midnight: '#1D1D1F',
          carbon: '#1D1D1F',
          ice: '#F5F5F7',
          border: '#D2D2D7',
          darkBorder: '#AEAEB2',
          ink: '#1D1D1F',
          slate: '#6E6E73',
          healthy: '#34C759',
          attention: '#FF9F0A',
          critical: '#FF3B30',
          info: '#0071E3',
          locked: '#6E6E73',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'Helvetica', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
