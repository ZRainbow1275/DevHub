import { describe, expect, it } from 'vitest'
import {
  createWindowBatchRequest,
  normalizeBatchHwnds,
  requiresWindowBatchConfirmation,
  runSequentialWindowBatch,
  summarizeWindowBatchProgress
} from './windowBatchModel'

describe('R8.B window batch model', () => {
  it('normalizes positive HWNDs while preserving first-seen order', () => {
    expect(normalizeBatchHwnds([8, 0, 8, 4, -1, 7])).toEqual([8, 4, 7])
  })

  it('creates Zod-validated batch requests and confirmation boundaries', () => {
    const closeRequest = createWindowBatchRequest('close', [1, 2, 3, 4, 5, 6])
    const injectRequest = createWindowBatchRequest('inject-text', [7], { args: { text: 'hello' } })
    const confirmedInject = createWindowBatchRequest('inject-text', [7], { confirmed: true })

    expect(requiresWindowBatchConfirmation(closeRequest)).toBe(true)
    expect(requiresWindowBatchConfirmation(injectRequest)).toBe(true)
    expect(requiresWindowBatchConfirmation(confirmedInject)).toBe(false)
  })

  it('runs selected HWND operations sequentially and records partial failure', async () => {
    const request = createWindowBatchRequest('minimize', [11, 12, 13])
    const progress = await runSequentialWindowBatch(
      request,
      async (hwnd) => hwnd !== 12,
      { jobId: '11111111-1111-4111-8111-111111111111' }
    )

    expect(progress).toMatchObject({
      total: 3,
      completed: 3,
      failed: 1,
      state: 'completed'
    })
    expect(progress.results.map(result => result.status)).toEqual(['ok', 'failed', 'ok'])
    expect(summarizeWindowBatchProgress(progress, '批量最小化')).toBe('批量最小化部分失败：成功 2/3，失败 1')
  })

  it('supports dry-run requests without calling native handlers', async () => {
    const request = createWindowBatchRequest('screenshot', [21, 22], { dryRun: true })
    let calls = 0
    const progress = await runSequentialWindowBatch(
      request,
      () => {
        calls += 1
        return true
      },
      { jobId: '22222222-2222-4222-8222-222222222222' }
    )

    expect(calls).toBe(0)
    expect(progress.results.map(result => result.status)).toEqual(['skipped', 'skipped'])
  })

  it('publishes progress and skips remaining HWNDs after cancellation', async () => {
    const request = createWindowBatchRequest('focus', [31, 32, 33])
    const progressEvents: number[] = []
    let calls = 0
    let cancelled = false
    const progress = await runSequentialWindowBatch(
      request,
      () => {
        calls += 1
        cancelled = true
        return true
      },
      {
        jobId: '33333333-3333-4333-8333-333333333333',
        isCancelled: () => cancelled,
        onProgress: event => progressEvents.push(event.completed)
      }
    )

    expect(calls).toBe(1)
    expect(progress.state).toBe('cancelled')
    expect(progress.results.map(result => result.status)).toEqual(['ok', 'skipped', 'skipped'])
    expect(progress.results[1].output).toEqual({ reason: 'cancelled-before-start' })
    expect(progressEvents).toEqual([0, 1, 3])
  })
})
