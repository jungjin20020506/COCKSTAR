/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // COCKSTAR "Blackout" — dark performance palette
        ink: '#08090C',       // app base
        surface: '#101217',   // raised surface
        card: '#171A21',      // card
        card2: '#1E222B',     // nested / input
        volt: {
          DEFAULT: '#CDFB47', // signature neon lime
          dark: '#B4E52E',
          deep: '#9BCB1F',
        },
        coral: {
          DEFAULT: '#FF6A52', // secondary accent
          dark: '#E85539',
        },
        txt: '#F3F5F8',       // primary text
        dim: '#8C93A1',       // dimmed text
        muted: '#565D6B',     // muted text
      },
      fontFamily: {
        sans: ['Pretendard', 'Noto Sans KR', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Anton', 'Pretendard', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        label: '0.18em',
      },
      boxShadow: {
        'volt': '0 8px 34px -8px rgba(205, 251, 71, 0.45)',
        'coral': '0 8px 34px -8px rgba(255, 106, 82, 0.45)',
        'deep': '0 20px 50px -20px rgba(0, 0, 0, 0.8)',
        'card': '0 4px 20px -8px rgba(0, 0, 0, 0.6)',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(205,251,71,0.5)' },
          '50%': { boxShadow: '0 0 0 8px rgba(205,251,71,0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '60%': { transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '45%': { opacity: '1' },
          '50%': { opacity: '0.35' },
          '55%': { opacity: '1' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(-14px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.5s ease both',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'marquee': 'marquee 22s linear infinite',
        'volt-pulse': 'volt-pulse 1.6s ease-out infinite',
        'pop': 'pop 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'flicker': 'flicker 2.4s ease-in-out infinite',
        'toast-in': 'toast-in 0.28s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}
