/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        // Soviet Constructivism - Warm Lightened Palette
        'accent': {
          DEFAULT: '#d64545',  // Revolutionary Red (brightened)
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#f28b8b',
          400: '#e85d5d',
          500: '#d64545',
          600: '#b83a3a',
          700: '#9a2f2f',
          800: '#7f2626',
          900: '#691f1f'
        },
        // Industrial Gold
        'gold': {
          DEFAULT: '#c9a227',
          300: '#e8cf6a',
          400: '#dab948',
          500: '#c9a227',
          600: '#a68619',
          700: '#856b14'
        },
        // Steel Gray
        'steel': {
          DEFAULT: '#6b7d8a',
          300: '#9fb0be',
          400: '#8499a8',
          500: '#6b7d8a',
          600: '#4a5966',
          700: '#3a464f'
        },
        // Warm Gray Surfaces
        'surface': {
          DEFAULT: '#252220',
          50: '#f5f0e8',
          100: '#e8e0d4',
          200: '#c4bdb3',
          300: '#9a938a',
          400: '#6b635a',
          500: '#5a534b',
          600: '#443f39',
          700: '#3b3632',
          750: '#322e2a',
          800: '#2b2825',
          850: '#252220',
          900: '#1f1c1a',
          950: '#1a1814'
        },
        // Semantic Colors (warmer)
        'success': '#5a9a6b',
        'warning': '#c9a227',
        'error': '#d64545',
        'info': '#6b7d8a',
        'running': '#5a9a6b',
        // Text Colors (ivory/cream)
        'text': {
          primary: '#f5f0e8',
          secondary: '#c4bdb3',
          tertiary: '#9a938a',
          muted: '#8a8279',
          accent: '#e8e0d4'
        }
      },
      fontFamily: {
        display: ['Bebas Neue', 'Oswald', 'Anton', 'sans-serif'],
        sans: ['Inter', 'Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      fontSize: {
        'hero': ['48px', { lineHeight: '56px', fontWeight: '400' }],
        'display': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'h1': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'h2': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'body': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'micro': ['11px', { lineHeight: '14px', fontWeight: '400' }],
        'mono': ['13px', { lineHeight: '20px', fontWeight: '400' }]
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '88': '22rem',
        '128': '32rem'
      },
      borderRadius: {
        'sm': '2px',
        'DEFAULT': '4px',
        'md': '4px',
        'lg': '4px',
        'xl': '4px',
        '2xl': '4px'
      },
      boxShadow: {
        'glow': '0 0 20px var(--red-overlay, rgba(214, 69, 69, 0.4))',
        'glow-sm': '0 0 10px var(--red-overlay, rgba(214, 69, 69, 0.3))',
        'glow-gold': '0 0 15px var(--gold-overlay, rgba(201, 162, 39, 0.3))',
        'glow-success': '0 0 15px var(--success-overlay, rgba(90, 154, 107, 0.3))',
        'card': '0 2px 4px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 4px 8px rgba(0, 0, 0, 0.4)',
        'elevated': '0 8px 16px rgba(0, 0, 0, 0.4)',
        'inner-glow': 'inset 0 1px 0 0 rgba(245, 240, 232, 0.05)',
        'none': 'none'
      },
      animation: {
        'sidebar-enter': 'sidebar-slide-in 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'nav-slide': 'nav-slide-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'panel-enter': 'panel-diagonal-in 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        'panel-slide-up': 'panel-slide-up 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
        'card-stagger': 'card-stagger-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'gear-spin': 'gear-rotate 3s linear infinite',
        'lightning': 'lightning-flash 1.5s ease-in-out infinite',
        'number-punch': 'number-punch 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'dialog-enter': 'dialog-enter 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'dialog-exit': 'dialog-leave 0.2s ease-in forwards',
        'backdrop-fade': 'backdrop-fade 0.2s ease-out',
        'status-pulse': 'status-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'slide-left': 'slide-in-left 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        'bar-extend': 'bar-extend 0.2s ease-out forwards'
      },
      keyframes: {
        'sidebar-slide-in': {
          'from': { transform: 'translateX(-100%)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' }
        },
        'nav-slide-in': {
          'from': { opacity: '0', transform: 'translateX(-20px)' },
          'to': { opacity: '1', transform: 'translateX(0)' }
        },
        'panel-diagonal-in': {
          'from': { transform: 'translate(-20px, 10px)', opacity: '0' },
          'to': { transform: 'translate(0, 0)', opacity: '1' }
        },
        'panel-slide-up': {
          'from': { transform: 'translateY(15px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' }
        },
        'card-stagger-in': {
          'from': { opacity: '0', transform: 'translateX(-15px)' },
          'to': { opacity: '1', transform: 'translateX(0)' }
        },
        'gear-rotate': {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' }
        },
        'lightning-flash': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1', filter: 'drop-shadow(0 0 4px #c9a227)' }
        },
        'number-punch': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)', color: '#c9a227' },
          '100%': { transform: 'scale(1)' }
        },
        'dialog-enter': {
          'from': { transform: 'translate(-10px, -10px) scale(0.95)', opacity: '0' },
          'to': { transform: 'translate(0, 0) scale(1)', opacity: '1' }
        },
        'dialog-leave': {
          'from': { transform: 'translate(0, 0) scale(1)', opacity: '1' },
          'to': { transform: 'translate(10px, 10px) scale(0.95)', opacity: '0' }
        },
        'backdrop-fade': {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        'status-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 0 0 rgba(90, 154, 107, 0.4)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 0 4px rgba(90, 154, 107, 0)' }
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        'slide-up': {
          'from': { transform: 'translateY(10px)', opacity: '0' },
          'to': { transform: 'translateY(0)', opacity: '1' }
        },
        'slide-in-left': {
          'from': { transform: 'translateX(-20px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' }
        },
        'bar-extend': {
          'from': { height: '0' },
          'to': { height: '100%' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      borderWidth: {
        '3': '3px'
      }
    }
  },
  plugins: []
}
