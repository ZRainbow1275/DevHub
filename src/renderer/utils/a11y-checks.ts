import {
  A11Y_LIMITS,
  a11yPrefsSchema,
  type A11yContrastFailure,
  type A11yOsPrefs,
  type A11yPrefs,
} from '@shared/schemas/r8-runtime'

export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface ContrastCheckInput {
  selector: string
  foreground: string
  background: string
  largeText?: boolean
}

export const DEFAULT_A11Y_OS_PREFS: A11yOsPrefs = {
  reducedMotion: false,
  highContrast: false,
  forcedColors: false,
}

export const DEFAULT_A11Y_PREFS: A11yPrefs = a11yPrefsSchema.parse({})

export function parseHexColor(value: string): RgbColor | null {
  const normalized = value.trim().replace(/^#/, '')
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  }
}

function channelToLinear(value: number): number {
  const normalized = value / 255
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color: RgbColor): number {
  return (0.2126 * channelToLinear(color.r))
    + (0.7152 * channelToLinear(color.g))
    + (0.0722 * channelToLinear(color.b))
}

export function contrastRatio(foreground: RgbColor, background: RgbColor): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2))
}

export function evaluateContrast(input: ContrastCheckInput): A11yContrastFailure | null {
  const foreground = parseHexColor(input.foreground)
  const background = parseHexColor(input.background)
  if (!foreground || !background) {
    return {
      selector: input.selector,
      ratio: 0,
      required: input.largeText ? A11Y_LIMITS.WCAG_AA_LARGE : A11Y_LIMITS.WCAG_AA_TEXT,
    }
  }

  const ratio = contrastRatio(foreground, background)
  const required = input.largeText ? A11Y_LIMITS.WCAG_AA_LARGE : A11Y_LIMITS.WCAG_AA_TEXT
  return ratio >= required ? null : { selector: input.selector, ratio, required }
}

export function buildEffectiveA11yPrefs(
  prefs: A11yPrefs = DEFAULT_A11Y_PREFS,
  osPrefs: A11yOsPrefs = DEFAULT_A11Y_OS_PREFS
): A11yPrefs {
  const parsed = a11yPrefsSchema.parse({ ...DEFAULT_A11Y_PREFS, ...prefs })
  if (!parsed.followOsSettings) {
    return parsed
  }

  return a11yPrefsSchema.parse({
    ...parsed,
    reducedMotion: parsed.reducedMotion || osPrefs.reducedMotion,
    highContrast: parsed.highContrast || osPrefs.highContrast,
    forcedColors: parsed.forcedColors || osPrefs.forcedColors,
  })
}

export function applyA11yDocumentState(
  root: HTMLElement,
  prefs: A11yPrefs = DEFAULT_A11Y_PREFS,
  osPrefs: A11yOsPrefs = DEFAULT_A11Y_OS_PREFS
): A11yPrefs {
  const effective = buildEffectiveA11yPrefs(prefs, osPrefs)
  root.dataset.a11yReducedMotion = String(effective.reducedMotion)
  root.dataset.a11yHighContrast = String(effective.highContrast)
  root.dataset.a11yForcedColors = String(effective.forcedColors)
  root.dataset.a11yLargeText = String(effective.largeText)
  root.dataset.a11yScreenReader = String(effective.screenReaderOptimized)
  root.dataset.a11yFocusRing = effective.focusRingThickness
  return effective
}
