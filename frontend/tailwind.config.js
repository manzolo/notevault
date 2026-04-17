/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['var(--font-sans)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'Cambria', 'serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        primary: {
          50:  '#f3f0ff',
          100: '#ebe5ff',
          200: '#d9cfff',
          300: '#bfadff',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        vault: {
          950: '#08091a',
          900: '#0c0e1c',
          800: '#13162e',
          700: '#1d2040',
          600: '#282d54',
          500: '#313762',
          400: '#434d80',
          300: '#7480a8',
          200: '#9faabf',
          100: '#cdd3e4',
          50:  '#eceef7',
        },
        cream: {
          50:  '#fdfcf9',
          100: '#f8f5ee',
          200: '#f0ebe0',
          300: '#e5ddd0',
          400: '#d6ccbb',
          500: '#c4b9a5',
        },
      },
      boxShadow: {
        card:         '0 1px 4px 0 rgb(0 0 0 / 0.10), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'card-hover': '0 8px 28px 0 rgb(0 0 0 / 0.20), 0 2px 8px -2px rgb(0 0 0 / 0.14)',
        glow:         '0 0 28px rgb(139 92 246 / 0.24)',
        'glow-sm':    '0 0 14px rgb(139 92 246 / 0.16)',
        'amber-glow': '0 0 20px rgb(245 158 11 / 0.20)',
        modal:        '0 32px 96px -12px rgb(0 0 0 / 0.65)',
        nav:          '0 1px 0 0 rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
