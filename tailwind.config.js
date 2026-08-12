/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F6F3EC',
        surface: '#FFFFFF',
        border: '#E6E0D2',
        sidebar: '#1C1814',
        brand: '#9C1B30',
        success: { DEFAULT: '#176038', bg: '#E8F2EC' },
        warning: { DEFAULT: '#8C5708', bg: '#FAF1DC' },
        danger: { DEFAULT: '#8E2418', bg: '#FBEAE7' },
        ink: '#1C1814',
        muted: '#8A8275',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        input: '8px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,24,20,0.04), 0 4px 16px rgba(28,24,20,0.05)',
        card: '0 1px 3px rgba(28,24,20,0.06)',
      },
    },
  },
  plugins: [],
}
