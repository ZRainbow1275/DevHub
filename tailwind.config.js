/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        // All colors reference CSS custom properties for multi-theme support
        'accent': {
          DEFAULT: 'var(--red-500)',
          50: 'var(--red-50, #fef2f2)',
          100: 'var(--red-100, #fee2e2)',
          200: 'var(--red-200, #fecaca)',
          300: 'var(--red-300)',
          400: 'var(--red-400)',
          500: 'var(--red-500)',
          600: 'var(--red-600)',
          700: 'var(--red-700)',
          800: 'var(--red-800, #7f2626)',
          900: 'var(--red-900, #691f1f)'
        },
        'gold': {
          DEFAULT: 'var(--gold-500)',
          300: 'var(--gold-300)',
          400: 'var(--gold-400)',
          500: 'var(--gold-500)',
          600: 'var(--gold-600)',
          700: 'var(--gold-700)'
        },
        'steel': {
          DEFAULT: 'var(--steel-500)',
          300: 'var(--steel-300)',
          400: 'var(--steel-400)',
          500: 'var(--steel-500)',
          600: 'var(--steel-600)',
          700: 'var(--steel-700)'
        },
        'surface': {
          DEFAULT: 'var(--surface-850)',
          50: 'var(--surface-50)',
          100: 'var(--surface-100)',
          200: 'var(--surface-200)',
          300: 'var(--surface-300)',
          400: 'var(--surface-400)',
          500: 'var(--surface-500)',
          600: 'var(--surface-600)',
          700: 'var(--surface-700)',
          750: 'var(--surface-750)',
          800: 'var(--surface-800)',
          850: 'var(--surface-850)',
          900: 'var(--surface-900)',
          950: 'var(--surface-950)'
        },
        'success': 'var(--success)',
        'warning': 'var(--warning)',
        'error': 'var(--error)',
        'info': 'var(--info)',
        'running': 'var(--success)',
        'text': {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
          muted: 'var(--text-muted)',
          accent: 'var(--text-accent)'
        }
      },
      fontFamily: {
        display: ['var(--typo-heading-family)', 'Bebas Neue', 'Oswald', 'Anton', 'sans-serif'],
        sans: ['Inter', 'Noto Sans SC', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        serif: ['Playfair Display', 'Noto Serif SC', 'Georgia', 'serif']
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
        '128': '32rem',
        'base': 'var(--spacing-base, 4px)',
        'container': 'var(--container-padding, 12px)',
        'card-gap': 'var(--card-gap, 8px)',
        'sidebar': 'var(--sidebar-width, 240px)'
      },
      borderRadius: {
        'sm': 'var(--radius-sm, 2px)',
        'DEFAULT': 'var(--radius-md, 4px)',
        'md': 'var(--radius-md, 4px)',
        'lg': 'var(--radius-lg, 4px)',
        'xl': 'var(--radius-xl, 4px)',
        '2xl': 'var(--radius-xl, 4px)',
        'full': 'var(--radius-full, 9999px)',
        'card': 'var(--radius-card, 2px)',
        'button': 'var(--radius-button, 2px)',
        'input': 'var(--radius-input, 2px)',
        'badge': 'var(--radius-badge, 0px)'
      },
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'glow-sm': '0 0 10px var(--red-overlay, rgba(214, 69, 69, 0.3))',
        'glow-gold': 'var(--shadow-glow-accent)',
        'glow-success': '0 0 15px var(--success-overlay, rgba(90, 154, 107, 0.3))',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        'elevated': 'var(--shadow-elevated)',
        'inner-glow': 'var(--shadow-inner)',
        'elevation-1': 'var(--elevation-1, none)',
        'elevation-2': 'var(--elevation-2, none)',
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
        '3': 'var(--border-width-thick, 3px)'
      },
      transitionDuration: {
        'theme-fast': 'var(--motion-duration-fast, 150ms)',
        'theme-normal': 'var(--motion-duration-normal, 250ms)',
        'theme-slow': 'var(--motion-duration-slow, 400ms)'
      },
      transitionTimingFunction: {
        'theme': 'var(--motion-easing, linear)'
      },
      gap: {
        'density': 'var(--density-grid-gap, 8px)',
        'section': 'var(--space-section-gap, 8px)',
        'content': 'var(--space-content-gap, 4px)'
      },
      minHeight: {
        'card': 'var(--density-card-min-height, 60px)'
      },
      height: {
        'list-row': 'var(--density-list-row-height, 36px)'
      }
    }
  },
  plugins: []
}
