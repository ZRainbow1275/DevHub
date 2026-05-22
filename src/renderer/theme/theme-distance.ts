import { z } from 'zod'
import { themeStateSchema, type ThemeState } from './theme-language'

const nonColorAxisSchema = z.enum(['density', 'radiusFamily', 'motionLevel'])

export const themeAxisDistanceSchema = z.object({
  from: themeStateSchema,
  to: themeStateSchema,
  paletteChanged: z.boolean(),
  densityDelta: z.number().int().min(0),
  radiusFamilyDelta: z.number().int().min(0),
  motionLevelDelta: z.number().int().min(0),
  changedNonColorAxes: z.array(nonColorAxisSchema),
  nonColorDeltaCount: z.number().int().min(0),
  weightedNonColorDistance: z.number().min(0),
  hasNonColorDelta: z.boolean()
})

export type NonColorThemeAxis = z.infer<typeof nonColorAxisSchema>
export type ThemeAxisDistance = z.infer<typeof themeAxisDistanceSchema>

const DENSITY_RANK: Record<ThemeState['density'], number> = {
  compact: 0,
  standard: 1,
  comfortable: 2
}

const RADIUS_RANK: Record<ThemeState['radiusFamily'], number> = {
  sharp: 0,
  soft: 1,
  round: 2
}

const MOTION_RANK: Record<ThemeState['motionLevel'], number> = {
  reduced: 0,
  balanced: 1,
  expressive: 2
}

function rankDelta<T extends string>(left: T, right: T, rank: Record<T, number>): number {
  return Math.abs(rank[left] - rank[right])
}

export function pairwiseThemeDistance(fromState: ThemeState, toState: ThemeState): ThemeAxisDistance {
  const from = themeStateSchema.parse(fromState)
  const to = themeStateSchema.parse(toState)
  const densityDelta = rankDelta(from.density, to.density, DENSITY_RANK)
  const radiusFamilyDelta = rankDelta(from.radiusFamily, to.radiusFamily, RADIUS_RANK)
  const motionLevelDelta = rankDelta(from.motionLevel, to.motionLevel, MOTION_RANK)
  const changedNonColorAxes: NonColorThemeAxis[] = []

  if (densityDelta > 0) changedNonColorAxes.push('density')
  if (radiusFamilyDelta > 0) changedNonColorAxes.push('radiusFamily')
  if (motionLevelDelta > 0) changedNonColorAxes.push('motionLevel')

  return themeAxisDistanceSchema.parse({
    from,
    to,
    paletteChanged: from.palette !== to.palette,
    densityDelta,
    radiusFamilyDelta,
    motionLevelDelta,
    changedNonColorAxes,
    nonColorDeltaCount: changedNonColorAxes.length,
    weightedNonColorDistance: densityDelta + radiusFamilyDelta + motionLevelDelta,
    hasNonColorDelta: changedNonColorAxes.length > 0
  })
}

export function hasThemeNonColorDelta(fromState: ThemeState, toState: ThemeState): boolean {
  return pairwiseThemeDistance(fromState, toState).hasNonColorDelta
}

export function assertThemeNonColorDelta(fromState: ThemeState, toState: ThemeState): ThemeAxisDistance {
  const distance = pairwiseThemeDistance(fromState, toState)
  if (!distance.hasNonColorDelta) {
    throw new Error(`Theme transition ${distance.from.palette} -> ${distance.to.palette} changes color only; at least one non-color axis must change.`)
  }
  return distance
}

export function ensureThemeNonColorDelta(fromState: ThemeState, toState: ThemeState): ThemeState {
  const initialDistance = pairwiseThemeDistance(fromState, toState)
  if (!initialDistance.paletteChanged || initialDistance.hasNonColorDelta) return initialDistance.to

  const adjusted = themeStateSchema.parse({
    ...initialDistance.to,
    radiusFamily: initialDistance.to.radiusFamily === 'soft' ? 'sharp' : 'soft'
  })
  assertThemeNonColorDelta(initialDistance.from, adjusted)
  return adjusted
}
