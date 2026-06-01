import { z } from 'zod'
import {
  type AppearanceSettings,
  type AppSettings,
  type InformationDensity,
  type MotionLevel,
  type RadiusFamily,
  type ThemeDecorationConfig,
  type ThemeOption
} from '@shared/types'
import {
  themeDecorationConfigSchema,
  themeDecorationKindSchema,
  themeDecorationPositionSchema
} from '@shared/schemas/r8-runtime'

export const paletteNameSchema = z.enum([
  'constructivism',
  'modern-light',
  'warm-light',
  'cyberpunk',
  'swiss',
  'dark',
  'light'
])

// Localized palette display names live in `@shared/theme-display-names` so the
// main process (statusAggregate) and the renderer share one source. Re-exported
// here to keep existing renderer call sites importing from theme-language.
export { PALETTE_DISPLAY_NAMES, getPaletteDisplayName } from '@shared/theme-display-names'

export const densityLevelSchema = z.enum(['compact', 'standard', 'comfortable'])
export const radiusFamilySchema = z.enum(['sharp', 'soft', 'round'])
export const motionLevelSchema = z.enum(['reduced', 'balanced', 'expressive'])
export {
  themeDecorationConfigSchema,
  themeDecorationKindSchema,
  themeDecorationPositionSchema
}

export const themeStateSchema = z.object({
  palette: paletteNameSchema,
  density: densityLevelSchema,
  radiusFamily: radiusFamilySchema,
  motionLevel: motionLevelSchema
})

export type PaletteName = z.infer<typeof paletteNameSchema>
export type ThemeState = z.infer<typeof themeStateSchema>
export type ResolvedThemeDecorationConfig = z.infer<typeof themeDecorationConfigSchema>
export type SystemThemePreference = 'light' | 'dark' | 'no-preference'
export type SystemMotionPreference = 'reduce' | 'no-preference'

export const THEME_DECORATION_CHANGE_EVENT = 'devhub:theme-decoration-change'
export const THEME_DECORATION_BUILTIN_COUNT = 8

export interface ThemePreset {
  id: string
  name: string
  description: string
  state: ThemeState
}

export const DEFAULT_THEME_STATE: ThemeState = {
  palette: 'constructivism',
  density: 'standard',
  radiusFamily: 'sharp',
  motionLevel: 'balanced'
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'constructivism-command',
    name: 'Constructivism Command',
    description: '暗色红金、硬边几何、工业装饰与均衡动效',
    state: { palette: 'constructivism', density: 'compact', radiusFamily: 'sharp', motionLevel: 'balanced' }
  },
  {
    id: 'modern-light-balanced',
    name: 'Modern Light Balanced',
    description: '明亮蓝白、柔和圆角、轻阴影与标准密度',
    state: { palette: 'modern-light', density: 'standard', radiusFamily: 'soft', motionLevel: 'balanced' }
  },
  {
    id: 'paper-zen',
    name: 'Paper Zen',
    description: '暖色纸面、宽松密度、圆润卡片与低动效',
    state: { palette: 'warm-light', density: 'comfortable', radiusFamily: 'round', motionLevel: 'reduced' }
  },
  {
    id: 'terminal-focus',
    name: 'Terminal Focus',
    description: '高对比暗色、紧凑信息、硬边界与最小动效',
    state: { palette: 'cyberpunk', density: 'compact', radiusFamily: 'sharp', motionLevel: 'reduced' }
  },
  {
    id: 'swiss-grid',
    name: 'Swiss Grid',
    description: 'High-contrast white space, grid rhythm, sharp geometry, and low-motion focus.',
    state: { palette: 'swiss', density: 'standard', radiusFamily: 'sharp', motionLevel: 'reduced' }
  },
  {
    id: 'dark-ops',
    name: 'Dark Ops',
    description: 'Dark neutral surfaces, soft cards, standard density, and balanced transitions.',
    state: { palette: 'dark', density: 'standard', radiusFamily: 'soft', motionLevel: 'balanced' }
  },
  {
    id: 'light-console',
    name: 'Light Console',
    description: 'Light neutral surfaces, soft cards, comfortable density, and balanced transitions.',
    state: { palette: 'light', density: 'comfortable', radiusFamily: 'soft', motionLevel: 'balanced' }
  }
]

export type HolidayThemeId = 'spring-festival' | 'christmas' | 'halloween'

interface MonthDay {
  month: number
  day: number
}

export interface HolidayThemeDefinition {
  id: HolidayThemeId
  name: string
  observance: MonthDay
  datesByYear?: Partial<Record<number, MonthDay>>
  leadDays: number
  durationDays: number
  decoration: ThemeDecorationConfig
  cssVars: Record<string, string>
}

export interface HolidayThemeResolution {
  activeTheme: HolidayThemeDefinition | null
  promptTheme: HolidayThemeDefinition | null
  candidateTheme: HolidayThemeDefinition | null
  year: number
  storageKey: string | null
  enabled: boolean
  promptEnabled: boolean
  suppressedByFocusMode: boolean
}

type HolidayStorage = Pick<Storage, 'getItem' | 'setItem'>

export const HOLIDAY_THEME_DEFINITIONS: HolidayThemeDefinition[] = [
  {
    id: 'spring-festival',
    name: 'Spring Festival',
    observance: { month: 2, day: 1 },
    datesByYear: {
      2026: { month: 2, day: 17 },
      2027: { month: 2, day: 6 },
      2028: { month: 1, day: 26 },
      2029: { month: 2, day: 13 },
      2030: { month: 2, day: 3 }
    },
    leadDays: 14,
    durationDays: 7,
    decoration: {
      kind: 'golden',
      opacity: 0.2,
      positions: ['global-background', 'header', 'card-background'],
      blendMode: 'overlay',
      scale: 1.15,
      motionRespect: true
    },
    cssVars: {
      '--holiday-accent': '#d64545',
      '--holiday-secondary': '#c9a227',
      '--holiday-surface': 'rgba(214, 69, 69, 0.12)'
    }
  },
  {
    id: 'christmas',
    name: 'Christmas',
    observance: { month: 12, day: 25 },
    leadDays: 21,
    durationDays: 7,
    decoration: {
      kind: 'grid',
      opacity: 0.12,
      positions: ['global-background', 'empty-state', 'statusbar-background'],
      blendMode: 'screen',
      scale: 1,
      motionRespect: true
    },
    cssVars: {
      '--holiday-accent': '#16a34a',
      '--holiday-secondary': '#ef4444',
      '--holiday-surface': 'rgba(22, 163, 74, 0.12)'
    }
  },
  {
    id: 'halloween',
    name: 'Halloween',
    observance: { month: 10, day: 31 },
    leadDays: 14,
    durationDays: 3,
    decoration: {
      kind: 'blocks',
      opacity: 0.14,
      positions: ['global-background', 'card-background'],
      blendMode: 'overlay',
      scale: 1,
      motionRespect: true
    },
    cssVars: {
      '--holiday-accent': '#f97316',
      '--holiday-secondary': '#7c3aed',
      '--holiday-surface': 'rgba(249, 115, 22, 0.12)'
    }
  }
]

const LEGACY_THEME_MAP: Record<string, ThemeOption> = {
  dark: 'cyberpunk',
  light: 'swiss',
  constructivism: 'constructivism',
  'modern-light': 'modern-light',
  'warm-light': 'warm-light',
  cyberpunk: 'cyberpunk',
  swiss: 'swiss'
}

const PALETTE_DEFAULT_AXES: Record<ThemeOption, Pick<ThemeState, 'radiusFamily' | 'motionLevel'>> = {
  constructivism: { radiusFamily: 'sharp', motionLevel: 'balanced' },
  'modern-light': { radiusFamily: 'soft', motionLevel: 'balanced' },
  'warm-light': { radiusFamily: 'round', motionLevel: 'reduced' },
  cyberpunk: { radiusFamily: 'sharp', motionLevel: 'expressive' },
  swiss: { radiusFamily: 'sharp', motionLevel: 'reduced' },
  dark: { radiusFamily: 'soft', motionLevel: 'balanced' },
  light: { radiusFamily: 'soft', motionLevel: 'balanced' }
}

const PALETTE_DEFAULT_DECORATIONS: Record<ThemeOption, ThemeDecorationConfig> = {
  constructivism: {
    kind: 'soviet-geo',
    opacity: 0.25,
    positions: ['card-background', 'header'],
    blendMode: 'normal',
    scale: 1,
    motionRespect: true
  },
  'modern-light': {
    kind: 'diagonals',
    opacity: 0.08,
    positions: ['global-background'],
    blendMode: 'normal',
    scale: 1,
    motionRespect: true
  },
  'warm-light': {
    kind: 'paper',
    opacity: 0.12,
    positions: ['global-background', 'card-background'],
    blendMode: 'multiply',
    scale: 1,
    motionRespect: true
  },
  cyberpunk: {
    kind: 'scanline',
    opacity: 0.16,
    positions: ['global-background', 'header'],
    blendMode: 'screen',
    scale: 1,
    motionRespect: true
  },
  swiss: {
    kind: 'grid',
    opacity: 0.06,
    positions: ['global-background'],
    blendMode: 'normal',
    scale: 1,
    motionRespect: true
  },
  dark: {
    kind: 'noise',
    opacity: 0.08,
    positions: ['global-background'],
    blendMode: 'overlay',
    scale: 1,
    motionRespect: true
  },
  light: {
    kind: 'golden',
    opacity: 0.07,
    positions: ['global-background'],
    blendMode: 'normal',
    scale: 1,
    motionRespect: true
  }
}

export function normalizePalette(value: unknown): ThemeOption {
  if (typeof value !== 'string') return DEFAULT_THEME_STATE.palette
  return LEGACY_THEME_MAP[value] ?? DEFAULT_THEME_STATE.palette
}

export function resolveSystemPalette(preference: SystemThemePreference | null | undefined): ThemeOption {
  return preference === 'light' ? 'light' : 'dark'
}

export function resolveSystemMotionLevel(
  preference: SystemMotionPreference | null | undefined,
  value: unknown,
  palette: ThemeOption = DEFAULT_THEME_STATE.palette
): MotionLevel {
  if (preference === 'reduce') return 'reduced'
  return normalizeMotionLevel(value, palette)
}

export function normalizeDensity(value: unknown): InformationDensity {
  if (value === 'compact' || value === 'standard' || value === 'comfortable') return value
  if (value === 'normal') return 'standard'
  return DEFAULT_THEME_STATE.density
}

export function normalizeRadiusFamily(value: unknown, palette: ThemeOption = DEFAULT_THEME_STATE.palette): RadiusFamily {
  if (value === 'sharp' || value === 'soft' || value === 'round') return value
  return PALETTE_DEFAULT_AXES[palette]?.radiusFamily ?? DEFAULT_THEME_STATE.radiusFamily
}

export function normalizeMotionLevel(value: unknown, palette: ThemeOption = DEFAULT_THEME_STATE.palette): MotionLevel {
  if (value === 'reduced' || value === 'balanced' || value === 'expressive') return value
  return PALETTE_DEFAULT_AXES[palette]?.motionLevel ?? DEFAULT_THEME_STATE.motionLevel
}

export function resolveThemeState(
  settings: Pick<AppSettings, 'appearance'> | null | undefined,
  systemThemePreference?: SystemThemePreference,
  systemMotionPreference?: SystemMotionPreference
): ThemeState {
  const appearance = settings?.appearance
  const palette = appearance?.followSystemTheme
    ? resolveSystemPalette(systemThemePreference)
    : normalizePalette(appearance?.theme)
  const state = {
    palette,
    density: normalizeDensity(appearance?.informationDensity),
    radiusFamily: normalizeRadiusFamily(appearance?.radiusFamily, palette),
    motionLevel: resolveSystemMotionLevel(systemMotionPreference, appearance?.motionLevel, palette)
  }
  return themeStateSchema.parse(state)
}

export function getPaletteDecorationConfig(palette: ThemeOption): ThemeDecorationConfig {
  const fallback = PALETTE_DEFAULT_DECORATIONS[palette] ?? PALETTE_DEFAULT_DECORATIONS[DEFAULT_THEME_STATE.palette]
  return {
    ...fallback,
    positions: [...fallback.positions]
  }
}

export function normalizeThemeDecorationConfig(value: unknown, palette: ThemeOption = DEFAULT_THEME_STATE.palette): ThemeDecorationConfig {
  const fallback = getPaletteDecorationConfig(palette)
  const candidate = typeof value === 'object' && value !== null
    ? { ...fallback, ...value }
    : fallback
  const parsed = themeDecorationConfigSchema.parse(candidate)
  return {
    ...parsed,
    positions: [...new Set(parsed.positions)]
  }
}

export function resolveThemeDecoration(settings: Pick<AppSettings, 'appearance'> | null | undefined): ThemeDecorationConfig {
  const palette = normalizePalette(settings?.appearance?.theme)
  return normalizeThemeDecorationConfig(settings?.appearance?.decoration, palette)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return startOfLocalDay(next)
}

function holidayDateForYear(definition: HolidayThemeDefinition, year: number): Date {
  const date = definition.datesByYear?.[year] ?? definition.observance
  return new Date(year, date.month - 1, date.day)
}

function holidayPromptStorageKey(id: HolidayThemeId, year: number): string {
  return `devhub:holiday-theme:${id}:${year}`
}

function readHolidayPromptStatus(storage: Pick<Storage, 'getItem'> | undefined, key: string): 'accepted' | 'dismissed' | null {
  const value = storage?.getItem(key)
  return value === 'accepted' || value === 'dismissed' ? value : null
}

function getBrowserHolidayStorage(): HolidayStorage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function resolveHolidayTheme(
  appearance: Partial<AppearanceSettings> | null | undefined,
  now: Date = new Date(),
  storage: Pick<Storage, 'getItem'> | undefined = getBrowserHolidayStorage()
): HolidayThemeResolution {
  const today = startOfLocalDay(now)
  const enabled = appearance?.holidayDecorationsEnabled ?? true
  const promptEnabled = appearance?.holidayAutoPromptEnabled ?? true
  const suppressedByFocusMode = appearance?.holidayFocusMode ?? false

  for (const definition of HOLIDAY_THEME_DEFINITIONS) {
    const observanceDate = holidayDateForYear(definition, today.getFullYear())
    const promptStart = addDays(observanceDate, -definition.leadDays)
    const activeEnd = addDays(observanceDate, definition.durationDays)
    if (today < promptStart || today > activeEnd) continue

    const storageKey = holidayPromptStorageKey(definition.id, observanceDate.getFullYear())
    const status = readHolidayPromptStatus(storage, storageKey)
    const accepted = status === 'accepted'
    const dismissed = status === 'dismissed'
    const shouldPrompt = enabled && promptEnabled && !suppressedByFocusMode && !accepted && !dismissed && today < observanceDate
    const shouldActivate = enabled && !suppressedByFocusMode && !dismissed && (accepted || today >= observanceDate)

    return {
      activeTheme: shouldActivate ? definition : null,
      promptTheme: shouldPrompt ? definition : null,
      candidateTheme: definition,
      year: observanceDate.getFullYear(),
      storageKey,
      enabled,
      promptEnabled,
      suppressedByFocusMode
    }
  }

  return {
    activeTheme: null,
    promptTheme: null,
    candidateTheme: null,
    year: today.getFullYear(),
    storageKey: null,
    enabled,
    promptEnabled,
    suppressedByFocusMode
  }
}

export function resolveEffectiveThemeDecoration(
  settings: Pick<AppSettings, 'appearance'> | null | undefined,
  now: Date = new Date(),
  storage: Pick<Storage, 'getItem'> | undefined = getBrowserHolidayStorage()
): ThemeDecorationConfig {
  const holiday = resolveHolidayTheme(settings?.appearance, now, storage)
  if (holiday.activeTheme) return normalizeThemeDecorationConfig(holiday.activeTheme.decoration, normalizePalette(settings?.appearance?.theme))
  return resolveThemeDecoration(settings)
}

export function applyHolidayThemeToDocument(resolution: HolidayThemeResolution, doc: Document = document): void {
  const root = doc.documentElement
  root.dataset.holidayThemesEnabled = String(resolution.enabled)
  root.dataset.holidayFocusMode = String(resolution.suppressedByFocusMode)

  if (resolution.promptTheme) {
    root.dataset.holidayPrompt = resolution.promptTheme.id
  } else {
    delete root.dataset.holidayPrompt
  }

  if (!resolution.activeTheme) {
    delete root.dataset.holidayTheme
    root.style.removeProperty('--holiday-accent')
    root.style.removeProperty('--holiday-secondary')
    root.style.removeProperty('--holiday-surface')
    return
  }

  root.dataset.holidayTheme = resolution.activeTheme.id
  for (const [property, value] of Object.entries(resolution.activeTheme.cssVars)) {
    root.style.setProperty(property, value)
  }
}

export function promptHolidayThemeIfNeeded(
  appearance: Partial<AppearanceSettings> | null | undefined,
  now: Date = new Date(),
  storage: HolidayStorage | undefined = getBrowserHolidayStorage(),
  confirmHoliday: (message: string, theme: HolidayThemeDefinition) => boolean = message => window.confirm(message)
): HolidayThemeResolution {
  const resolution = resolveHolidayTheme(appearance, now, storage)
  if (!resolution.promptTheme || !resolution.storageKey || !storage) return resolution

  const accepted = confirmHoliday(
    `DevHub seasonal theme "${resolution.promptTheme.name}" is available. Enable it for this season?`,
    resolution.promptTheme
  )
  storage.setItem(resolution.storageKey, accepted ? 'accepted' : 'dismissed')
  return resolveHolidayTheme(appearance, now, storage)
}

export function applyThemeDecorationToDocument(config: ThemeDecorationConfig, doc: Document = document): void {
  const root = doc.documentElement
  root.dataset.decorationKind = config.kind
  root.dataset.decorationPositions = config.positions.join(' ')
  root.style.setProperty('--theme-decoration-opacity', String(config.opacity))
  root.style.setProperty('--theme-decoration-blend-mode', config.blendMode)
  root.style.setProperty('--theme-decoration-scale', String(config.scale))
}

export function getPresetState(id: string): ThemeState | null {
  return THEME_PRESETS.find(preset => preset.id === id)?.state ?? null
}

export function getPaletteDesignState(palette: ThemeOption, density: InformationDensity = DEFAULT_THEME_STATE.density): ThemeState {
  const axes = PALETTE_DEFAULT_AXES[palette] ?? PALETTE_DEFAULT_AXES[DEFAULT_THEME_STATE.palette]
  return themeStateSchema.parse({
    palette,
    density,
    radiusFamily: axes.radiusFamily,
    motionLevel: axes.motionLevel
  })
}

export function applyThemeStateToDocument(state: ThemeState, doc: Document = document): void {
  const root = doc.documentElement
  root.dataset.theme = state.palette
  root.dataset.palette = state.palette
  root.dataset.density = state.density
  root.dataset.radiusFamily = state.radiusFamily
  root.dataset.motionLevel = state.motionLevel
  applyThemeDecorationToDocument(getPaletteDecorationConfig(state.palette), doc)
}
