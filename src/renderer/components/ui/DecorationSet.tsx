/**
 * DecorationSet - Theme-aware decoration components.
 *
 * All visual differences are driven by CSS custom properties (--deco-*),
 * so these components render identical markup regardless of the active theme.
 * The theme simply redefines the CSS variables, producing different visuals:
 *
 *   Constructivism : 3px tri-color diagonal divider, red accent bar, clipped corners
 *   Modern Light   : 1px subtle gray line, no accent bar, clean rounded corners
 *   Warm Light     : 2px dashed line, no accent bar, large rounded corners
 */

import React from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type DecorationType =
  | 'divider'
  | 'divider-vertical'
  | 'accent-bar'
  | 'corner'
  | 'badge-frame'
  | 'section-line'

export interface DecorationProps {
  /** Which decoration variant to render. */
  type: DecorationType
  /** Optional className for additional styling. */
  className?: string
  /** For accent-bar: which side the bar sits on. */
  position?: 'top' | 'bottom' | 'left' | 'right'
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export const Decoration: React.FC<DecorationProps> = ({
  type,
  className = '',
  position = 'left',
}) => {
  switch (type) {
    /* ---- Horizontal Divider ---- */
    case 'divider':
      return (
        <div
          className={`deco-divider ${className}`}
          style={{
            width: '100%',
            height: 'var(--deco-divider-height, 1px)',
            background: 'var(--deco-divider, var(--surface-700))',
            flexShrink: 0,
          }}
          role="separator"
          aria-orientation="horizontal"
        />
      )

    /* ---- Vertical Divider ---- */
    case 'divider-vertical':
      return (
        <div
          className={`deco-divider-vertical ${className}`}
          style={{
            height: '100%',
            width: 'var(--deco-divider-height, 1px)',
            background: 'var(--deco-divider, var(--surface-700))',
            flexShrink: 0,
          }}
          role="separator"
          aria-orientation="vertical"
        />
      )

    /* ---- Accent Bar ---- */
    case 'accent-bar': {
      const isVertical = position === 'left' || position === 'right'
      return (
        <div
          className={`deco-accent-bar ${className}`}
          style={{
            ...(isVertical
              ? {
                  width: 'var(--deco-accent-bar-width, 3px)',
                  height: '100%',
                }
              : {
                  height: 'var(--deco-accent-bar-width, 3px)',
                  width: '100%',
                }),
            background: 'var(--red-500)',
            flexShrink: 0,
          }}
        />
      )
    }

    /* ---- Corner Decoration ---- */
    case 'corner':
      return (
        <div
          className={`deco-corner-marker ${className}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '24px',
            height: '24px',
            borderLeft: 'var(--deco-accent-bar-width, 3px) solid var(--red-500)',
            borderTop: 'var(--deco-accent-bar-width, 3px) solid var(--red-500)',
            pointerEvents: 'none',
          }}
        />
      )

    /* ---- Badge Frame ---- */
    case 'badge-frame':
      return (
        <div
          className={`deco-badge-frame ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 'var(--radius-badge, 0px)',
            border: '1px solid var(--surface-600)',
            fontSize: 'var(--text-micro, 11px)',
            letterSpacing: 'var(--typo-heading-spacing, 0.1em)',
            textTransform: 'var(--typo-heading-transform, uppercase)' as React.CSSProperties['textTransform'],
          }}
        />
      )

    /* ---- Section Line (full-width themed separator) ---- */
    case 'section-line':
      return (
        <div
          className={`deco-section-line ${className}`}
          style={{
            width: '100%',
            height: 'var(--deco-divider-height, 1px)',
            background: 'var(--deco-divider, var(--surface-700))',
            margin: 'var(--space-section-gap, 8px) 0',
            flexShrink: 0,
          }}
          role="separator"
        />
      )

    default:
      return null
  }
}

export default Decoration
