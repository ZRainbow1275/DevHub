import { describe, expect, it } from 'vitest'

import {
  assertProgressInvariant,
  buildProgressConfidenceRange,
  deriveProgress,
  toDerivableProgressState,
} from './derive-progress'

describe('deriveProgress', () => {
  it('maps legacy task state into the monitor-derived progress state', () => {
    expect(toDerivableProgressState('idle')).toBe('idle')
    expect(toDerivableProgressState('waiting')).toBe('waiting-input')
    expect(toDerivableProgressState('running', 'thinking')).toBe('thinking')
    expect(toDerivableProgressState('running', 'validating')).toBe('validating')
    expect(toDerivableProgressState('running', 'completed')).toBe('completed')
    expect(toDerivableProgressState('running', 'error')).toBe('error')
    expect(toDerivableProgressState('running', undefined, 'compiling')).toBe('compiling')
    expect(toDerivableProgressState('running', undefined, 'awaiting-human')).toBe('awaiting-human')
    expect(toDerivableProgressState('running', undefined, 'stuck')).toBe('stuck')
    expect(toDerivableProgressState('running')).toBe('coding')
  })

  it('hides idle progress without exposing a percentage', () => {
    const progress = deriveProgress('idle')

    expect(progress).toMatchObject({
      mode: 'hidden',
      label: '空闲',
      phase: 'done',
      accentColor: 'neutral',
    })
    expect(progress.percentage).toBeUndefined()
    expect(() => assertProgressInvariant('idle', progress)).not.toThrow()
  })

  it('renders thinking as indeterminate without a percentage', () => {
    const progress = deriveProgress('thinking', { confidence: 0.7 })

    expect(progress).toMatchObject({
      mode: 'indeterminate',
      label: '思考中',
      phase: 'thinking',
      accentColor: 'active',
      confidence: 0.7,
    })
    expect(progress.percentage).toBeUndefined()
    expect(() => assertProgressInvariant('thinking', progress)).not.toThrow()
  })

  it('keeps coding fallback progress within 40..75 and advances with elapsed time', () => {
    const withoutEstimate = deriveProgress('coding')
    const atStart = deriveProgress('coding', { elapsedMs: 0, estimatedTotalMs: 10_000 })
    const pastUpperBound = deriveProgress('coding', { elapsedMs: 25_000, estimatedTotalMs: 10_000, confidence: 0.72 })

    expect(withoutEstimate.percentage).toBe(60)
    expect(atStart.percentage).toBe(40)
    expect(pastUpperBound.percentage).toBe(75)
    expect(pastUpperBound.confidenceRange).toEqual({ min: 70, max: 80, label: '约 70%-80%' })
    expect(() => assertProgressInvariant('coding', withoutEstimate)).not.toThrow()
    expect(() => assertProgressInvariant('coding', atStart)).not.toThrow()
    expect(() => assertProgressInvariant('coding', pastUpperBound)).not.toThrow()
  })

  it('uses explicit coding progress so task retries can return to zero', () => {
    const reset = deriveProgress('coding', { explicitPercentage: 0, confidence: 0.9 })
    const direct = deriveProgress('coding', { explicitPercentage: 37.6, confidence: 0.9 })
    const clamped = deriveProgress('coding', { explicitPercentage: 120, confidence: 0.9 })

    expect(reset).toMatchObject({
      mode: 'determinate',
      percentage: 0,
      label: '编码中',
      phase: 'coding',
      accentColor: 'active',
    })
    expect(reset.confidenceRange).toEqual({ min: 0, max: 3, label: '约 0%-3%' })
    expect(direct.percentage).toBe(38)
    expect(clamped.percentage).toBe(99)
    expect(() => assertProgressInvariant('coding', reset)).not.toThrow()
    expect(() => assertProgressInvariant('coding', direct)).not.toThrow()
    expect(() => assertProgressInvariant('coding', clamped)).not.toThrow()
  })

  it('keeps estimated long-running coding progress moving within 30 seconds', () => {
    const oneDayMs = 24 * 60 * 60 * 1000
    const atTenMinutes = deriveProgress('coding', {
      elapsedMs: 10 * 60 * 1000,
      estimatedTotalMs: oneDayMs,
      confidence: 0.6,
    })
    const thirtySecondsLater = deriveProgress('coding', {
      elapsedMs: 10 * 60 * 1000 + 30_000,
      estimatedTotalMs: oneDayMs,
      confidence: 0.6,
    })

    expect(thirtySecondsLater.percentage).toBeGreaterThan(atTenMinutes.percentage ?? 0)
    expect(() => assertProgressInvariant('coding', atTenMinutes)).not.toThrow()
    expect(() => assertProgressInvariant('coding', thirtySecondsLater)).not.toThrow()
  })

  it('builds bounded confidence ranges for determinate progress estimates', () => {
    expect(buildProgressConfidenceRange(45, 0.92)).toEqual({ min: 42, max: 48, label: '约 42%-48%' })
    expect(buildProgressConfidenceRange(45, 0.62)).toEqual({ min: 37, max: 53, label: '约 37%-53%' })
    expect(buildProgressConfidenceRange(4, 0.3)).toEqual({ min: 0, max: 16, label: '约 0%-16%' })
    expect(buildProgressConfidenceRange(100, 1)).toEqual({ min: 97, max: 100, label: '约 97%-100%' })
    expect(buildProgressConfidenceRange(45, undefined)).toBeUndefined()
  })

  it('pins validating to 92 with confirmation styling', () => {
    const progress = deriveProgress('validating', { confidence: 0.4 })

    expect(progress).toMatchObject({
      mode: 'determinate',
      percentage: 92,
      label: '确认中',
      phase: 'validating',
      accentColor: 'info',
      confidence: 0.4,
    })
    expect(() => assertProgressInvariant('validating', progress)).not.toThrow()
  })

  it('pins waiting-input to 98 with warning styling', () => {
    const progress = deriveProgress('waiting-input')

    expect(progress).toMatchObject({
      mode: 'determinate',
      percentage: 98,
      label: '等待输入',
      phase: 'validating',
      accentColor: 'warning',
    })
    expect(() => assertProgressInvariant('waiting-input', progress)).not.toThrow()
  })

  it('renders receiving-input, awaiting-human, and stuck as distinct non-idle states', () => {
    const receiving = deriveProgress('receiving-input', { confidence: 0.8 })
    const awaitingHuman = deriveProgress('awaiting-human', { confidence: 0.6 })
    const stuck = deriveProgress('stuck', { confidence: 0.4 })

    expect(receiving).toMatchObject({
      mode: 'indeterminate',
      label: '接收输入',
      phase: 'thinking',
      accentColor: 'info',
      confidence: 0.8,
    })
    expect(awaitingHuman).toMatchObject({
      mode: 'determinate',
      percentage: 98,
      label: '等待人工',
      phase: 'validating',
      accentColor: 'warning',
      confidence: 0.6,
    })
    expect(stuck).toMatchObject({
      mode: 'determinate',
      percentage: 99,
      label: '疑似卡死',
      phase: 'stuck',
      accentColor: 'warning',
      confidence: 0.4,
    })
    expect(() => assertProgressInvariant('receiving-input', receiving)).not.toThrow()
    expect(() => assertProgressInvariant('awaiting-human', awaitingHuman)).not.toThrow()
    expect(() => assertProgressInvariant('stuck', stuck)).not.toThrow()
  })

  it('forces completed and error to 100', () => {
    const completed = deriveProgress('completed')
    const errored = deriveProgress('error')

    expect(completed).toMatchObject({
      mode: 'determinate',
      percentage: 100,
      label: '已完成',
      phase: 'done',
      accentColor: 'success',
    })
    expect(errored).toMatchObject({
      mode: 'determinate',
      percentage: 100,
      label: '出错',
      phase: 'failed',
      accentColor: 'error',
    })
    expect(() => assertProgressInvariant('completed', completed)).not.toThrow()
    expect(() => assertProgressInvariant('error', errored)).not.toThrow()
  })
})

describe('assertProgressInvariant', () => {
  it('rejects impossible state/progress combinations', () => {
    expect(() =>
      assertProgressInvariant('idle', {
        mode: 'determinate',
        percentage: 20,
        label: '空闲',
        phase: 'done',
        accentColor: 'neutral',
      }),
    ).toThrow(/idle state must have hidden progress/)

    expect(() =>
      assertProgressInvariant('thinking', {
        mode: 'determinate',
        percentage: 56,
        label: '思考中',
        phase: 'thinking',
        accentColor: 'active',
      }),
    ).toThrow(/thinking must be indeterminate/)

    expect(() =>
      assertProgressInvariant('completed', {
        mode: 'determinate',
        percentage: 99,
        label: '已完成',
        phase: 'done',
        accentColor: 'success',
      }),
    ).toThrow(/completed must be determinate 100/)

    expect(() =>
      assertProgressInvariant('coding', {
        mode: 'determinate',
        percentage: 100,
        label: '编码中',
        phase: 'coding',
        accentColor: 'active',
      }),
    ).toThrow(/coding must be within 0..99/)
  })
})
