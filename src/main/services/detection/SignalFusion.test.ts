import { describe, expect, it } from 'vitest'
import { SignalFusion } from './SignalFusion'
import { createWeightProfile } from './WeightProfile'

function twoSourceProfile(now: number) {
  return createWeightProfile('user-custom', {
    cli_parse: 0.5,
    window_title: 0.5,
    process_cpu_io: 0,
    task_queue: 0,
    watchdog: 0,
    user_feedback: 0
  }, now)
}

function logit(probability: number): number {
  return Math.log(probability / (1 - probability))
}

describe('SignalFusion', () => {
  it('keeps all-zero raw values real while preserving contribution transparency', () => {
    const fusion = new SignalFusion()
    const now = 10_000
    const output = fusion.fuse({
      instanceId: 'zero-real',
      now,
      samples: [
        { source: 'cli_parse', rawValue: 0, confidence: 1, ts: now },
        { source: 'window_title', rawValue: 0, confidence: 1, ts: now }
      ]
    })

    expect(output.fused.fusedProgress.percent).toBe(0)
    expect(Object.values(output.contributionSnapshot.contributions).reduce((sum, item) => sum + item.contributionPct, 0)).toBeCloseTo(1, 5)
  })

  it('caps single-source bayesian fallback confidence without algorithm degradation', () => {
    const fusion = new SignalFusion()
    const now = 20_000
    const output = fusion.fuse({
      instanceId: 'single-source',
      now,
      profile: createWeightProfile('cli-heavy', undefined, now),
      config: { algorithm: 'bayesian-update' },
      samples: [
        { source: 'cli_parse', rawValue: 0.9, confidence: 0.95, ts: now }
      ]
    })

    expect(output.fused.fusedProgress.confidence).toBeLessThanOrEqual(0.3)
    expect(output.fused.fusedProgress.percent).toBeCloseTo(0.9, 5)
    expect(output.contributionSnapshot.warnings.some(item => item.includes('degraded to weighted-mean'))).toBe(false)
  })

  it('runs dempster-shafer fusion without degrading to weighted mean', () => {
    const fusion = new SignalFusion()
    const now = 30_000
    const output = fusion.fuse({
      instanceId: 'ds-fusion',
      now,
      profile: twoSourceProfile(now),
      config: { algorithm: 'dempster-shafer' },
      samples: [
        { source: 'cli_parse', rawValue: 0.8, confidence: 0.9, ts: now },
        { source: 'window_title', rawValue: 0.2, confidence: 0.5, ts: now }
      ]
    })
    const weightedMeanBaseline = ((0.8 * 0.45) + (0.2 * 0.25)) / (0.45 + 0.25)

    expect(output.fused.fusedProgress.source).toBe('fusion')
    expect(output.fused.fusedProgress.percent).toBeGreaterThanOrEqual(0)
    expect(output.fused.fusedProgress.percent).toBeLessThanOrEqual(1)
    expect(output.fused.fusedProgress.percent).toBeCloseTo(0.56497, 4)
    expect(output.fused.fusedProgress.percent).not.toBeCloseTo(weightedMeanBaseline, 4)
    expect(output.contributionSnapshot.warnings.some(item => item.includes('degraded to weighted-mean'))).toBe(false)
  })

  it('runs bayesian-update fusion through log-odds evidence', () => {
    const fusion = new SignalFusion()
    const now = 40_000
    const output = fusion.fuse({
      instanceId: 'bayesian-fusion',
      now,
      profile: twoSourceProfile(now),
      config: { algorithm: 'bayesian-update' },
      samples: [
        { source: 'cli_parse', rawValue: 0.8, confidence: 0.9, ts: now },
        { source: 'window_title', rawValue: 0.2, confidence: 0.5, ts: now }
      ]
    })
    const cliEffectiveWeight = 0.5 * 0.9
    const windowEffectiveWeight = 0.5 * 0.5
    const totalEffectiveWeight = cliEffectiveWeight + windowEffectiveWeight
    const expectedLogOdds = (cliEffectiveWeight / totalEffectiveWeight) * logit(0.8) +
      (windowEffectiveWeight / totalEffectiveWeight) * logit(0.2)
    const expectedPercent = 1 / (1 + Math.exp(-expectedLogOdds))

    expect(output.fused.fusedProgress.source).toBe('fusion')
    expect(output.fused.fusedProgress.percent).toBeCloseTo(expectedPercent, 5)
    expect(output.contributionSnapshot.warnings.some(item => item.includes('degraded to weighted-mean'))).toBe(false)
  })
})
