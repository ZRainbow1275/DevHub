import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DatabaseConstructor from 'better-sqlite3'
import { StoreBackedTaskQueueService, type TaskQueueStore } from './TaskQueueService'
import { SQLiteTaskQueueStore } from './SQLiteTaskQueueStore'
import type { RuntimeCsvTaskRow } from '../csv'
import { CsvTaskDriver } from '../csv'

class MemoryTaskQueueStore implements TaskQueueStore {
  private readonly data = new Map<string, unknown>()

  get(key: string, defaultValue?: unknown): unknown {
    return this.data.has(key) ? this.data.get(key) : defaultValue
  }

  set(key: string, value: unknown): void {
    this.data.set(key, value)
  }
}

function row(id: string, overrides: Partial<RuntimeCsvTaskRow> = {}): RuntimeCsvTaskRow {
  return {
    id,
    group: 'queue-vitest',
    tool: 'codex',
    prompt: `run ${id}`,
    priority: 50,
    retries: 0,
    dry_run: false,
    allow_inject: false,
    ...overrides
  }
}

function service(now?: () => number): StoreBackedTaskQueueService {
  return new StoreBackedTaskQueueService(new MemoryTaskQueueStore(), value => JSON.stringify(value), now)
}

async function loadFixtureRows(name: string): Promise<RuntimeCsvTaskRow[]> {
  const driver = new CsvTaskDriver()
  const group = await driver.loadGroup(join(process.cwd(), 'src', 'main', 'services', 'task-queue', 'fixtures', name), new Set(['code-review', 'lint-fix']))
  expect(group.errors).toEqual([])
  return group.rows.map(item => item.runtimeRow).filter((item): item is RuntimeCsvTaskRow => Boolean(item))
}

function fixtureQueue(driver = new CsvTaskDriver()): StoreBackedTaskQueueService {
  return new StoreBackedTaskQueueService(new MemoryTaskQueueStore(), row => driver.rowHash(row))
}

describe('StoreBackedTaskQueueService', () => {
  it('schedules DAG rows only after dependencies succeed', () => {
    const queue = service()
    queue.enqueueRows({ sessionId: 'dag', rows: [row('A'), row('B', { dependency: 'A' }), row('C', { dependency: 'A' })], concurrent: 2 })

    const first = queue.startReadyTasks({ sessionId: 'dag', concurrent: 2 })
    expect(first.started.map(task => task.row.id)).toEqual(['A'])
    expect(queue.getStats({ sessionId: 'dag' })).toMatchObject({ running: 1, queued: 2 })

    queue.completeTask({ runId: first.started[0].runId, exitCode: 0 })
    const second = queue.startReadyTasks({ sessionId: 'dag', concurrent: 2 })
    expect(second.started.map(task => task.row.id).sort()).toEqual(['B', 'C'])
  })

  it('uses DagOrchestrator dependency conditions for queue readiness', () => {
    const queue = service()
    queue.enqueueRows({
      sessionId: 'dag-conditions',
      rows: [
        row('A'),
        row('B', { dependency: 'after:A if=failure' }),
        row('C', { dependency: 'after:A if=success' }),
        row('D', { dependency: 'after:B|C if=completed' })
      ],
      concurrent: 4
    })

    const first = queue.startReadyTasks({ sessionId: 'dag-conditions', concurrent: 4 })
    expect(first.started.map(task => task.row.id)).toEqual(['A'])

    queue.completeTask({ runId: first.started[0].runId, exitCode: 1, errorCode: 'E_REAL' })
    const second = queue.startReadyTasks({ sessionId: 'dag-conditions', concurrent: 4 })
    expect(second.started.map(task => task.row.id)).toEqual(['B'])

    queue.completeTask({ runId: second.started[0].runId, exitCode: 0 })
    const third = queue.startReadyTasks({ sessionId: 'dag-conditions', concurrent: 4 })
    expect(third.started.map(task => task.row.id)).toEqual(['D'])
    expect(queue.listTasks({ sessionId: 'dag-conditions' }).find(task => task.row.id === 'C')?.status).toBe('waiting-dependency')
  })

  it('persists rows in DagOrchestrator topological order when input rows are unsorted', () => {
    const queue = service()
    const enqueued = queue.enqueueRows({
      sessionId: 'toposort',
      rows: [
        row('C', { dependency: 'B' }),
        row('B', { dependency: 'A' }),
        row('A')
      ],
      concurrent: 3
    })

    expect(enqueued.tasks.map(task => task.row.id)).toEqual(['A', 'B', 'C'])
    expect(queue.listTasks({ sessionId: 'toposort' }).map(task => task.row.id)).toEqual(['A', 'B', 'C'])
    expect(queue.startReadyTasks({ sessionId: 'toposort', concurrent: 3 }).started.map(task => task.row.id)).toEqual(['A'])
  })

  it('enforces parallel group limits independently from global concurrency', () => {
    const queue = service()
    queue.enqueueRows({
      sessionId: 'parallel',
      rows: Array.from({ length: 6 }, (_, index) => row(`task-${index}`, { parallel_group: 'frontend' })),
      concurrent: 10,
      parallelGroupOverrides: { frontend: 2 }
    })

    const started = queue.startReadyTasks({ sessionId: 'parallel', concurrent: 10, parallelGroupOverrides: { frontend: 2 } }).started

    expect(started).toHaveLength(2)
    expect(started.every(task => task.parallelGroup === 'frontend')).toBe(true)

    const unlimitedQueue = service()
    unlimitedQueue.enqueueRows({
      sessionId: 'parallel-unlimited',
      rows: Array.from({ length: 4 }, (_, index) => row(`free-${index}`, { parallel_group: 'backend' })),
      concurrent: 4
    })
    expect(unlimitedQueue.startReadyTasks({ sessionId: 'parallel-unlimited', concurrent: 4 }).started).toHaveLength(4)
  })

  it('supports resume skip, force rerun, and rowHash change detection', () => {
    const queue = service()
    queue.enqueueRows({ sessionId: 'resume', rows: [row('task-1')] })
    const running = queue.startReadyTasks({ sessionId: 'resume', concurrent: 1 }).started[0]
    queue.completeTask({ runId: running.runId, exitCode: 0 })

    const skipped = queue.enqueueRows({ sessionId: 'resume', rows: [row('task-1')], resume: true })
    expect(skipped.tasks[0]).toMatchObject({ status: 'skipped', errorCode: 'RESUME_SKIPPED' })

    const forced = queue.enqueueRows({ sessionId: 'resume', rows: [row('task-1')], resume: true, forceRerun: ['task-1'] })
    expect(forced.tasks[0].status).toBe('queued')

    queue.enqueueRows({ sessionId: 'changed', rows: [row('task-1')] })
    const changedRunning = queue.startReadyTasks({ sessionId: 'changed', concurrent: 1 }).started[0]
    queue.completeTask({ runId: changedRunning.runId, exitCode: 0 })
    const changed = queue.enqueueRows({ sessionId: 'changed', rows: [row('task-1', { prompt: 'changed real input' })], resume: true })
    expect(changed.tasks[0]).toMatchObject({ status: 'queued', errorCode: 'ROW_HASH_CHANGED' })
  })

  it('keeps retry transitions explicit instead of faking success', () => {
    const queue = service()
    queue.enqueueRows({ sessionId: 'retry', rows: [row('unstable', { retries: 1 })] })
    const started = queue.startReadyTasks({ sessionId: 'retry', concurrent: 1 }).started[0]

    const failed = queue.completeTask({ runId: started.runId, exitCode: 1, errorCode: 'E_RUNTIME', errorMessage: 'real executor failure' })
    expect(failed).toMatchObject({ status: 'retrying', attemptCount: 1, errorCode: 'E_RUNTIME' })
    expect(failed.retryBackoffMs).toBeGreaterThanOrEqual(1600)
    expect(failed.retryBackoffMs).toBeLessThanOrEqual(2400)
    expect(failed.nextRetryAt).toBe((failed.endedAt ?? 0) + (failed.retryBackoffMs ?? 0))
    expect(queue.startReadyTasks({ sessionId: 'retry', concurrent: 1 }).started).toEqual([])

    const retried = queue.retry({ runId: failed.runId, confirmedBy: 'vitest' })[0]
    expect(retried).toMatchObject({ status: 'queued', errorCode: null, retryBackoffMs: null, nextRetryAt: null })
  })

  it('routes on_fail next, abort, fallback-tool, escalate-model, human, and execute-skill truthfully', () => {
    const nextQueue = service()
    nextQueue.enqueueRows({
      sessionId: 'on-fail-next',
      rows: [row('A', { on_fail: 'next' }), row('B', { dependency: 'A' })]
    })
    const nextStarted = nextQueue.startReadyTasks({ sessionId: 'on-fail-next', concurrent: 1 }).started[0]
    const skipped = nextQueue.completeTask({ runId: nextStarted.runId, exitCode: 1, errorCode: 'E_REAL' })
    expect(skipped).toMatchObject({ status: 'skipped', errorCode: 'ON_FAIL_NEXT' })
    expect(nextQueue.startReadyTasks({ sessionId: 'on-fail-next', concurrent: 1 }).started.map(task => task.row.id)).toEqual(['B'])

    const abortQueue = service()
    abortQueue.enqueueRows({ sessionId: 'on-fail-abort', rows: [row('A', { on_fail: 'abort' }), row('B')] })
    const abortStarted = abortQueue.startReadyTasks({ sessionId: 'on-fail-abort', concurrent: 1 }).started[0]
    const aborted = abortQueue.completeTask({ runId: abortStarted.runId, exitCode: 1, errorCode: 'E_ABORT' })
    expect(aborted.status).toBe('failed')
    expect(abortQueue.listTasks({ sessionId: 'on-fail-abort' }).find(task => task.row.id === 'B')).toMatchObject({ status: 'cancelled', errorCode: 'ON_FAIL_ABORT' })

    const fallbackQueue = service(() => 100)
    fallbackQueue.enqueueRows({ sessionId: 'on-fail-fallback', rows: [row('A', { on_fail: 'fallback-tool', fallback_tool: 'gemini', retries: 0 })] })
    const fallbackStarted = fallbackQueue.startReadyTasks({ sessionId: 'on-fail-fallback', concurrent: 1 }).started[0]
    const fallback = fallbackQueue.completeTask({ runId: fallbackStarted.runId, exitCode: 1, errorCode: 'E_TOOL' })
    expect(fallback).toMatchObject({ status: 'retrying', errorCode: 'ON_FAIL_FALLBACK_TOOL', retryBackoffMs: 0, nextRetryAt: 100 })
    expect(fallback.row.tool).toBe('gemini')
    expect(fallbackQueue.startReadyTasks({ sessionId: 'on-fail-fallback', concurrent: 1 }).started[0].row.tool).toBe('gemini')

    const humanQueue = service()
    for (const [taskId, overrides, errorCode] of [
      ['human', { on_fail: 'human' }, 'E_ON_FAIL_HUMAN'],
      ['escalate', { on_fail: 'escalate-model' }, 'ON_FAIL_ESCALATE_MODEL'],
      ['skill', { on_fail: 'execute-skill', execute_skill: 'code-review' }, 'E_SKILL_EXECUTOR_UNAVAILABLE']
    ] as const) {
      humanQueue.enqueueRows({ sessionId: `on-fail-${taskId}`, rows: [row(taskId, overrides)] })
      const started = humanQueue.startReadyTasks({ sessionId: `on-fail-${taskId}`, concurrent: 1 }).started[0]
      const updated = humanQueue.completeTask({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL' })
      expect(updated).toMatchObject({ status: 'awaiting-human', errorCode })
    }
    expect(humanQueue.listTasks({ sessionId: 'on-fail-escalate' })[0].row.needs_bigger_model).toBe(true)
  })

  it('records real execute-skill outcomes only when a queue executor is available', () => {
    const queue = new StoreBackedTaskQueueService(new MemoryTaskQueueStore(), value => JSON.stringify(value), () => 500, { onFailSkillExecutorAvailable: true })
    queue.enqueueRows({ sessionId: 'on-fail-skill-executor', rows: [row('skill', { on_fail: 'execute-skill', execute_skill: 'code-review' })] })
    const started = queue.startReadyTasks({ sessionId: 'on-fail-skill-executor', concurrent: 1 }).started[0]
    const pending = queue.completeTask({ runId: started.runId, exitCode: 1, errorCode: 'E_REAL' })

    expect(pending).toMatchObject({
      status: 'awaiting-human',
      errorCode: 'ON_FAIL_EXECUTE_SKILL_RUNNING',
      errorMessage: 'task failed with E_REAL; executing on_fail skill code-review'
    })

    const queued = queue.recordOnFailSkillResult({
      runId: pending.runId,
      success: true,
      artifactPath: 'C:/devhub/task-queue/on-fail-skills/skill',
      exitCode: 0,
      errorCode: 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED',
      errorMessage: 'on_fail skill code-review executed successfully; task queued for retry'
    })

    expect(queued).toMatchObject({
      status: 'queued',
      errorCode: 'ON_FAIL_EXECUTE_SKILL_SUCCEEDED',
      artifactsPath: 'C:/devhub/task-queue/on-fail-skills/skill',
      retryBackoffMs: 0,
      nextRetryAt: 500
    })
    expect(queue.startReadyTasks({ sessionId: 'on-fail-skill-executor', concurrent: 1 }).started[0]).toMatchObject({ status: 'running', errorCode: null })
  })

  it('promotes retrying tasks only after the exponential backoff window elapses', () => {
    let currentTime = 10_000
    const queue = service(() => currentTime)
    queue.enqueueRows({ sessionId: 'auto-retry', rows: [row('unstable', { retries: 2 })] })
    const started = queue.startReadyTasks({ sessionId: 'auto-retry', concurrent: 1 }).started[0]
    const retrying = queue.completeTask({ runId: started.runId, exitCode: 1, errorCode: 'E_RUNTIME' })

    expect(retrying.status).toBe('retrying')
    expect(retrying.retryBackoffMs).toBeGreaterThanOrEqual(1600)
    expect(retrying.retryBackoffMs).toBeLessThanOrEqual(2400)

    currentTime = (retrying.nextRetryAt ?? currentTime) - 1
    expect(queue.startReadyTasks({ sessionId: 'auto-retry', concurrent: 1 }).started).toEqual([])

    currentTime = retrying.nextRetryAt ?? currentTime
    const restarted = queue.startReadyTasks({ sessionId: 'auto-retry', concurrent: 1 }).started
    expect(restarted.map(task => task.row.id)).toEqual(['unstable'])
    expect(restarted[0]).toMatchObject({ status: 'running', retryBackoffMs: null, nextRetryAt: null })

    const secondRetry = queue.completeTask({ runId: restarted[0].runId, exitCode: 1, errorCode: 'E_RUNTIME' })
    expect(secondRetry).toMatchObject({ status: 'retrying', attemptCount: 2 })
    expect(secondRetry.retryBackoffMs).toBeGreaterThanOrEqual(3200)
    expect(secondRetry.retryBackoffMs).toBeLessThanOrEqual(4800)
  })

  it('enforces strict state transitions for executor completion and manual retry', () => {
    const queue = service()
    const queued = queue.enqueueRows({ sessionId: 'state-machine', rows: [row('strict', { retries: 0 })] }).tasks[0]

    expect(() => queue.completeTask({ runId: queued.runId, exitCode: 0 })).toThrow('E_STATE_TRANSITION')

    const running = queue.startReadyTasks({ sessionId: 'state-machine', concurrent: 1 }).started[0]
    const failed = queue.completeTask({ runId: running.runId, exitCode: 1, errorCode: 'E_REAL', errorMessage: 'real executor failed' })
    expect(failed.status).toBe('failed')

    const retried = queue.retry({ runId: failed.runId, confirmedBy: 'vitest' })[0]
    expect(retried.status).toBe('queued')
    expect(queue.listTransitions({ sessionId: 'state-machine' }).map(item => `${item.prev}->${item.next}`)).toEqual([
      'retrying->queued',
      'failed->retrying',
      'running->failed',
      'queued->running'
    ])
  })

  it('rejects cyclic task dependencies and unknown force reruns', () => {
    const queue = service()

    expect(() => queue.enqueueRows({ sessionId: 'cycle', rows: [row('A', { dependency: 'B' }), row('B', { dependency: 'A' })] })).toThrow('E_DAG_CYCLE:A->B->A')
    expect(() => queue.enqueueRows({ sessionId: 'self-cycle', rows: [row('A', { dependency: 'A' })] })).toThrow('E_DAG_CYCLE:A->A')
    expect(() => queue.enqueueRows({ sessionId: 'force', rows: [row('A')], forceRerun: ['missing'] })).toThrow('E_VALIDATION')
  })

  it('loads spec-15 CSV fixtures for dag, parallel-group, retry, and resume cases', async () => {
    const driver = new CsvTaskDriver()
    const dagRows = await loadFixtureRows('dag-5.csv')
    const parallelRows = await loadFixtureRows('parallel-group-6.csv')
    const retryRows = await loadFixtureRows('on-fail-retry-3.csv')
    const resumeRows = await loadFixtureRows('resume-skip-3.csv')

    expect(dagRows).toHaveLength(5)
    expect(parallelRows).toHaveLength(6)
    expect(retryRows).toHaveLength(3)
    expect(resumeRows).toHaveLength(3)

    const dagQueue = fixtureQueue(driver)
    dagQueue.enqueueRows({ sessionId: 'fixture-dag', rows: dagRows, concurrent: 5 })
    const dagFirst = dagQueue.startReadyTasks({ sessionId: 'fixture-dag', concurrent: 5 }).started
    expect(dagFirst.map(task => task.row.id)).toEqual(['dag-a'])
    dagQueue.completeTask({ runId: dagFirst[0].runId, exitCode: 0 })
    expect(dagQueue.startReadyTasks({ sessionId: 'fixture-dag', concurrent: 5 }).started.map(task => task.row.id).sort()).toEqual(['dag-b', 'dag-c'])

    const parallelQueue = fixtureQueue(driver)
    parallelQueue.enqueueRows({ sessionId: 'fixture-parallel', rows: parallelRows, concurrent: 6, parallelGroupOverrides: { frontend: 2 } })
    expect(parallelQueue.startReadyTasks({ sessionId: 'fixture-parallel', concurrent: 6, parallelGroupOverrides: { frontend: 2 } }).started).toHaveLength(2)

    const retryQueue = fixtureQueue(driver)
    retryQueue.enqueueRows({ sessionId: 'fixture-retry', rows: retryRows, concurrent: 1 })
    const retryStarted = retryQueue.startReadyTasks({ sessionId: 'fixture-retry', concurrent: 1 }).started[0]
    const retrying = retryQueue.completeTask({ runId: retryStarted.runId, exitCode: 1, errorCode: 'E_FIXTURE' })
    expect(retrying.status).toBe('retrying')
    expect(retryQueue.retry({ runId: retrying.runId, confirmedBy: 'vitest' })[0].status).toBe('queued')

    const resumeQueue = fixtureQueue(driver)
    resumeQueue.enqueueRows({ sessionId: 'fixture-resume', rows: resumeRows, concurrent: 3 })
    const resumeStarted = resumeQueue.startReadyTasks({ sessionId: 'fixture-resume', concurrent: 3 }).started
    for (const task of resumeStarted) resumeQueue.completeTask({ runId: task.runId, exitCode: 0 })
    const resumed = resumeQueue.enqueueRows({ sessionId: 'fixture-resume', rows: resumeRows, resume: true })
    expect(resumed.skipped).toBe(3)
  })

  it('persists task runs and transition indexes in the real SQLite queue store', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-queue-sqlite-'))
    const dbPath = join(root, 'queue.sqlite')

    try {
      const sqliteStore = new SQLiteTaskQueueStore({ dbPath })
      const queue = new StoreBackedTaskQueueService(sqliteStore, value => JSON.stringify(value), () => 10_000)
      queue.enqueueRows({ sessionId: 'sqlite', rows: [row('persisted')] })
      const started = queue.startReadyTasks({ sessionId: 'sqlite', concurrent: 1 }).started[0]
      queue.completeTask({ runId: started.runId, exitCode: 0 })

      expect(existsSync(dbPath)).toBe(true)

      const reopened = new StoreBackedTaskQueueService(new SQLiteTaskQueueStore({ dbPath }), value => JSON.stringify(value))
      expect(reopened.listTasks({ sessionId: 'sqlite' })).toMatchObject([{ status: 'succeeded', taskId: 'persisted' }])
      expect(reopened.listTransitions({ sessionId: 'sqlite' }).map(item => `${item.prev}->${item.next}`)).toContain('running->succeeded')

      const db = new DatabaseConstructor(dbPath, { readonly: true, fileMustExist: true })
      try {
        const taskRows = db.prepare('SELECT task_id AS taskId, status FROM task_runs').all() as Array<{ taskId: string; status: string }>
        const transitionRows = db.prepare('SELECT task_id AS taskId, next_status AS nextStatus FROM task_state_transitions').all() as Array<{ taskId: string; nextStatus: string }>
        expect(taskRows).toEqual([{ taskId: 'persisted', status: 'succeeded' }])
        expect(transitionRows.some(item => item.taskId === 'persisted' && item.nextStatus === 'succeeded')).toBe(true)
      } finally {
        db.close()
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('backs up a corrupt SQLite queue database and rebuilds a usable store', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-queue-corrupt-'))
    const dbPath = join(root, 'queue.sqlite')

    try {
      await writeFile(dbPath, 'not a sqlite database', 'utf8')
      const store = new SQLiteTaskQueueStore({ dbPath, now: () => 123_456 })

      expect(store.get('tasks', [])).toEqual([])
      const report = store.report()
      expect(report).toMatchObject({
        status: 'recovered',
        checkedAt: 123_456,
        dbPath
      })
      const backupPath = report.backupPath
      expect(typeof backupPath).toBe('string')
      if (backupPath) expect(existsSync(backupPath)).toBe(true)

      store.set('tasks', [])
      expect(store.get('tasks', ['fallback'])).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
