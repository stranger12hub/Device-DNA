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
          blue: '#315A7D',
          cobalt: '#244762',
          cyan: '#57A6B8',
          midnight: '#080B11',
          carbon: '#111722',
          ice: '#F6F8FC',
          border: '#DCE3ED',
          darkBorder: '#263247',
          ink: '#111827',
          slate: '#667085',
          healthy: '#23835B',
          attention: '#D08A24',
          critical: '#C84B44',
          info: '#3D68D8',
          locked: '#343A38',
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
