/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // COCKSTAR "Performance" palette
        ink: {
          DEFAULT: '#0B0B0C',
          soft: '#161618',
          mute: '#26262A',
        },
        volt: {
          DEFAULT: '#CCFF00', // signature electric-lime accent
          dark: '#AEDB00',
          deep: '#7C9C00',
        },
        paper: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Pretendard', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      boxShadow: {
        'volt': '0 8px 30px -8px rgba(204, 255, 0, 0.55)',
        'ink': '0 18px 40px -18px rgba(0, 0, 0, 0.65)',
        'card': '0 2px 14px -6px rgba(0, 0, 0, 0.12)',
        'float': '0 12px 34px -12px rgba(0, 0, 0, 0.28)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'volt-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(204,255,0,0.55)' },
          '50%': { boxShadow: '0 0 0 8px rgba(204,255,0,0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.5s ease both',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'marquee': 'marquee 22s linear infinite',
        'marquee-fast': 'marquee 12s linear infinite',
        'volt-pulse': 'volt-pulse 1.6s ease-out infinite',
        'shimmer': 'shimmer 1.6s linear infinite',
        'pop': 'pop 0.4s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
