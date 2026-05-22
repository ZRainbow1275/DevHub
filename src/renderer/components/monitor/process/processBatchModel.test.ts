import { describe, expect, it } from 'vitest'
import { processBatchTagArgsSchema } from '@shared/schemas/r8-runtime'
import {
  buildProcessBatchConfirmMessage,
  createProcessBatchRequest,
  getBlockedSystemKillPids,
  normalizeBatchPids,
  requiresProcessBatchConfirmation,
  runSequentialProcessBatch,
  summarizeProcessBatchProgress
} from './processBatchModel'

describe('R8.B process batch model', () => {
  it('normalizes positive PIDs while preserving first-seen order', () => {
    expect(normalizeBatchPids([9, 0, 9, 4, -1, 12])).toEqual([9, 4, 12])
  })

  it('creates Zod-validated requests and enforces dangerous confirmation boundaries', () => {
    const manyKill = createProcessBatchRequest('kill', [101, 102, 103, 104, 105, 106])
    const systemKill = createProcessBatchRequest('kill', [4, 120])
    const inject = createProcessBatchRequest('inject-text', [200], { args: { text: 'hello' } })
    const confirmedInject = createProcessBatchRequest('inject-text', [200], { confirmed: true })

    expect(requiresProcessBatchConfirmation(manyKill)).toBe(true)
    expect(requiresProcessBatchConfirmation(systemKill)).toBe(true)
    expect(getBlockedSystemKillPids(systemKill)).toEqual([4])
    expect(buildProcessBatchConfirmMessage(systemKill)).toContain('系统 PID 4')
    expect(requiresProcessBatchConfirmation(inject)).toBe(true)
    expect(requiresProcessBatchConfirmation(confirmedInject)).toBe(false)
  })

  it('validates batch tag arguments with the shared tag color contract', () => {
    expect(processBatchTagArgsSchema.parse({
      tag: 'devhub-batch',
      color: 'warning',
      pinned: true
    })).toEqual({
      tag: 'devhub-batch',
      color: 'warning',
      pinned: true
    })

    expect(() => processBatchTagArgsSchema.parse({
      tag: '',
      color: 'invalid-color'
    })).toThrow()
  })

  it('runs per-PID operations sequentially and records ok, failed, and skipped', async () => {
    const request = createProcessBatchRequest('focus', [301, 302, 303])
    const progress = await runSequentialProcessBatch(
      request,
      async (pid) => {
        if (pid === 302) return false
        if (pid === 303) return { skipped: true, reason: 'no visible window for pid' }
        return { success: true }
      },
      { jobId: '33333333-3333-4333-8333-333333333333' }
    )

    expect(progress).toMatchObject({
      total: 3,
      completed: 3,
      failed: 1,
      state: 'completed'
    })
    expect(progress.results.map(result => result.status)).toEqual(['ok', 'failed', 'skipped'])
    expect(summarizeProcessBatchProgress(progress, '批量聚焦')).toBe('批量聚焦部分失败：成功 1/3，失败 1，跳过 1')
  })

  it('supports dry-run requests without calling native handlers', async () => {
    const request = createProcessBatchRequest('export-diag', [401, 402], { dryRun: true })
    let calls = 0
    const progress = await runSequentialProcessBatch(
      request,
      () => {
        calls += 1
        return true
      },
      { jobId: '44444444-4444-4444-8444-444444444444' }
    )

    expect(calls).toBe(0)
    expect(progress.results.map(result => result.status)).toEqual(['skipped', 'skipped'])
  })
})
