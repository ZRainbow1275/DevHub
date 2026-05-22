import {
  SIGNAL_SOURCES,
  signalWeightMapSchema,
  weightProfileIdSchema,
  weightProfileSchema,
  type SignalSource,
  type WeightProfile,
  type WeightProfileId
} from '@shared/schemas/signal-fusion'

export type SignalWeightMap = Record<SignalSource, number>

export const RAW_DEFAULT_SIGNAL_WEIGHTS: SignalWeightMap = {
  cli_parse: 0.8,
  window_title: 0.4,
  process_cpu_io: 0.2,
  task_queue: 0.18,
  watchdog: 0.12,
  user_feedback: 0.3
}

export const RAW_CLI_HEAVY_SIGNAL_WEIGHTS: SignalWeightMap = {
  cli_parse: 0.9,
  window_title: 0.35,
  process_cpu_io: 0.18,
  task_queue: 0.16,
  watchdog: 0.1,
  user_feedback: 0.24
}

export const RAW_WINDOW_HEAVY_SIGNAL_WEIGHTS: SignalWeightMap = {
  cli_parse: 0.5,
  window_title: 0.8,
  process_cpu_io: 0.25,
  task_queue: 0.14,
  watchdog: 0.1,
  user_feedback: 0.21
}

export interface NormalizedWeightResult {
  weights: SignalWeightMap
  warning?: string
}

function finiteWeight(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(1, value))
}

export function normalizeWeights(
  overrides: Partial<Record<SignalSource, number>> | undefined,
  fallback: SignalWeightMap = RAW_DEFAULT_SIGNAL_WEIGHTS
): NormalizedWeightResult {
  const raw = SIGNAL_SOURCES.reduce<SignalWeightMap>((weights, source) => {
    const override = finiteWeight(overrides?.[source])
    weights[source] = override ?? fallback[source]
    return weights
  }, {} as SignalWeightMap)
  const rawSum = Object.values(raw).reduce((total, value) => total + value, 0)
  if (rawSum <= 0) {
    return {
      weights: normalizeWeights(undefined, RAW_DEFAULT_SIGNAL_WEIGHTS).weights,
      warning: 'E_VALIDATION: all signal weights were zero; reset to default profile'
    }
  }
  const normalized = SIGNAL_SOURCES.reduce<SignalWeightMap>((weights, source) => {
    weights[source] = raw[source] / rawSum
    return weights
  }, {} as SignalWeightMap)
  const parsed = signalWeightMapSchema.safeParse(normalized)
  if (!parsed.success) {
    return {
      weights: normalizeWeights(undefined, RAW_DEFAULT_SIGNAL_WEIGHTS).weights,
      warning: 'E_VALIDATION: normalized signal weights failed schema validation; reset to default profile'
    }
  }
  const warning = Math.abs(rawSum - 1) > 0.01
    ? `E_VALIDATION: signal weights were normalized from sum ${rawSum.toFixed(4)}`
    : undefined
  return { weights: parsed.data, warning }
}

export function createWeightProfile(
  profileId: WeightProfileId,
  overrides?: Partial<Record<SignalSource, number>>,
  now = Date.now()
): WeightProfile {
  const fallback = profileId === 'cli-heavy'
    ? RAW_CLI_HEAVY_SIGNAL_WEIGHTS
    : profileId === 'window-heavy'
      ? RAW_WINDOW_HEAVY_SIGNAL_WEIGHTS
      : RAW_DEFAULT_SIGNAL_WEIGHTS
  const normalized = normalizeWeights(overrides, fallback)
  return weightProfileSchema.parse({
    profileId,
    weights: normalized.weights,
    updatedAt: now,
    validatedSum: true,
    warning: normalized.warning
  })
}

export const DEFAULT_WEIGHT_PROFILES: Record<WeightProfileId, WeightProfile> = {
  default: createWeightProfile('default', undefined, 0),
  'cli-heavy': createWeightProfile('cli-heavy', undefined, 0),
  'window-heavy': createWeightProfile('window-heavy', undefined, 0),
  'user-custom': createWeightProfile('user-custom', undefined, 0)
}

export function coerceWeightProfileId(value: unknown): WeightProfileId {
  const parsed = weightProfileIdSchema.safeParse(value)
  return parsed.success ? parsed.data : 'user-custom'
}
