import type { Config } from 'tailwindcss';
import { colors } from '@cortex/ui';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ...colors, 'on-primary': '#0D0020' },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: { card: '14px', field: '10px' },
      boxShadow: {
        'halo-green': '0 0 0 1px rgba(0,255,149,.35), 0 0 24px rgba(0,255,149,.25)',
        'halo-purple': '0 0 0 1px rgba(160,126,252,.4), 0 0 24px rgba(160,126,252,.28)',
        'halo-red': '0 0 0 1px rgba(255,122,154,.5), 0 0 20px rgba(255,122,154,.3)',
      },
      keyframes: {
        pulseHalo: { '0%,100%': { boxShadow: '0 0 0 1px rgba(0,255,149,.5), 0 0 10px rgba(0,255,149,.25)' }, '50%': { boxShadow: '0 0 0 2px rgba(0,255,149,.8), 0 0 28px rgba(0,255,149,.45)' } },
        shake: { '0%,100%': { transform: 'translateX(0)' }, '25%': { transform: 'translateX(-3px)' }, '75%': { transform: 'translateX(3px)' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'pulse-halo': 'pulseHalo 1.2s ease-in-out infinite',
        shake: 'shake .25s ease-in-out 2',
        'fade-in': 'fadeIn .2s ease-out',
      },
    },
  },
  plugins: [],
} satisfies Config;
