import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MisreportLogger, WeightAdjuster } from './index'
import { DEFAULT_WEIGHT_PROFILES } from '../detection/WeightProfile'
import type { MisreportRecord } from '@shared/schemas/misreport'
import type { SignalContributionSnapshot, SignalSource } from '@shared/schemas/signal-fusion'

function snapshot(instanceId: string): SignalContributionSnapshot {
  const source = (weight: number, contributionPct: number) => ({
    weight,
    rawValue: 0.4,
    confidence: 0.9,
    contributionPct,
    weightedValue: weight * 0.4,
    effectiveWeight: weight,
    decayedConfidence: 0.9,
    ageMs: 0,
    stale: false
  })
  return {
    instanceId,
    contributions: {
      cli_parse: source(0.4, 0.7),
      window_title: source(0.2, 0.1),
      process_cpu_io: source(0.1, 0.05),
      task_queue: source(0.1, 0.05),
      watchdog: source(0.05, 0.02),
      user_feedback: source(0.15, 0.08)
    },
    fusedProgress: { instanceId, percent: 0.2, source: 'fusion', confidence: 0.85, observedAt: 10 },
    fusedAt: 10,
    state: 'thinking',
    profileId: 'default',
    sampleCount: 6,
    warnings: []
  }
}

function record(id: string, instanceId: string): MisreportRecord {
  return {
    id,
    instanceId,
    kind: 'false-idle',
    reportedBy: 'vitest',
    reportedAt: 100,
    signalSnapshot: snapshot(instanceId),
    expectedTaskState: 'running',
    userNote: 'local note'
  }
}

describe('Misreport feedback persistence', () => {
  it('writes real SQLite misreports and bounded weight adjustments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-feedback-'))
    const logger = new MisreportLogger({ dbPath: join(root, 'feedback.sqlite') })
    const adjuster = new WeightAdjuster()
    const misreportId = '00000000-0000-4000-8000-000000000001'
    const result = adjuster.apply({
      misreportId,
      kind: 'false-idle',
      expectedTaskState: 'running',
      snapshot: snapshot('inst-1'),
      currentProfile: DEFAULT_WEIGHT_PROFILES.default,
      now: 200
    })

    try {
      logger.record(record(misreportId, 'inst-1'), result.adjustments)
      expect(logger.list().map(item => item.id)).toEqual([misreportId])
      expect(logger.latestForInstance('inst-1')?.kind).toBe('false-idle')
      expect(result.adjustments.every(item => Math.abs(item.delta) <= 0.05)).toBe(true)
      expect((logger.cumulativeDeltas().cli_parse ?? 0)).toBeGreaterThan(0)
    } finally {
      logger.close()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('caps cumulative source learning at twenty percent', () => {
    const adjuster = new WeightAdjuster()
    const totals: Partial<Record<SignalSource, number>> = { cli_parse: 0.19 }
    const result = adjuster.apply({
      misreportId: '00000000-0000-4000-8000-000000000002',
      kind: 'false-idle',
      expectedTaskState: 'running',
      snapshot: snapshot('inst-2'),
      currentProfile: DEFAULT_WEIGHT_PROFILES.default,
      cumulativeDeltas: totals,
      now: 300
    })
    expect(result.adjustments.find(item => item.source === 'cli_parse')?.delta).toBeCloseTo(0.01, 5)
  })

  it('stores correct-detection feedback as bounded positive local feedback', () => {
    const adjuster = new WeightAdjuster()
    const result = adjuster.apply({
      misreportId: '00000000-0000-4000-8000-000000000003',
      kind: 'correct-detection',
      expectedTaskState: 'thinking',
      snapshot: snapshot('inst-3'),
      currentProfile: DEFAULT_WEIGHT_PROFILES.default,
      now: 400
    })

    expect(result.adjustments[0]).toMatchObject({ source: 'user_feedback' })
    expect(result.adjustments[0]?.delta).toBeCloseTo(0.01, 5)
  })
})
