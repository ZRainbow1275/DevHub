/**
 * ThemeDecoration - Theme-specific ambient decoration layers.
 *
 * Each theme gets a unique set of background decorations that are
 * rendered as fixed/absolute overlays with pointer-events: none.
 *
 * - Constructivism: 45-degree diagonal stripe texture + geometric corner triangle
 * - Cyberpunk: Grid-line background + animated scanline sweep
 * - Swiss / Modern / Warm: No decoration (return null)
 *
 * Usage: Place <ThemeDecoration /> inside any container with position: relative.
 * It renders behind content via low z-index and pointer-events: none.
 */

import React from 'react'
import { useTheme, type ThemeName } from '../../hooks/useTheme'

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Soviet Constructivism: diagonal stripes + geometric corner cut */
const SovietDecoration: React.FC = () => (
  <>
    {/* Diagonal stripe texture — driven by CSS vars */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 'var(--deco-pattern-opacity, 0.06)',
        backgroundImage: 'var(--deco-pattern-image)',
      }}
      aria-hidden="true"
    />
    {/* Geometric corner triangle — top-right */}
    <div
      className="absolute top-0 right-0 pointer-events-none"
      style={{
        width: '20px',
        height: '20px',
        background: 'var(--red-500)',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
        opacity: 0.6,
      }}
      aria-hidden="true"
    />
  </>
)

/** Cyberpunk Neon: CSS-var driven grid + scanline sweep */
const CyberpunkDecoration: React.FC = () => (
  <>
    {/* Grid pattern — driven by CSS vars */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 'var(--deco-pattern-opacity, 0.035)',
        backgroundImage: 'var(--deco-pattern-image)',
        backgroundSize: '20px 20px',
      }}
      aria-hidden="true"
    />
    {/* Scanline overlay */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 'var(--deco-scanline-opacity, 0.03)',
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0, 0, 0, 0.15) 2px, rgba(0, 0, 0, 0.15) 4px)',
      }}
      aria-hidden="true"
    />
    {/* Scanline sweep animation */}
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent, var(--deco-glow-color, rgba(0, 255, 255, 0.3)), transparent)',
          animation: 'scanline 6s linear infinite',
        }}
      />
    </div>
  </>
)

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

/** Warm Light: paper texture via CSS var */
const WarmLightDecoration: React.FC = () => (
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      opacity: 'var(--deco-pattern-opacity, 0.025)',
      backgroundImage: 'var(--deco-pattern-image)',
      backgroundSize: '40px 40px',
    }}
    aria-hidden="true"
  />
)

/**
 * Map of theme name to its decoration component.
 * Themes without decorations are simply omitted (render null).
 */
const DECORATION_MAP: Partial<Record<ThemeName, React.FC>> = {
  constructivism: SovietDecoration,
  cyberpunk: CyberpunkDecoration,
  'warm-light': WarmLightDecoration,
  // swiss, 'modern-light' intentionally omitted — no decoration
}

export interface ThemeDecorationProps {
  /** Optional additional className */
  className?: string
}

export const ThemeDecoration: React.FC<ThemeDecorationProps> = ({ className = '' }) => {
  const { theme } = useTheme()
  const DecoComponent = DECORATION_MAP[theme]

  if (!DecoComponent) return null

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <DecoComponent />
    </div>
  )
}

export default ThemeDecoration
