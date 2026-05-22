import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import DatabaseConstructor from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { BetterQueueAdapter, type BetterQueueTask } from './BetterQueueAdapter'

function waitForEvent<T>(adapter: BetterQueueAdapter, eventName: string, timeoutMs = 3000): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${eventName}`))
    }, timeoutMs)
    const cleanup = (): void => {
      clearTimeout(timeout)
      adapter.off(eventName, onEvent)
      adapter.off('error', onError)
    }
    const onEvent = (...args: T[]): void => {
      cleanup()
      resolve(args)
    }
    const onError = (error: unknown): void => {
      cleanup()
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    adapter.on(eventName, onEvent)
    adapter.on('error', onError)
  })
}

describe('BetterQueueAdapter', () => {
  it('processes real better-queue tasks with a better-sqlite3 store and forwards native events', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-better-queue-'))
    const dbPath = join(root, 'better-queue.sqlite')
    const processed: BetterQueueTask[] = []
    const adapter = new BetterQueueAdapter({
      dbPath,
      concurrent: 1,
      processor: async task => {
        processed.push(task)
        return { ok: true, id: task.id }
      }
    })

    try {
      const accepted = waitForEvent(adapter, 'task_accepted')
      const started = waitForEvent(adapter, 'task_started')
      const finished = waitForEvent(adapter, 'task_finish')
      const drained = waitForEvent(adapter, 'drain')
      adapter.push({ id: 'native-better-queue-task', priority: 5, payload: { source: 'vitest' } })

      expect((await accepted)[0]).toBe('native-better-queue-task')
      expect((await started)[0]).toBe('native-better-queue-task')
      const finishArgs = await finished
      expect(finishArgs[0]).toBe('native-better-queue-task')
      expect(finishArgs[1]).toEqual({ ok: true, id: 'native-better-queue-task' })
      expect(processed).toHaveLength(1)
      expect(existsSync(dbPath)).toBe(true)
      await drained

      const db = new DatabaseConstructor(dbPath, { readonly: true, fileMustExist: true })
      try {
        const count = db.prepare('SELECT COUNT(*) AS count FROM better_queue_tasks').get() as { count: number }
        expect(count.count).toBe(0)
      } finally {
        db.close()
      }
    } finally {
      await adapter.destroy()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('forwards native task_failed events without converting them to success', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-better-queue-fail-'))
    const adapter = new BetterQueueAdapter({
      dbPath: join(root, 'better-queue.sqlite'),
      concurrent: 1,
      maxRetries: 0,
      processor: async () => {
        throw new Error('real better-queue failure')
      }
    })

    try {
      const failed = waitForEvent(adapter, 'task_failed')
      adapter.push({ id: 'native-better-queue-fail', payload: { source: 'vitest' } })
      const args = await failed
      expect(args[0]).toBe('native-better-queue-fail')
      expect(String(args[1])).toContain('real better-queue failure')
    } finally {
      await adapter.destroy()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('bridges native better-queue events into task state transitions for task:state-stream', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-better-queue-stream-'))
    const transitions: Array<{ taskId: string; sessionId: string | null; prev: string; next: string; reason: string; at: number }> = []
    let currentTime = 10_000
    const adapter = new BetterQueueAdapter({
      dbPath: join(root, 'better-queue.sqlite'),
      concurrent: 1,
      processor: async task => ({ ok: true, id: task.id })
    })
    const unsubscribe = adapter.subscribeTaskStateTransitions(transition => transitions.push(transition), () => {
      currentTime += 1
      return currentTime
    })

    try {
      const drained = waitForEvent(adapter, 'drain')
      adapter.push({
        id: 'native-stream-run',
        priority: 1,
        payload: { taskId: 'native-stream-task', sessionId: 'native-stream-session' }
      })
      await drained

      expect(transitions.map(transition => [transition.prev, transition.next, transition.reason])).toEqual([
        ['pending', 'queued', 'better-queue:task_accepted'],
        ['queued', 'running', 'better-queue:task_started'],
        ['running', 'succeeded', 'better-queue:task_finish']
      ])
      expect(transitions.every(transition => transition.taskId === 'native-stream-task')).toBe(true)
      expect(transitions.every(transition => transition.sessionId === 'native-stream-session')).toBe(true)
      expect(transitions.map(transition => transition.at)).toEqual([10_001, 10_002, 10_003])
    } finally {
      unsubscribe()
      await adapter.destroy()
      await rm(root, { recursive: true, force: true })
    }
  })
})
