/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#dde6ff',
          200: '#b8cbfe',
          300: '#7b97fb',
          400: '#4f7cfa',
          500: '#3d6df5',
          600: '#2d5be8',
          700: '#1e44cc',
          800: '#1937a5',
          900: '#162e83',
          950: '#0d1a4a',
        },
        navy: {
          bg: '#0d1117',
          card: '#111827',
          elevated: '#161d2e',
          border: '#1e2d4a',
          text: '#e2e8ff',
          muted: '#8892b8',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Helvetica Neue', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.30), 0 0 1px rgba(79,124,250,0.12)',
        'card-hover': '0 8px 28px rgba(0,0,0,0.40), 0 2px 8px rgba(0,0,0,0.25)',
        'soft': '0 1px 3px rgba(0,0,0,0.25), 0 1px 2px rgba(0,0,0,0.15)',
        'elevated': '0 12px 40px rgba(0,0,0,0.40), 0 4px 12px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        'DEFAULT': '0.625rem',
        'apple': '0.75rem',
      },
    },
  },
  plugins: [],
};
