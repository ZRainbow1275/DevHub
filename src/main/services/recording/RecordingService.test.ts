import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { appendFile, mkdtemp, readFile, rm, stat, truncate, unlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { promisify } from 'node:util'
import { describe, expect, it, vi } from 'vitest'
import type { FsEvent, RecordingEvent } from '@shared/schemas/recording'
import { RecordingService } from './RecordingService'
import { FsStream, GitDiffStream, ScreenshotStream, StdinStream, StdoutStream, type RecordingEventStream } from './streams'
import { AuditLogger, type AuditEntry } from '../AuditLogger'

const execFileAsync = promisify(execFile)

async function readAuditEntries(logPath: string): Promise<AuditEntry[]> {
  if (!existsSync(logPath)) return []
  const text = await readFile(logPath, 'utf8')
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line) as AuditEntry)
}

describe('RecordingService', () => {
  it('writes each recording kind through dedicated stream classes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-streams-'))
    try {
      const pairs: Array<{ fileName: string; stream: RecordingEventStream; event: RecordingEvent }> = [
        {
          fileName: 'stdout.ndjson',
          stream: new StdoutStream(join(root, 'stdout.ndjson')),
          event: { ts: 1, kind: 'stdout', stream: 'stdout', rawSource: 'line', type: 'message-out', payload: { line: 'real stdout' } }
        },
        {
          fileName: 'stdin.ndjson',
          stream: new StdinStream(join(root, 'stdin.ndjson')),
          event: { ts: 2, kind: 'stdin', origin: 'user', injectActionId: null, text: 'real stdin' }
        },
        {
          fileName: 'screenshots.ndjson',
          stream: new ScreenshotStream(join(root, 'screenshots.ndjson')),
          event: { ts: 3, kind: 'screenshot', filePath: join(root, 'shot.png'), hwnd: null, region: 'window', sizeBytes: 68 }
        },
        {
          fileName: 'fs-events.ndjson',
          stream: new FsStream(join(root, 'fs-events.ndjson')),
          event: { ts: 4, kind: 'fs', op: 'change', path: 'tracked.txt', sha256Before: '0'.repeat(64), sha256After: '1'.repeat(64), sizeBytes: 12 }
        },
        {
          fileName: 'git-diff.ndjson',
          stream: new GitDiffStream(join(root, 'git-diff.ndjson')),
          event: { ts: 5, kind: 'git-diff', phase: 'post-task', branch: 'main', headSha: 'a'.repeat(40), diffStat: 'clean', diffPath: join(root, 'git-diff.txt') }
        }
      ]

      for (const pair of pairs) {
        pair.stream.append(pair.event)
        await pair.stream.close()
        const lines = (await readFile(join(root, pair.fileName), 'utf8')).trim().split('\n')
        expect(JSON.parse(lines[0])).toMatchObject({ kind: pair.event.kind })
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('records real stdout, stdin, git diff, asciinema cast, and redacted zip artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-git-'))
    try {
      await initGitRepo(cwd)
      await writeFile(join(cwd, 'tracked.txt'), 'changed before start\n', 'utf8')
      const auditLogger = new AuditLogger({ logDir: join(root, 'logs') })
      const service = new RecordingService({ userDataRoot: () => root, audit: auditLogger.log.bind(auditLogger) })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-recording-spec-22',
        cwd,
        enabledStreams: ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'],
        confirmedBy: 'vitest'
      })

      expect(manifest.enabledStreams).toEqual(['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'])
      expect(existsSync(manifest.manifestPath)).toBe(true)
      expect(existsSync(join(manifest.directory, 'stdout.ndjson'))).toBe(true)
      expect(existsSync(join(manifest.directory, 'stdin.ndjson'))).toBe(true)
      expect(existsSync(join(manifest.directory, 'git-diff.txt'))).toBe(true)

      await service.recordStdout({
        sessionId: manifest.sessionId,
        tool: 'codex',
        stream: 'stdout',
        line: 'build complete',
        eventType: 'message-out',
        rawSource: 'ndjson',
        payload: { taskId: manifest.taskId }
      })
      await service.recordStdin({
        recordingId: manifest.recordingId,
        origin: 'inject',
        injectActionId: randomUUID(),
        text: 'OPENAI_API_KEY=sk-test-secret-value'
      })
      await writeFile(join(cwd, 'tracked.txt'), 'changed before stop\n', 'utf8')
      const stopped = await service.stop(manifest.recordingId)

      expect(stopped.status).toBe('stopped')
      const events = await service.getEvents({ recordingId: manifest.recordingId })
      expect(events.map(event => event.kind)).toContain('stdout')
      expect(events.map(event => event.kind)).toContain('stdin')
      expect(events.filter(event => event.kind === 'git-diff')).toHaveLength(2)

      const castPath = join(root, 'recording.cast')
      await service.exportAsciinema(manifest.recordingId, castPath)
      const castLines = (await readFile(castPath, 'utf8')).trim().split('\n')
      expect(JSON.parse(castLines[0])).toMatchObject({ version: 2, width: 120, height: 40 })
      expect(JSON.parse(castLines[1])).toEqual(expect.arrayContaining([expect.any(Number), 'o', 'build complete']))

      const zipPath = join(root, 'redacted.zip')
      await service.exportZip(manifest.recordingId, zipPath, { redact: true })
      const zipText = (await readFile(zipPath)).toString('utf8')
      const sourceStdinText = await readFile(join(manifest.directory, 'stdin.ndjson'), 'utf8')
      expect(zipText).toContain('OPENAI_API_KEY=***')
      expect(zipText).not.toContain('sk-test-secret-value')
      expect(zipText).toContain('"redactionApplied": true')
      expect(sourceStdinText).toContain('sk-test-secret-value')
      const auditEntries = await readAuditEntries(auditLogger.getAuditLogPath())
      const auditActions = auditEntries.map(entry => entry.action)
      expect(auditActions).toEqual(expect.arrayContaining(['recording:start', 'recording:stop', 'recording:redacted-export']))
      expect(auditEntries.find(entry => entry.action === 'recording:redacted-export')?.target).toMatchObject({
        recordingId: manifest.recordingId,
        taskId: manifest.taskId,
        redact: true
      })
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('captures real filesystem add, change, and unlink events with sha256 transitions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-fs-root-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-fs-cwd-'))
    try {
      const service = new RecordingService({ userDataRoot: () => root })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-fs-watch',
        cwd,
        enabledStreams: ['fs'],
        confirmedBy: 'vitest'
      })
      const target = join(cwd, 'notes.txt')
      await delay(120)
      await writeFile(target, 'one', 'utf8')
      await waitFor(async () => (await service.getEvents({ recordingId: manifest.recordingId, kind: 'fs' })).some(event => event.kind === 'fs' && event.op === 'add'))
      await writeFile(target, 'two', 'utf8')
      await waitFor(async () => (await service.getEvents({ recordingId: manifest.recordingId, kind: 'fs' })).some(event => event.kind === 'fs' && event.op === 'change'))
      await unlink(target)
      await waitFor(async () => (await service.getEvents({ recordingId: manifest.recordingId, kind: 'fs' })).some(event => event.kind === 'fs' && event.op === 'unlink'))
      await service.stop(manifest.recordingId)

      const events = await service.getEvents({ recordingId: manifest.recordingId, kind: 'fs' })
      const fsEvents = events.filter((event): event is FsEvent => event.kind === 'fs')
      const ops = fsEvents.map(event => event.op)
      expect(ops).toEqual(expect.arrayContaining(['add', 'change', 'unlink']))
      const change = fsEvents.find(event => event.op === 'change')
      expect(change?.sha256Before).toMatch(/^[a-f0-9]{64}$/)
      expect(change?.sha256After).toMatch(/^[a-f0-9]{64}$/)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })


  it('builds replay state, event windows, cast, screenshot lookup, fs snapshot, and anchors from real artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-replay-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-replay-cwd-'))
    const injectActionId = randomUUID()
    try {
      await initGitRepo(cwd)
      let now = 1_900_000
      const service = new RecordingService({ userDataRoot: () => root, now: () => now })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-replay-spec-23',
        cwd,
        enabledStreams: ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'],
        confirmedBy: 'vitest'
      })

      now += 1000
      await service.recordStdout({ sessionId: manifest.sessionId, tool: 'codex', line: 'Error: real failure', eventType: 'error', rawSource: 'line' })
      now += 1000
      await service.recordStdin({ recordingId: manifest.recordingId, origin: 'inject', injectActionId, text: 'continue' })
      now += 1000
      const screenshotPath = join(manifest.directory, 'screenshots', 'cursor.png')
      await writeFile(screenshotPath, oneByOnePngBuffer())
      await appendFile(join(manifest.directory, 'screenshots.ndjson'), `${JSON.stringify({ ts: now, kind: 'screenshot', filePath: screenshotPath, hwnd: null, region: 'window', sizeBytes: oneByOnePngBuffer().byteLength })}\n`, 'utf8')
      now += 1000
      const target = join(cwd, 'burst.txt')
      await delay(120)
      await writeFile(target, 'one', 'utf8')
      await waitFor(async () => (await service.getEvents({ recordingId: manifest.recordingId, kind: 'fs' })).some(event => event.kind === 'fs' && event.path === 'burst.txt'))
      await writeFile(join(cwd, 'tracked.txt'), 'changed for replay\n', 'utf8')
      now += 1000
      const stopped = await service.stop(manifest.recordingId)

      const replay = await service.getReplayState({ recordingId: manifest.recordingId, cursorTs: now, speed: 4, paused: true })
      expect(replay.recordingId).toBe(manifest.recordingId)
      expect(replay.speed).toBe(4)
      expect(replay.endedAtAbsTs).toBeGreaterThanOrEqual(stopped.stoppedAt ?? 0)
      expect(replay.anchors.map(anchor => anchor.kind)).toEqual(expect.arrayContaining(['error', 'inject', 'state-flip']))

      const windowed = await service.getEventsWindow({ recordingId: manifest.recordingId, sinceTs: manifest.startedAt, untilTs: replay.endedAtAbsTs, kinds: ['stdout', 'stdin'] })
      expect(windowed.map(event => event.kind)).toEqual(expect.arrayContaining(['stdout', 'stdin']))
      expect(windowed.every(event => event.kind === 'stdout' || event.kind === 'stdin')).toBe(true)

      const { cast } = await service.getCast({ recordingId: manifest.recordingId })
      expect(cast.events[0]).toEqual(expect.arrayContaining([expect.any(Number), 'o', 'Error: real failure']))

      const screenshot = await service.getScreenshot({ recordingId: manifest.recordingId, ts: now })
      expect(screenshot).toMatchObject({ filePath: screenshotPath, width: 1, height: 1 })

      const fsSnapshot = await service.getFsSnapshotAt({ recordingId: manifest.recordingId, ts: replay.endedAtAbsTs })
      expect(fsSnapshot.tree.some(entry => entry.path === 'burst.txt' && entry.op === 'add')).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('keeps 1000 stdout writes within the spec budget on the real append-only hot path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-stdout-bench-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-stdout-bench-cwd-'))
    try {
      const service = new RecordingService({ userDataRoot: () => root })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-stdout-bench',
        cwd,
        enabledStreams: ['stdout'],
        confirmedBy: 'vitest'
      })

      const startedAt = performance.now()
      for (let index = 0; index < 1000; index += 1) {
        await service.recordStdout({
          sessionId: manifest.sessionId,
          line: `stdout-line-${index}`,
          eventType: 'message-out',
          rawSource: 'line'
        })
      }
      const durationMs = performance.now() - startedAt

      const stopped = await service.stop(manifest.recordingId)
      const events = await service.getEvents({ recordingId: manifest.recordingId, kind: 'stdout' })

      expect(stopped.status).toBe('stopped')
      expect(events).toHaveLength(1000)
      expect(durationMs).toBeLessThan(80)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('serializes screenshot captures through p-queue and keeps stdout task work non-blocking', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-screenshot-queue-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-screenshot-queue-cwd-'))
    try {
      vi.useFakeTimers()
      let inFlight = 0
      let maxInFlight = 0
      let calls = 0
      const releaseCaptures: Array<() => void> = []
      const mainWindow = {
        capturePage: vi.fn(() => {
          inFlight += 1
          maxInFlight = Math.max(maxInFlight, inFlight)
          calls += 1
          return new Promise<{ toPNG: () => Buffer }>((resolve) => {
            releaseCaptures.push(() => {
              inFlight -= 1
              resolve({ toPNG: () => oneByOnePngBuffer() })
            })
          })
        })
      }
      const service = new RecordingService({
        userDataRoot: () => root,
        getMainWindow: () => mainWindow as unknown as import('electron').BrowserWindow
      })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-screenshot-queue',
        cwd,
        enabledStreams: ['stdout', 'screenshot'],
        screenshotIntervalMs: 2000,
        confirmedBy: 'vitest'
      })

      await vi.advanceTimersByTimeAsync(6000)
      expect(calls).toBe(1)
      expect(maxInFlight).toBe(1)
      const startedAt = process.hrtime.bigint()
      for (let index = 0; index < 1000; index += 1) {
        await service.recordStdout({
          sessionId: manifest.sessionId,
          line: `background-stdout-${index}`,
          eventType: 'message-out',
          rawSource: 'line'
        })
      }
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      expect(durationMs).toBeLessThan(80)
      expect(releaseCaptures).toHaveLength(1)
      releaseCaptures[0]?.()
      const stopped = await service.stop(manifest.recordingId)

      expect(stopped.status).toBe('stopped')
      expect(calls).toBe(1)
      const stdoutEvents = await service.getEvents({ recordingId: manifest.recordingId, kind: 'stdout' })
      expect(stdoutEvents).toHaveLength(1000)
    } finally {
      vi.useRealTimers()
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('handles a real 1GB sparse fixture in the recording directory', async () => {
    const baseDir = join(process.cwd(), '..')
    const root = await mkdtemp(join(baseDir, 'devhub-recording-1gb-fixture-'))
    const cwd = await mkdtemp(join(baseDir, 'devhub-recording-1gb-fixture-cwd-'))
    try {
      const service = new RecordingService({ userDataRoot: () => root })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-1gb-fixture',
        cwd,
        enabledStreams: ['stdout'],
        confirmedBy: 'vitest'
      })
      const fixturePath = join(manifest.directory, 'fixture-1gb.bin')
      await writeFile(fixturePath, '')
      await truncate(fixturePath, 1_073_741_824)

      const stopped = await service.stop(manifest.recordingId)
      expect(stopped.bytes).toBeGreaterThanOrEqual(1_073_741_824)
      expect(existsSync(fixturePath)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('rotates real stream files when the per-task quota is exceeded', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-rotate-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-rotate-cwd-'))
    try {
      const auditLogger = new AuditLogger({ logDir: join(root, 'logs') })
      const service = new RecordingService({ userDataRoot: () => root, singleTaskMaxBytes: 512, audit: auditLogger.log.bind(auditLogger) })
      const manifest = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-rotate',
        cwd,
        enabledStreams: ['stdout'],
        confirmedBy: 'vitest'
      })
      await service.recordStdout({ sessionId: manifest.sessionId, line: 'x'.repeat(1200), eventType: 'message-out', rawSource: 'line' })
      const updated = await service.getManifest({ recordingId: manifest.recordingId })
      expect(updated?.rotated).toBe(true)
      expect(updated?.rotationCount).toBeGreaterThanOrEqual(1)
      expect(existsSync(join(manifest.directory, '.archive'))).toBe(true)
      expect((await stat(join(manifest.directory, 'stdout.ndjson'))).isFile()).toBe(true)
      await service.stop(manifest.recordingId)
      const auditEntries = await readAuditEntries(auditLogger.getAuditLogPath())
      expect(auditEntries.some(entry => entry.action === 'recording:rotate' && entry.target.recordingId === manifest.recordingId)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })

  it('evicts least-recently-accessed stopped recordings when the global quota is exceeded', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devhub-recording-lru-'))
    const cwd = await mkdtemp(join(tmpdir(), 'devhub-recording-lru-cwd-'))
    try {
      const auditLogger = new AuditLogger({ logDir: join(root, 'logs') })
      const service = new RecordingService({ userDataRoot: () => root, totalMaxBytes: 5000, audit: auditLogger.log.bind(auditLogger) })
      const older = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-lru-older',
        cwd,
        enabledStreams: ['stdout'],
        confirmedBy: 'vitest'
      })
      await service.recordStdout({ sessionId: older.sessionId, line: 'older '.repeat(450), eventType: 'message-out', rawSource: 'line' })
      await service.stop(older.recordingId)
      expect(existsSync(older.directory)).toBe(true)

      const newer = await service.start({
        sessionId: randomUUID(),
        taskId: 'task-lru-newer',
        cwd,
        enabledStreams: ['stdout'],
        confirmedBy: 'vitest'
      })
      await service.recordStdout({ sessionId: newer.sessionId, line: 'newer '.repeat(450), eventType: 'message-out', rawSource: 'line' })
      await service.stop(newer.recordingId)

      expect(existsSync(older.directory)).toBe(false)
      expect(existsSync(newer.directory)).toBe(true)
      const auditEntries = await readAuditEntries(auditLogger.getAuditLogPath())
      expect(auditEntries.some(entry => entry.action === 'recording:lru-evict' && entry.target.recordingId === older.recordingId)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
      await rm(cwd, { recursive: true, force: true })
    }
  })
})

async function initGitRepo(cwd: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd })
  await writeFile(join(cwd, 'tracked.txt'), 'initial\n', 'utf8')
  await execFileAsync('git', ['add', 'tracked.txt'], { cwd })
  await execFileAsync('git', ['-c', 'user.name=DevHub Test', '-c', 'user.email=devhub@example.test', 'commit', '-m', 'initial'], { cwd })
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 2500): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return
    await delay(50)
  }
  throw new Error('Timed out waiting for recording event')
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}


function oneByOnePngBuffer(): Buffer {
  return Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex')
}
