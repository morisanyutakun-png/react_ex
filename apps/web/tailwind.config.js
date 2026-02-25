/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          950: '#450a0a',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'SF Pro Display', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 4px 12px rgba(0, 0, 0, 0.6)',
        'card-hover': '0 0 8px rgba(220, 38, 38, 0.15), 0 4px 16px rgba(0, 0, 0, 0.7)',
        'glow-sm': '0 0 8px rgba(220, 38, 38, 0.4)',
        'glow-md': '0 0 16px rgba(220, 38, 38, 0.5)',
        'glow-lg': '0 0 24px rgba(220, 38, 38, 0.6)',
      },
      borderRadius: {
        'DEFAULT': '0.375rem',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(220, 38, 38, 0.4)' },
          '50%': { boxShadow: '0 0 16px rgba(220, 38, 38, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
