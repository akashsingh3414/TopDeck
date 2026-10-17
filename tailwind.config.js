/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Segoe UI Variable Text"',
          '"Segoe UI"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'sans-serif',
        ],
      },
      // TopDeck theme: pure black island, one accent, semantic status colors only
      colors: {
        ink: {
          DEFAULT: '#F5F5F7',
          muted: '#98989D',
          faint: '#636366',
        },
        accent: {
          DEFAULT: '#0A84FF',
          hover: '#409CFF',
        },
        ok: '#30D158',
        warn: '#FF9F0A',
        danger: '#FF453A',
      },
      fontSize: {
        micro: ['10px', { lineHeight: '12px', letterSpacing: '0.04em' }],
        caption: ['11px', { lineHeight: '14px' }],
      },
    },
  },
  plugins: [],
}
