import type { Config } from 'tailwindcss';

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: { DEFAULT: '#E60023', soft: v('primary-soft'), dark: '#AD081B' },
        tangerine: '#E60023',
        // Pinterest-style neutral: near-black in light mode, near-white in dark mode; soft = #E9E9E9 grey pills.
        violet: { DEFAULT: v('violet'), soft: v('violet-soft') },
        teal: { DEFAULT: '#008753', soft: v('teal-soft') },
        sky: { DEFAULT: '#0074E8', soft: v('sky-soft') },
        sunflower: { DEFAULT: '#E0A500', soft: v('sunflower-soft') },
        surface: v('surface'),
        raised: v('raised'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        tint: {
          pink: v('tint-pink'),
          violet: v('tint-violet'),
          teal: v('tint-teal'),
          sun: v('tint-sun'),
        },
        success: '#008753',
        warning: '#BD5B00',
        danger: '#CC0000',
      },
      backgroundImage: {
        // Pinterest red, kept under the old token name so every primary surface switches at once.
        sunset: 'linear-gradient(#E60023, #E60023)',
        'sunset-soft': 'linear-gradient(#FFE2EB, #FFE2EB)',
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        glow: '0 1px 2px rgba(0, 0, 0, 0.06)',
        'glow-violet': '0 1px 2px rgba(0, 0, 0, 0.06)',
        card: '0 1px 2px rgba(0, 0, 0, 0.04)',
        lift: '0 1px 20px rgba(0, 0, 0, 0.1)',
      },
      letterSpacing: { tightest: '-0.04em' },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0) rotate(var(--r, 0deg))' },
          '50%': { transform: 'translateY(-12px) rotate(calc(var(--r, 0deg) + 2deg))' },
        },
        blob: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(30px,-20px) scale(1.08)' },
          '66%': { transform: 'translate(-20px,20px) scale(0.95)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        blob: 'blob 18s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;
