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
    {/* Diagonal stripe texture */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.03,
        backgroundImage:
          'repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 11px)',
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

/** Cyberpunk Neon: grid background + scanline sweep */
const CyberpunkDecoration: React.FC = () => (
  <>
    {/* Grid-line background */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        opacity: 0.04,
        backgroundImage: [
          'linear-gradient(rgba(0, 255, 255, 0.15) 1px, transparent 1px)',
          'linear-gradient(90deg, rgba(0, 255, 255, 0.15) 1px, transparent 1px)',
        ].join(', '),
        backgroundSize: '40px 40px',
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
          background:
            'linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.25), transparent)',
          animation: 'scanline 6s linear infinite',
        }}
      />
    </div>
  </>
)

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

/**
 * Map of theme name to its decoration component.
 * Themes without decorations are simply omitted (render null).
 */
const DECORATION_MAP: Partial<Record<ThemeName, React.FC>> = {
  constructivism: SovietDecoration,
  cyberpunk: CyberpunkDecoration,
  // swiss, 'modern-light', 'warm-light' intentionally omitted — no decoration
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
