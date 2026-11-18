/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mms: {
          primary: '#693198',
          'primary-dark': '#4f2174',
          'primary-soft': '#f3eaf9',
          gold: '#f4bb4c',
          'gold-soft': '#fdf3dd',
          teal: '#007f7d',
          ink: '#190721',
          'ink-muted': '#5c5563',
          bg: '#ffffff',
          surface: '#f9f9f9',
          border: '#e5e1ea',
        },
        status: {
          submitted: { bg: '#ecfeff', fg: '#0e7490' },
          assigned: { bg: '#eff6ff', fg: '#1d4ed8' },
          progress: { bg: '#fffbeb', fg: '#b45309' },
          completed: { bg: '#f0fdf4', fg: '#15803d' },
          rejected: { bg: '#fef2f2', fg: '#b91c1c' },
        },
        priority: {
          normal: { bg: '#f1f5f9', fg: '#475569' },
          high: { bg: '#fff7ed', fg: '#c2410c' },
          urgent: { bg: '#fef2f2', fg: '#b91c1c' },
        },
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(25, 7, 33, 0.05)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
}
