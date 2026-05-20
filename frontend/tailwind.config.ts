import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#000000',
          surface: '#0a0a0a',
          panel: '#111111',
        },
        border: { DEFAULT: '#222222', hover: '#333333' },
        accent: {
          DEFAULT: '#E8003D',
          hover: '#C0002F',
          dim: 'rgba(232,0,61,0.15)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A0A0A0',
          disabled: '#444444',
        },
        status: {
          ready: '#22C55E',
          processing: '#F59E0B',
          error: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 40px rgba(232, 0, 61, 0.15)',
        'glow-lg': '0 0 80px rgba(232, 0, 61, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
