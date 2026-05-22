import { fusedSignalSchema, type ProgressDataPoint } from '@shared/schemas/r8-runtime'
import {
  SIGNAL_SOURCES,
  fusionConfigSchema,
  signalContributionSnapshotSchema,
  signalSampleSchema,
  type FusionConfig,
  type SignalContribution,
  type SignalContributionSnapshot,
  type SignalContributionValue,
  type SignalSample,
  type SignalSource,
  type WeightProfile
} from '@shared/schemas/signal-fusion'
import { createWeightProfile } from './WeightProfile'

export type FusedSignal = ReturnType<typeof fusedSignalSchema.parse>

export interface SignalFusionInput {
  instanceId: string
  samples: unknown[]
  profile?: WeightProfile
  config?: Partial<FusionConfig>
  now?: number
}

export interface SignalFusionOutput {
  fused: FusedSignal
  contributionSnapshot: SignalContributionSnapshot
}

const EMPTY_CONTRIBUTION: SignalContributionValue = {
  weight: 0,
  rawValue: 0,
  confidence: 0,
  contributionPct: 0,
  weightedValue: 0,
  effectiveWeight: 0,
  decayedConfidence: 0,
  ageMs: 0,
  stale: false
}

interface FusionValueResult {
  percent: number
  warnings: string[]
}

interface DempsterShaferMass {
  noProgress: number
  progress: number
  uncertainty: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function stateForProgress(percent: number): FusedSignal['state'] {
  if (percent >= 0.95) return 'completed'
  if (percent >= 0.65) return 'working'
  if (percent > 0) return 'thinking'
  return 'idle'
}

export class SignalFusion {
  fuse(input: SignalFusionInput): SignalFusionOutput {
    const instanceId = input.instanceId.trim()
    if (!instanceId) throw new Error('E_VALIDATION:instanceId required')

    const now = input.now ?? Date.now()
    const profile = input.profile ?? createWeightProfile('default', undefined, now)
    const config = fusionConfigSchema.parse({ ...input.config, updatedAt: input.config?.updatedAt ?? now })
    const samples = this.normalizeSamples(input.samples, instanceId, profile)
    const contributionInputs = samples.map(sample => this.toContributionInput(sample, profile, config, now))
    const effectiveWeightTotal = contributionInputs.reduce((total, item) => total + item.effectiveWeight, 0)
    const weightedValueTotal = contributionInputs.reduce((total, item) => total + item.weightedValue, 0)
    const fusionValue = this.fusePercent(contributionInputs, effectiveWeightTotal, weightedValueTotal, config)
    const fusedPercent = clamp01(fusionValue.percent)
    const contributionBySource = this.toContributionMap(contributionInputs, effectiveWeightTotal)
    const latestObservedAt = samples.reduce((latest, sample) => Math.max(latest, sample.ts), now)
    const confidence = this.fusedConfidence(contributionInputs, contributionBySource, config, samples.length)
    const state = stateForProgress(fusedPercent)
    const warnings = this.warnings(samples, config, now, fusionValue.warnings)
    const fusedProgress: ProgressDataPoint = {
      instanceId,
      percent: fusedPercent,
      source: 'fusion',
      confidence,
      observedAt: latestObservedAt,
      message: `signals:${samples.length};profile:${profile.profileId}`
    }
    const contributions = SIGNAL_SOURCES.map(source => ({
      source,
      ...contributionBySource[source]
    })) satisfies SignalContribution[]
    const fused = fusedSignalSchema.parse({
      instanceId,
      fusedProgress,
      contributions,
      state
    })
    const contributionSnapshot = signalContributionSnapshotSchema.parse({
      instanceId,
      contributions: contributionBySource,
      fusedProgress,
      fusedAt: now,
      state,
      profileId: profile.profileId,
      sampleCount: samples.length,
      warnings
    })
    return { fused, contributionSnapshot }
  }

  private normalizeSamples(samples: unknown[], instanceId: string, profile: WeightProfile): SignalSample[] {
    return samples.map(sample => {
      const record = typeof sample === 'object' && sample !== null ? sample as Record<string, unknown> : {}
      const source = record.source as SignalSource | undefined
      const weight = source ? profile.weights[source] : undefined
      return signalSampleSchema.parse({
        ...record,
        instanceId: typeof record.instanceId === 'string' ? record.instanceId : instanceId,
        weight: typeof record.weight === 'number' ? record.weight : weight
      })
    })
  }

  private toContributionInput(sample: SignalSample, profile: WeightProfile, config: FusionConfig, now: number): SignalContribution {
    const weight = sample.weight || profile.weights[sample.source]
    const ageMs = Math.max(0, now - sample.ts)
    const halfLifeMs = sample.decayHalfLifeMs || config.decayHalfLifeMs
    const decay = config.decayEnabled ? Math.pow(0.5, ageMs / halfLifeMs) : 1
    const stale = config.decayEnabled && ageMs >= config.staleAfterMs
    const staleMultiplier = stale ? 0.5 : 1
    const decayedConfidence = clamp01(sample.confidence * decay * staleMultiplier)
    const effectiveWeight = weight * decayedConfidence
    return {
      source: sample.source,
      weight,
      rawValue: sample.rawValue,
      confidence: sample.confidence,
      contributionPct: 0,
      weightedValue: clamp01(sample.rawValue * effectiveWeight),
      effectiveWeight,
      decayedConfidence,
      ageMs: Math.trunc(ageMs),
      stale
    }
  }

  private toContributionMap(contributions: SignalContribution[], effectiveWeightTotal: number): Record<SignalSource, SignalContributionValue> {
    const bySource = SIGNAL_SOURCES.reduce<Record<SignalSource, SignalContributionValue>>((record, source) => {
      record[source] = { ...EMPTY_CONTRIBUTION }
      return record
    }, {} as Record<SignalSource, SignalContributionValue>)

    for (const contribution of contributions) {
      bySource[contribution.source] = {
        weight: contribution.weight,
        rawValue: contribution.rawValue,
        confidence: contribution.confidence,
        contributionPct: effectiveWeightTotal > 0 ? contribution.effectiveWeight / effectiveWeightTotal : 0,
        weightedValue: contribution.weightedValue,
        effectiveWeight: contribution.effectiveWeight,
        decayedConfidence: contribution.decayedConfidence,
        ageMs: contribution.ageMs,
        stale: contribution.stale
      }
    }

    return bySource
  }

  private fusedConfidence(
    contributions: SignalContribution[],
    contributionBySource: Record<SignalSource, SignalContributionValue>,
    config: FusionConfig,
    sampleCount: number
  ): number {
    const dominantConfidence = contributions.reduce((maxConfidence, contribution) => {
      const pct = contributionBySource[contribution.source].contributionPct
      return pct > 0.3 ? Math.max(maxConfidence, contribution.decayedConfidence) : maxConfidence
    }, 0)
    const weightedConfidence = contributions.reduce((total, item) => {
      return total + item.decayedConfidence * contributionBySource[item.source].contributionPct
    }, 0)
    const rawConfidence = config.fallbackToHighestConfidence ? Math.max(dominantConfidence, weightedConfidence) : dominantConfidence
    const missingCliCap = contributionBySource.cli_parse.effectiveWeight <= 0 ? 0.6 : 1
    const sourceCountCap = sampleCount < config.minSourcesForFusion ? 0.3 : 1
    return clamp01(Math.min(rawConfidence, missingCliCap, sourceCountCap))
  }

  private fusePercent(
    contributions: SignalContribution[],
    effectiveWeightTotal: number,
    weightedValueTotal: number,
    config: FusionConfig
  ): FusionValueResult {
    if (effectiveWeightTotal <= 0) return { percent: 0, warnings: [] }
    if (config.algorithm === 'dempster-shafer') return this.dempsterShaferPercent(contributions)
    if (config.algorithm === 'bayesian-update') return this.bayesianPercent(contributions, effectiveWeightTotal)
    return { percent: weightedValueTotal / effectiveWeightTotal, warnings: [] }
  }

  private dempsterShaferPercent(contributions: SignalContribution[]): FusionValueResult {
    let mass: DempsterShaferMass = { progress: 0, noProgress: 0, uncertainty: 1 }
    const warnings: string[] = []

    for (const contribution of contributions.filter(item => item.effectiveWeight > 0)) {
      const reliability = clamp01(contribution.effectiveWeight)
      const evidence: DempsterShaferMass = {
        progress: clamp01(contribution.rawValue * reliability),
        noProgress: clamp01((1 - contribution.rawValue) * reliability),
        uncertainty: clamp01(1 - reliability)
      }
      const conflict = (mass.progress * evidence.noProgress) + (mass.noProgress * evidence.progress)
      if (conflict >= 0.999) {
        warnings.push('E_INTERNAL: dempster-shafer conflict saturated; retained previous mass')
        continue
      }
      const denominator = 1 - conflict
      mass = {
        progress: ((mass.progress * evidence.progress) + (mass.progress * evidence.uncertainty) + (mass.uncertainty * evidence.progress)) / denominator,
        noProgress: ((mass.noProgress * evidence.noProgress) + (mass.noProgress * evidence.uncertainty) + (mass.uncertainty * evidence.noProgress)) / denominator,
        uncertainty: (mass.uncertainty * evidence.uncertainty) / denominator
      }
    }

    return { percent: clamp01(mass.progress + (mass.uncertainty * 0.5)), warnings }
  }

  private bayesianPercent(contributions: SignalContribution[], effectiveWeightTotal: number): FusionValueResult {
    let logOdds = 0
    for (const contribution of contributions.filter(item => item.effectiveWeight > 0)) {
      const probability = Math.min(0.999, Math.max(0.001, contribution.rawValue))
      const strength = contribution.effectiveWeight / effectiveWeightTotal
      logOdds += strength * Math.log(probability / (1 - probability))
    }
    return { percent: clamp01(1 / (1 + Math.exp(-logOdds))), warnings: [] }
  }

  private warnings(samples: SignalSample[], config: FusionConfig, now: number, algorithmWarnings: string[]): string[] {
    const warnings: string[] = [...algorithmWarnings]
    if (samples.length < config.minSourcesForFusion) {
      warnings.push('E_VALIDATION: source count below minSourcesForFusion; fallback confidence capped')
    }
    if (samples.some(sample => sample.source === 'cli_parse' && now - sample.ts >= config.staleAfterMs)) {
      warnings.push('E_TIMEOUT: cli_parse signal is stale and decayed')
    }
    return warnings
  }
}
