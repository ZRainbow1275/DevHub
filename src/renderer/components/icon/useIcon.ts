import { useEffect, useMemo, useState } from 'react'
import { ICON_LIMITS } from '@shared/icon-library'
import { DEFAULT_THEME_STATE, type ThemeState } from '../../theme/theme-language'
import { resolveRendererIcon, type RendererIconResolution } from './IconResolver'

type IconThemeAxes = Pick<ThemeState, 'density' | 'radiusFamily' | 'motionLevel'>

export interface IconDefaults {
  density: ThemeState['density']
  motionClassName: string
  motionLevel: ThemeState['motionLevel']
  radiusFamily: ThemeState['radiusFamily']
  size: number
  strokeWidth: number
}

const ICON_SIZE_BY_DENSITY: Record<ThemeState['density'], number> = {
  compact: ICON_LIMITS.STATUS_SIZE,
  standard: ICON_LIMITS.DEFAULT_SIZE,
  comfortable: ICON_LIMITS.TILE_SIZE,
}

const ICON_STROKE_BY_RADIUS: Record<ThemeState['radiusFamily'], number> = {
  sharp: ICON_LIMITS.STROKE_THICK,
  soft: ICON_LIMITS.STROKE_DEFAULT,
  round: 1.35,
}

const ICON_MOTION_CLASS_BY_LEVEL: Record<ThemeState['motionLevel'], string> = {
  reduced: 'transition-none',
  balanced: 'transition-colors',
  expressive: 'transition-all duration-200',
}

function readThemeAxesFromDocument(doc: Document): IconThemeAxes {
  const { dataset } = doc.documentElement
  return {
    density: dataset.density === 'compact' || dataset.density === 'comfortable'
      ? dataset.density
      : DEFAULT_THEME_STATE.density,
    radiusFamily: dataset.radiusFamily === 'soft' || dataset.radiusFamily === 'round'
      ? dataset.radiusFamily
      : DEFAULT_THEME_STATE.radiusFamily,
    motionLevel: dataset.motionLevel === 'reduced' || dataset.motionLevel === 'expressive'
      ? dataset.motionLevel
      : DEFAULT_THEME_STATE.motionLevel,
  }
}

function readCurrentThemeAxes(): IconThemeAxes {
  if (typeof document === 'undefined') return DEFAULT_THEME_STATE
  return readThemeAxesFromDocument(document)
}

export function resolveIconDefaultsForTheme(themeAxes: IconThemeAxes): IconDefaults {
  return {
    density: themeAxes.density,
    radiusFamily: themeAxes.radiusFamily,
    motionLevel: themeAxes.motionLevel,
    size: ICON_SIZE_BY_DENSITY[themeAxes.density],
    strokeWidth: ICON_STROKE_BY_RADIUS[themeAxes.radiusFamily],
    motionClassName: ICON_MOTION_CLASS_BY_LEVEL[themeAxes.motionLevel],
  }
}

export function useIcon(token: string): RendererIconResolution {
  return useMemo(() => resolveRendererIcon(token), [token])
}

export function useIconDefaults(): IconDefaults {
  const [themeAxes, setThemeAxes] = useState<IconThemeAxes>(() => readCurrentThemeAxes())

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setThemeAxes(readThemeAxesFromDocument(document)))
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-density', 'data-radius-family', 'data-motion-level'],
    })
    setThemeAxes(readThemeAxesFromDocument(document))
    return () => observer.disconnect()
  }, [])

  return useMemo(() => resolveIconDefaultsForTheme(themeAxes), [themeAxes])
}
