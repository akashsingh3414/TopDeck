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
      colors: {
        island: {
          bg: '#000000',
          pill: '#000000',
          card: '#121212',
          subtle: '#262626',
          muted: '#8e8e93',
          border: 'rgba(255, 255, 255, 0.12)',
        },
      },
      boxShadow: {
        'island': '0 12px 36px rgba(0, 0, 0, 0.65), 0 0 1px 1px rgba(255, 255, 255, 0.08)',
        'island-glow': '0 0 24px rgba(255, 255, 255, 0.06)',
      },
      borderRadius: {
        'island-idle': '20px',
        'island-peek': '24px',
        'island-expanded': '32px',
      },
    },
  },
  plugins: [],
}
