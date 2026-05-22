import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import type { BrowserWindow } from 'electron'
import PQueue from 'p-queue'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { FSWatcher } from 'chokidar'
import {
  fsEventSchema,
  gitDiffEventSchema,
  recordingEventSchema,
  recordingManifestSchema,
  recordingStreamKindSchema,
  screenshotEventSchema,
  stdinEventSchema,
  stdoutEventSchema,
  type FsEvent,
  type RecordingEvent,
  type RecordingGetEventsRequest,
  type RecordingManifest,
  type RecordingStartRequest,
  type RecordingStreamKind
} from '@shared/schemas/recording'
import {
  recordingGetEventsWindowRequestSchema,
  recordingFsSnapshotResultSchema,
  recordingGetCastRequestSchema,
  recordingGetFsSnapshotAtRequestSchema,
  recordingGetReplayStateRequestSchema,
  recordingGetScreenshotRequestSchema,
  recordingListAnchorsRequestSchema,
  recordingListAnchorsResultSchema,
  recordingReplayStateSchema,
  recordingScreenshotResultSchema,
  type AsciinemaCast,
  type RecordingFsSnapshotResult,
  type RecordingReplayAnchor,
  type RecordingReplayState,
  type RecordingScreenshotResult
} from '@shared/schemas/replay-state'
import { buildAsciinemaCast, serializeAsciinemaCast } from './AsciinemaConverter'
import { FsStream, GitDiffStream, ScreenshotStream, StdinStream, StdoutStream, type RecordingEventStream } from './streams'

const DEFAULT_STREAMS: RecordingStreamKind[] = ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff']
const STREAM_EVENT_FILES: Record<RecordingStreamKind, string> = {
  stdout: 'stdout.ndjson',
  stdin: 'stdin.ndjson',
  screenshot: 'screenshots.ndjson',
  fs: 'fs-events.ndjson',
  'git-diff': 'git-diff.ndjson'
}
const SINGLE_TASK_MAX_BYTES = 1_073_741_824
const TOTAL_MAX_BYTES = 53_687_091_200
const SCREENSHOT_MIN_INTERVAL_MS = 2000
const ZIP_UTF8_FLAG = 0x0800
const MANIFEST_HOT_FLUSH_INTERVAL_MS = 1000
type RecordingAuditResult = 'success' | 'refused' | 'error'

interface RecordingServiceOptions {
  userDataRoot: () => string
  getMainWindow?: () => BrowserWindow | null
  emitEvent?: (payload: RecordingEvent & { recordingId: string }) => void
  audit?: (action: string, target: Record<string, unknown>, result: RecordingAuditResult, reason?: string) => void
  now?: () => number
  singleTaskMaxBytes?: number
  totalMaxBytes?: number
}

interface ActiveRecordingSession {
  manifest: RecordingManifest
  watcher: FSWatcher | null
  screenshotTimer: NodeJS.Timeout | null
  screenshotQueue: PQueue | null
  fsHashes: Map<string, string>
  artifactBytes: Map<string, number>
  lastManifestPersistedAt: number
  streams: Map<RecordingStreamKind, RecordingEventStream>
}

interface CliStdoutInput {
  tool?: string
  stream?: 'stdout' | 'stderr' | 'title' | 'system'
  line?: string
  progress?: number | null
  confidence?: number
  phase?: string
  observedAt?: number
  eventType?: string
  rawSource?: string
  instanceId?: string
  sessionId?: string
  payload?: Record<string, unknown>
}

type RecordedInjectActionDetails = NonNullable<Extract<RecordingEvent, { kind: 'stdin' }>['injectAction']>

interface StdinInput {
  recordingId?: string | null
  sessionId?: string | null
  taskId?: string | null
  origin: 'user' | 'inject'
  injectActionId?: string | null
  injectAction?: RecordedInjectActionDetails | null
  text: string
}

interface ZipEntry {
  name: string
  data: Buffer
  mtime: Date
}

export class RecordingService {
  private readonly active = new Map<string, ActiveRecordingSession>()
  private readonly singleTaskMaxBytes: number
  private readonly totalMaxBytes: number

  constructor(private readonly options: RecordingServiceOptions) {
    this.singleTaskMaxBytes = options.singleTaskMaxBytes ?? SINGLE_TASK_MAX_BYTES
    this.totalMaxBytes = options.totalMaxBytes ?? TOTAL_MAX_BYTES
  }

  async start(input: RecordingStartRequest): Promise<RecordingManifest> {
    const startedAt = this.now()
    const enabledStreams = this.normalizeStreams(input.enabledStreams)
    const directory = join(this.recordingRoot(), input.sessionId, input.taskId)
    await mkdir(join(directory, 'screenshots'), { recursive: true })
    await mkdir(join(directory, '.archive'), { recursive: true })

    const manifest = recordingManifestSchema.parse({
      recordingId: randomUUID(),
      sessionId: input.sessionId,
      taskId: input.taskId,
      alias: input.alias,
      tool: input.tool,
      label: input.label ?? `${input.taskId} recording`,
      source: input.source ?? 'system',
      cwd: resolve(input.cwd),
      directory,
      manifestPath: join(directory, 'manifest.json'),
      enabledStreams,
      streams: enabledStreams.map(kind => ({ kind, path: this.eventFilePath(directory, kind), bytes: 0 })),
      screenshotIntervalMs: Math.max(SCREENSHOT_MIN_INTERVAL_MS, input.screenshotIntervalMs ?? 10000),
      startedAt,
      stoppedAt: null,
      status: 'recording',
      bytes: 0,
      rotated: false,
      rotationCount: 0,
      redactionApplied: false,
      lastAccessedAt: startedAt,
      errors: [],
      events: [{ type: 'recording:start', at: startedAt, payload: { confirmedBy: input.confirmedBy ?? null } }]
    })

    await this.ensureStreamFiles(manifest)
    await this.persistManifest(manifest)
    const active: ActiveRecordingSession = {
      manifest,
      watcher: null,
      screenshotTimer: null,
      screenshotQueue: null,
      fsHashes: new Map<string, string>(),
      artifactBytes: new Map<string, number>(),
      lastManifestPersistedAt: startedAt,
      streams: this.createStreams(manifest)
    }
    this.active.set(manifest.recordingId, active)

    if (enabledStreams.includes('fs')) await this.startFsWatcher(active)
    if (enabledStreams.includes('screenshot')) this.startScreenshotTimer(active)
    if (enabledStreams.includes('git-diff')) await this.appendGitDiffEvent(active, 'pre-task')
    await this.persistManifest(active.manifest)
    active.lastManifestPersistedAt = this.now()
    await this.enforceGlobalQuota()
    this.audit('recording:start', this.auditTarget(active.manifest, { confirmedBy: input.confirmedBy ?? null }))
    return active.manifest
  }

  async stop(recordingId: string): Promise<RecordingManifest> {
    const active = await this.resolveActive(recordingId)
    if (active.manifest.status !== 'recording') return active.manifest
    if (active.manifest.enabledStreams.includes('git-diff')) await this.appendGitDiffEvent(active, 'post-task')
    if (active.watcher) await active.watcher.close()
    if (active.screenshotTimer) clearInterval(active.screenshotTimer)
    if (active.screenshotQueue) {
      active.screenshotQueue.clear()
      await active.screenshotQueue.onIdle()
    }
    await this.flushStreamWrites(active)
    active.manifest = recordingManifestSchema.parse({
      ...active.manifest,
      status: 'stopped',
      stoppedAt: this.now(),
      lastAccessedAt: this.now(),
      bytes: await this.directoryBytes(active.manifest.directory),
      events: [...active.manifest.events, { type: 'recording:stop', at: this.now() }]
    })
    await this.closeStreamHandles(active)
    await this.persistManifest(active.manifest)
    this.active.delete(recordingId)
    this.audit('recording:stop', this.auditTarget(active.manifest))
    await this.enforceGlobalQuota()
    return active.manifest
  }

  async list(filter: { sessionId?: string; taskId?: string; sinceTs?: number } = {}): Promise<RecordingManifest[]> {
    const manifests = await this.readAllManifests()
    return manifests
      .filter(manifest => !filter.sessionId || manifest.sessionId === filter.sessionId)
      .filter(manifest => !filter.taskId || manifest.taskId === filter.taskId)
      .filter(manifest => !filter.sinceTs || manifest.startedAt >= filter.sinceTs)
      .sort((left, right) => right.startedAt - left.startedAt)
  }

  async getManifest(input: { recordingId?: string; sessionId?: string }): Promise<RecordingManifest | null> {
    const manifest = await this.findManifest(input)
    if (!manifest) return null
    const updated = recordingManifestSchema.parse({ ...manifest, lastAccessedAt: this.now() })
    await this.persistManifest(updated)
    return updated
  }

  async getEvents(input: RecordingGetEventsRequest): Promise<RecordingEvent[]> {
    const manifest = await this.requireManifest({ recordingId: input.recordingId })
    const files = await this.collectEventFiles(manifest, input.kind)
    const events: RecordingEvent[] = []
    for (const filePath of files) {
      if (!existsSync(filePath)) continue
      const text = await readFile(filePath, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue
        const parsed = recordingEventSchema.safeParse(JSON.parse(line))
        if (parsed.success && (!input.sinceTs || parsed.data.ts >= input.sinceTs)) events.push(parsed.data)
      }
    }
    const sorted = events.sort((left, right) => left.ts - right.ts)
    return typeof input.limit === 'number' ? sorted.slice(-input.limit) : sorted
  }


  async getReplayState(input: unknown): Promise<RecordingReplayState> {
    const request = recordingGetReplayStateRequestSchema.parse(input)
    const manifest = await this.requireManifest({ recordingId: request.recordingId })
    const events = await this.getEvents({ recordingId: request.recordingId })
    const bounds = this.replayBounds(manifest, events)
    const cursorTs = this.clampReplayTs(request.cursorTs ?? bounds.startedAtAbsTs, bounds.startedAtAbsTs, bounds.endedAtAbsTs)
    const enabledTracks = request.enabledTracks ?? manifest.enabledStreams
    const anchors = this.deriveAnchors(manifest, events)

    return recordingReplayStateSchema.parse({
      recordingId: manifest.recordingId,
      manifest,
      cursorTs,
      startedAtAbsTs: bounds.startedAtAbsTs,
      endedAtAbsTs: bounds.endedAtAbsTs,
      speed: request.speed ?? 1,
      paused: request.paused ?? true,
      enabledTracks,
      anchors
    })
  }

  async getEventsWindow(input: unknown): Promise<RecordingEvent[]> {
    const request = recordingGetEventsWindowRequestSchema.parse(input)
    const kinds = request.kinds ? new Set<RecordingStreamKind>(request.kinds) : null
    const events = await this.getEvents({ recordingId: request.recordingId })
    return events.filter(event => {
      const stream = this.kindToStream(event.kind)
      return event.ts >= request.sinceTs && event.ts <= request.untilTs && (!kinds || kinds.has(stream))
    })
  }

  async getCast(input: unknown): Promise<{ cast: AsciinemaCast }> {
    const request = recordingGetCastRequestSchema.parse(input)
    const manifest = await this.requireManifest({ recordingId: request.recordingId })
    const events = await this.getEvents({ recordingId: request.recordingId, kind: 'stdout' })
    return { cast: buildAsciinemaCast(manifest, events) }
  }

  async listAnchors(input: unknown): Promise<{ anchors: RecordingReplayAnchor[] }> {
    const request = recordingListAnchorsRequestSchema.parse(input)
    const manifest = await this.requireManifest({ recordingId: request.recordingId })
    const events = await this.getEvents({ recordingId: request.recordingId })
    return recordingListAnchorsResultSchema.parse({ anchors: this.deriveAnchors(manifest, events) })
  }

  async getScreenshot(input: unknown): Promise<RecordingScreenshotResult> {
    const request = recordingGetScreenshotRequestSchema.parse(input)
    await this.requireManifest({ recordingId: request.recordingId })
    const screenshots = (await this.getEvents({ recordingId: request.recordingId, kind: 'screenshot' }))
      .filter((event): event is Extract<RecordingEvent, { kind: 'screenshot' }> => event.kind === 'screenshot')
      .sort((left, right) => Math.abs(left.ts - request.ts) - Math.abs(right.ts - request.ts))
    const selected = screenshots[0]
    if (!selected || !existsSync(selected.filePath)) throw new Error('E_NOT_FOUND:screenshot')
    const dimensions = await this.readPngDimensions(selected.filePath)
    return recordingScreenshotResultSchema.parse({
      filePath: selected.filePath,
      width: dimensions.width,
      height: dimensions.height,
      eventTs: selected.ts,
      sizeBytes: selected.sizeBytes
    })
  }

  async getFsSnapshotAt(input: unknown): Promise<RecordingFsSnapshotResult> {
    const request = recordingGetFsSnapshotAtRequestSchema.parse(input)
    await this.requireManifest({ recordingId: request.recordingId })
    const fsEvents = (await this.getEvents({ recordingId: request.recordingId, kind: 'fs' }))
      .filter((event): event is FsEvent => event.kind === 'fs')
      .filter(event => event.ts <= request.ts)
      .sort((left, right) => left.ts - right.ts)
    const tree = new Map<string, RecordingFsSnapshotResult['tree'][number]>()
    for (const event of fsEvents) {
      tree.set(event.path, {
        path: event.path,
        op: event.op,
        sizeBytes: event.sizeBytes,
        sha256After: event.sha256After,
        lastTs: event.ts
      })
    }
    return recordingFsSnapshotResultSchema.parse({
      recordingId: request.recordingId,
      cursorTs: request.ts,
      tree: Array.from(tree.values()).sort((left, right) => left.path.localeCompare(right.path))
    })
  }

  async recordStdout(input: CliStdoutInput): Promise<RecordingEvent[]> {
    const targets = this.matchingActiveSessions(
      input.sessionId ?? this.stringPayload(input.payload, 'claudeSessionId'),
      this.stringPayload(input.payload, 'taskId'),
      'stdout'
    )
    const recorded: RecordingEvent[] = []
    for (const active of targets) {
      const event = stdoutEventSchema.parse({
        ts: input.observedAt ?? this.now(),
        kind: 'stdout',
        stream: input.stream ?? 'stdout',
        rawSource: this.asStdoutRawSource(input.rawSource),
        type: input.eventType ?? input.phase ?? 'unknown',
        payload: {
          tool: input.tool ?? active.manifest.tool ?? 'unknown',
          line: input.line ?? '',
          progress: input.progress ?? null,
          confidence: input.confidence ?? null,
          phase: input.phase ?? 'unknown',
          instanceId: input.instanceId ?? null,
          sessionId: input.sessionId ?? null,
          ...(input.payload ?? {})
        }
      })
      await this.appendEvent(active, event)
      recorded.push(event)
    }
    return recorded
  }

  async recordStdin(input: StdinInput): Promise<RecordingEvent[]> {
    const targets = input.recordingId
      ? [await this.resolveActive(input.recordingId)]
      : this.matchingActiveSessions(input.sessionId ?? null, input.taskId ?? null, 'stdin')
    const recorded: RecordingEvent[] = []
    for (const active of targets) {
      const injectAction = input.origin === 'inject' && input.injectActionId
        ? {
            actionId: input.injectAction?.actionId ?? input.injectActionId,
            mode: input.injectAction?.mode,
            scenario: input.injectAction?.scenario,
            targetAlias: input.injectAction?.targetAlias
          }
        : undefined
      const event = stdinEventSchema.parse({
        ts: this.now(),
        kind: 'stdin',
        origin: input.origin,
        injectActionId: input.injectActionId ?? null,
        injectAction,
        text: input.text
      })
      await this.appendEvent(active, event)
      recorded.push(event)
    }
    return recorded
  }

  async exportAsciinema(recordingId: string, outPath: string): Promise<{ filePath: string }> {
    await mkdir(dirname(outPath), { recursive: true })
    const { cast } = await this.getCast({ recordingId })
    await writeFile(outPath, serializeAsciinemaCast(cast), 'utf8')
    return { filePath: outPath }
  }

  async exportZip(recordingId: string, outPath: string, opts: { redact: boolean }): Promise<{ filePath: string }> {
    if (existsSync(outPath)) throw new Error('E_VALIDATION:zip file already exists')
    const manifest = await this.requireManifest({ recordingId })
    await mkdir(dirname(outPath), { recursive: true })
    const entries = await this.collectZipEntries(manifest, opts.redact, outPath)
    await writeFile(outPath, this.createZip(entries))
    this.audit(opts.redact ? 'recording:redacted-export' : 'recording:export-zip', this.auditTarget(manifest, { outPath, redact: opts.redact }))
    return { filePath: outPath }
  }

  async delete(recordingId: string): Promise<{ deleted: boolean }> {
    const manifest = await this.findManifest({ recordingId })
    if (!manifest) return { deleted: false }
    const active = this.active.get(recordingId)
    if (active) await this.flushStreamWrites(active)
    if (active?.screenshotQueue) {
      active.screenshotQueue.clear()
      await active.screenshotQueue.onIdle()
    }
    if (active) await this.closeStreamHandles(active)
    if (active?.watcher) await active.watcher.close()
    if (active?.screenshotTimer) clearInterval(active.screenshotTimer)
    this.active.delete(recordingId)
    await rm(manifest.directory, { recursive: true, force: true })
    return { deleted: true }
  }


  private replayBounds(manifest: RecordingManifest, events: readonly RecordingEvent[]): { startedAtAbsTs: number; endedAtAbsTs: number } {
    const eventEnd = events.reduce((latest, event) => Math.max(latest, event.ts), manifest.startedAt)
    const activeEnd = manifest.status === 'recording' ? this.now() : manifest.startedAt
    return {
      startedAtAbsTs: manifest.startedAt,
      endedAtAbsTs: Math.max(manifest.startedAt, manifest.stoppedAt ?? eventEnd, eventEnd, activeEnd)
    }
  }

  private clampReplayTs(ts: number, startedAtAbsTs: number, endedAtAbsTs: number): number {
    return Math.min(Math.max(Math.trunc(ts), startedAtAbsTs), Math.max(startedAtAbsTs, endedAtAbsTs))
  }

  private deriveAnchors(manifest: RecordingManifest, events: readonly RecordingEvent[]): RecordingReplayAnchor[] {
    const anchors: RecordingReplayAnchor[] = []
    for (const error of manifest.errors) {
      anchors.push({ ts: error.at, kind: 'error', label: error.code, color: 'danger' })
    }
    for (const event of manifest.events) {
      if (event.type.includes('rotate') || event.type.includes('quota')) anchors.push({ ts: event.at, kind: 'rotate', label: event.type, color: 'warning' })
      if (event.type.includes('stop')) anchors.push({ ts: event.at, kind: 'state-flip', label: event.type, color: 'accent' })
    }
    const fsBuckets = new Map<number, number>()
    for (const event of events) {
      if (event.kind === 'stdout' && this.isStdoutError(event)) anchors.push({ ts: event.ts, kind: 'error', label: this.stdoutAnchorLabel(event), color: 'danger' })
      if (event.kind === 'stdin' && event.origin === 'inject') anchors.push({ ts: event.ts, kind: 'inject', label: event.injectActionId ? `inject:${event.injectActionId.slice(0, 8)}` : 'inject', color: 'accent' })
      if (event.kind === 'fs') {
        const bucket = Math.floor(event.ts / 1000) * 1000
        fsBuckets.set(bucket, (fsBuckets.get(bucket) ?? 0) + 1)
      }
      if (event.kind === 'stdout' && String(event.payload.phase ?? '').toLowerCase().includes('state')) {
        anchors.push({ ts: event.ts, kind: 'state-flip', label: String(event.payload.phase), color: 'accent' })
      }
    }
    for (const [ts, count] of fsBuckets) {
      if (count >= 3) anchors.push({ ts, kind: 'fs-burst', label: `${count} fs events`, color: 'warning' })
    }
    return this.uniqueAnchors(anchors).sort((left, right) => left.ts - right.ts)
  }

  private isStdoutError(event: Extract<RecordingEvent, { kind: 'stdout' }>): boolean {
    const type = event.type.toLowerCase()
    const phase = String(event.payload.phase ?? '').toLowerCase()
    const line = String(event.payload.line ?? event.payload.message ?? '').toLowerCase()
    return type.includes('error') || phase.includes('error') || /\b(error|failed|exception|panic)\b/.test(line)
  }

  private stdoutAnchorLabel(event: Extract<RecordingEvent, { kind: 'stdout' }>): string {
    const line = String(event.payload.line ?? event.type).trim()
    return line.length > 80 ? `${line.slice(0, 77)}...` : line || event.type
  }

  private uniqueAnchors(anchors: readonly RecordingReplayAnchor[]): RecordingReplayAnchor[] {
    const byKey = new Map<string, RecordingReplayAnchor>()
    for (const anchor of anchors) byKey.set(`${anchor.kind}:${anchor.ts}:${anchor.label}`, anchor)
    return Array.from(byKey.values())
  }

  private async readPngDimensions(filePath: string): Promise<{ width: number; height: number }> {
    const buffer = await readFile(filePath)
    const signature = buffer.subarray(0, 8).toString('hex')
    if (signature !== '89504e470d0a1a0a' || buffer.byteLength < 24) throw new Error('E_INTEGRITY_FAIL:screenshot png')
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  private async startFsWatcher(active: ActiveRecordingSession): Promise<void> {
    try {
      const chokidar = await import('chokidar')
      active.watcher = chokidar.watch('.', {
        cwd: active.manifest.cwd,
        ignoreInitial: true,
        ignored: ['**/node_modules/**', '**/.git/**', '**/.devhub-recordings/**', '**/recordings/**'],
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 },
        ignorePermissionErrors: true
      })
      active.watcher.on('all', (eventName, eventPath, statsValue) => {
        void this.handleFsEvent(active.manifest.recordingId, String(eventName), String(eventPath), statsValue?.size ?? null)
      })
      active.watcher.on('error', error => {
        void this.addManifestError(active, 'E_RUNTIME', error instanceof Error ? error.message : String(error))
      })
    } catch (error) {
      await this.addManifestError(active, 'E_RUNTIME', error instanceof Error ? error.message : String(error))
    }
  }

  private startScreenshotTimer(active: ActiveRecordingSession): void {
    active.screenshotQueue = new PQueue({
      concurrency: 1,
      intervalCap: 1,
      interval: active.manifest.screenshotIntervalMs,
      carryoverConcurrencyCount: true
    })
    active.screenshotTimer = setInterval(() => {
      const queue = active.screenshotQueue
      if (!queue) return
      void queue.add(() => this.captureScreenshot(active.manifest.recordingId))
        .catch(error => this.addManifestError(active, 'E_RUNTIME', error instanceof Error ? error.message : String(error)))
    }, active.manifest.screenshotIntervalMs)
  }

  private async captureScreenshot(recordingId: string): Promise<void> {
    const active = this.active.get(recordingId)
    if (!active || active.manifest.status !== 'recording') return
    try {
      const window = this.options.getMainWindow?.()
      if (!window || typeof window.capturePage !== 'function') {
        await this.addManifestError(active, 'E_PERMISSION_DENIED', 'No capturable Electron BrowserWindow is available')
        return
      }
      const image = await window.capturePage()
      const png = image.toPNG()
      const filePath = join(active.manifest.directory, 'screenshots', `${new Date(this.now()).toISOString().replace(/[:.]/g, '-')}.png`)
      await writeFile(filePath, png)
      const event = screenshotEventSchema.parse({
        ts: this.now(),
        kind: 'screenshot',
        filePath,
        hwnd: null,
        region: 'window',
        sizeBytes: png.byteLength
      })
      await this.appendEvent(active, event)
    } catch (error) {
      await this.addManifestError(active, 'E_PERMISSION_DENIED', error instanceof Error ? error.message : String(error))
    }
  }

  private async handleFsEvent(recordingId: string, eventName: string, eventPath: string, statSize: number | null): Promise<void> {
    const active = this.active.get(recordingId)
    if (!active || active.manifest.status !== 'recording') return
    const op = this.toFsOp(eventName)
    if (!op) return
    const absolutePath = resolve(active.manifest.cwd, eventPath)
    const shaBefore = active.fsHashes.get(eventPath) ?? null
    const after = op === 'unlink' || op === 'unlinkDir' ? { sha: null, size: null } : await this.hashFileIfReadable(absolutePath, statSize)
    if (after.sha) active.fsHashes.set(eventPath, after.sha)
    if (op === 'unlink' || op === 'unlinkDir') active.fsHashes.delete(eventPath)
    const event = fsEventSchema.parse({
      ts: this.now(),
      kind: 'fs',
      op,
      path: eventPath,
      sha256Before: op === 'change' || op === 'unlink' ? shaBefore : null,
      sha256After: after.sha,
      sizeBytes: after.size
    })
    await this.appendEvent(active, event)
  }

  private async appendGitDiffEvent(active: ActiveRecordingSession, phase: 'pre-task' | 'post-task'): Promise<void> {
    try {
      const git = this.gitClient(active.manifest.cwd)
      const [branchSummary, headShaRaw, diffStatRaw, diffRaw] = await Promise.all([
        git.branchLocal(),
        git.revparse(['HEAD']),
        git.diff(['--stat']),
        git.diff()
      ])
      const branch = branchSummary.current || 'HEAD'
      const headSha = headShaRaw.trim()
      const diffStat = diffStatRaw.trim() || 'clean'
      const diffPath = join(active.manifest.directory, 'git-diff.txt')
      const section = [`# ${phase} ${new Date(this.now()).toISOString()}`, `branch: ${branch}`, `head: ${headSha}`, '', diffStat, '', diffRaw].join('\n')
      await appendFile(diffPath, `${section}\n\n`, 'utf8')
      const event = gitDiffEventSchema.parse({
        ts: this.now(),
        kind: 'git-diff',
        phase,
        branch,
        headSha,
        diffStat,
        diffPath
      })
      await this.appendEvent(active, event)
    } catch (error) {
      await this.addManifestError(active, 'E_NOT_FOUND', error instanceof Error ? error.message : String(error))
    }
  }

  private async appendEvent(active: ActiveRecordingSession, event: RecordingEvent): Promise<void> {
    const streamKind = this.kindToStream(event.kind)
    const filePath = this.eventFilePath(active.manifest.directory, streamKind)
    const line = `${JSON.stringify(event)}\n`
    this.streamFor(active, streamKind, filePath).append(event)
    const bytes = active.manifest.bytes + Buffer.byteLength(line, 'utf8') + await this.externalArtifactDelta(active, event)
    active.manifest.bytes = bytes
    active.manifest.lastAccessedAt = this.now()
    const rotated = await this.maybeRotate(active)
    if (rotated || this.shouldFlushManifest(active)) {
      await this.flushStreamWrites(active)
      await this.persistManifest(active.manifest)
      active.lastManifestPersistedAt = this.now()
    }
    if (rotated) this.audit('recording:rotate', this.auditTarget(active.manifest, { singleTaskMaxBytes: this.singleTaskMaxBytes }))
    this.options.emitEvent?.({ ...event, recordingId: active.manifest.recordingId })
  }

  private shouldFlushManifest(active: ActiveRecordingSession): boolean {
    return this.now() - active.lastManifestPersistedAt >= MANIFEST_HOT_FLUSH_INTERVAL_MS
  }

  private async closeStreamHandles(active: ActiveRecordingSession): Promise<void> {
    await Promise.all([...active.streams.values()].map(async stream => {
      try {
        await stream.close()
      } catch (error) {
        this.audit('recording:stream-close', this.auditTarget(active.manifest, { error: error instanceof Error ? error.message : String(error) }), 'error', 'E_RUNTIME')
      }
    }))
    active.streams.clear()
  }

  private async flushStreamWrites(active: ActiveRecordingSession): Promise<void> {
    await Promise.all([...active.streams.values()].map(stream => stream.flush()))
  }

  private async externalArtifactDelta(active: ActiveRecordingSession, event: RecordingEvent): Promise<number> {
    const path = this.eventArtifactPath(event)
    if (!path) return 0
    const currentBytes = await this.fileBytes(path)
    const previousBytes = active.artifactBytes.get(path) ?? 0
    active.artifactBytes.set(path, currentBytes)
    return Math.max(0, currentBytes - previousBytes)
  }

  private eventArtifactPath(event: RecordingEvent): string | null {
    if (event.kind === 'screenshot') return event.filePath
    if (event.kind === 'git-diff') return event.diffPath
    return null
  }

  private async maybeRotate(active: ActiveRecordingSession): Promise<boolean> {
    if (active.manifest.bytes <= this.singleTaskMaxBytes) return false
    await this.flushStreamWrites(active)
    await this.closeStreamHandles(active)
    const archiveDir = join(active.manifest.directory, '.archive', String(this.now()))
    await mkdir(archiveDir, { recursive: true })
    for (const kind of DEFAULT_STREAMS) {
      const current = this.eventFilePath(active.manifest.directory, kind)
      if (existsSync(current)) await rename(current, join(archiveDir, STREAM_EVENT_FILES[kind]))
    }
    const screenshotDir = join(active.manifest.directory, 'screenshots')
    if (existsSync(screenshotDir)) await rename(screenshotDir, join(archiveDir, 'screenshots'))
    await mkdir(screenshotDir, { recursive: true })
    await this.ensureStreamFiles(active.manifest)
    active.streams = this.createStreams(active.manifest)
    active.manifest = recordingManifestSchema.parse({
      ...active.manifest,
      rotated: true,
      rotationCount: active.manifest.rotationCount + 1,
      bytes: await this.directoryBytes(active.manifest.directory),
      errors: [...active.manifest.errors, { code: 'E_QUOTA_EXCEEDED', message: 'Recording stream rotated after exceeding the per-task quota', at: this.now() }]
    })
    return true
  }

  private async enforceGlobalQuota(): Promise<void> {
    const manifests = await this.readAllManifests()
    let totalBytes = 0
    for (const manifest of manifests) totalBytes += await this.directoryBytes(manifest.directory)
    if (totalBytes <= this.totalMaxBytes) return
    const evictable = manifests
      .filter(manifest => !this.active.has(manifest.recordingId))
      .sort((left, right) => left.lastAccessedAt - right.lastAccessedAt)
    for (const manifest of evictable) {
      if (totalBytes <= this.totalMaxBytes) break
      const bytes = await this.directoryBytes(manifest.directory)
      await rm(manifest.directory, { recursive: true, force: true })
      totalBytes -= bytes
      this.audit('recording:lru-evict', this.auditTarget(manifest, { evictedBytes: bytes, totalMaxBytes: this.totalMaxBytes }))
    }
  }

  private async collectZipEntries(manifest: RecordingManifest, redact: boolean, outPath: string): Promise<ZipEntry[]> {
    const files = await this.collectFiles(manifest.directory)
    const entries: ZipEntry[] = []
    for (const filePath of files) {
      if (resolve(filePath) === resolve(outPath)) continue
      const relativePath = this.toPortablePath(relative(manifest.directory, filePath))
      const fileStat = await stat(filePath)
      const raw = await readFile(filePath)
      const isText = /\.(json|ndjson|txt|cast|md|log)$/i.test(filePath)
      let data = raw
      if (redact && isText) {
        if (relativePath === 'manifest.json') {
          const parsedManifest = JSON.parse(raw.toString('utf8')) as RecordingManifest
          data = Buffer.from(JSON.stringify({ ...parsedManifest, redactionApplied: true }, null, 2), 'utf8')
        } else {
          data = Buffer.from(this.redact(raw.toString('utf8')), 'utf8')
        }
      }
      entries.push({ name: relativePath, data, mtime: fileStat.mtime })
    }
    return entries
  }

  private createZip(entries: ZipEntry[]): Buffer {
    const localParts: Buffer[] = []
    const centralParts: Buffer[] = []
    let offset = 0
    for (const entry of entries) {
      const name = Buffer.from(entry.name, 'utf8')
      const crc = crc32(entry.data)
      const { dosTime, dosDate } = toDosDateTime(entry.mtime)
      const localHeader = Buffer.alloc(30)
      localHeader.writeUInt32LE(0x04034b50, 0)
      localHeader.writeUInt16LE(20, 4)
      localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6)
      localHeader.writeUInt16LE(0, 8)
      localHeader.writeUInt16LE(dosTime, 10)
      localHeader.writeUInt16LE(dosDate, 12)
      localHeader.writeUInt32LE(crc, 14)
      localHeader.writeUInt32LE(entry.data.byteLength, 18)
      localHeader.writeUInt32LE(entry.data.byteLength, 22)
      localHeader.writeUInt16LE(name.byteLength, 26)
      localHeader.writeUInt16LE(0, 28)
      localParts.push(localHeader, name, entry.data)

      const centralHeader = Buffer.alloc(46)
      centralHeader.writeUInt32LE(0x02014b50, 0)
      centralHeader.writeUInt16LE(20, 4)
      centralHeader.writeUInt16LE(20, 6)
      centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8)
      centralHeader.writeUInt16LE(0, 10)
      centralHeader.writeUInt16LE(dosTime, 12)
      centralHeader.writeUInt16LE(dosDate, 14)
      centralHeader.writeUInt32LE(crc, 16)
      centralHeader.writeUInt32LE(entry.data.byteLength, 20)
      centralHeader.writeUInt32LE(entry.data.byteLength, 24)
      centralHeader.writeUInt16LE(name.byteLength, 28)
      centralHeader.writeUInt16LE(0, 30)
      centralHeader.writeUInt16LE(0, 32)
      centralHeader.writeUInt16LE(0, 34)
      centralHeader.writeUInt16LE(0, 36)
      centralHeader.writeUInt32LE(0, 38)
      centralHeader.writeUInt32LE(offset, 42)
      centralParts.push(centralHeader, name)
      offset += localHeader.byteLength + name.byteLength + entry.data.byteLength
    }
    const centralSize = centralParts.reduce((sum, part) => sum + part.byteLength, 0)
    const end = Buffer.alloc(22)
    end.writeUInt32LE(0x06054b50, 0)
    end.writeUInt16LE(0, 4)
    end.writeUInt16LE(0, 6)
    end.writeUInt16LE(entries.length, 8)
    end.writeUInt16LE(entries.length, 10)
    end.writeUInt32LE(centralSize, 12)
    end.writeUInt32LE(offset, 16)
    end.writeUInt16LE(0, 20)
    return Buffer.concat([...localParts, ...centralParts, end])
  }

  private async ensureStreamFiles(manifest: RecordingManifest): Promise<void> {
    for (const kind of manifest.enabledStreams) {
      const filePath = this.eventFilePath(manifest.directory, kind)
      await mkdir(dirname(filePath), { recursive: true })
      if (!existsSync(filePath)) await writeFile(filePath, '', 'utf8')
    }
    const gitDiffPath = join(manifest.directory, 'git-diff.txt')
    if (manifest.enabledStreams.includes('git-diff') && !existsSync(gitDiffPath)) await writeFile(gitDiffPath, '', 'utf8')
  }

  private createStreams(manifest: RecordingManifest): Map<RecordingStreamKind, RecordingEventStream> {
    return new Map(manifest.enabledStreams.map(kind => [kind, this.createStream(kind, this.eventFilePath(manifest.directory, kind))]))
  }

  private streamFor(active: ActiveRecordingSession, kind: RecordingStreamKind, filePath: string): RecordingEventStream {
    const existing = active.streams.get(kind)
    if (existing) return existing
    const stream = this.createStream(kind, filePath)
    active.streams.set(kind, stream)
    return stream
  }

  private createStream(kind: RecordingStreamKind, filePath: string): RecordingEventStream {
    switch (kind) {
      case 'stdout':
        return new StdoutStream(filePath)
      case 'stdin':
        return new StdinStream(filePath)
      case 'screenshot':
        return new ScreenshotStream(filePath)
      case 'fs':
        return new FsStream(filePath)
      case 'git-diff':
        return new GitDiffStream(filePath)
    }
  }

  private async resolveActive(recordingId: string): Promise<ActiveRecordingSession> {
    const active = this.active.get(recordingId)
    if (active) return active
    const manifest = await this.requireManifest({ recordingId })
    const restored: ActiveRecordingSession = {
      manifest,
      watcher: null,
      screenshotTimer: null,
      screenshotQueue: null,
      fsHashes: new Map<string, string>(),
      artifactBytes: new Map<string, number>(),
      lastManifestPersistedAt: this.now(),
      streams: this.createStreams(manifest)
    }
    this.active.set(recordingId, restored)
    return restored
  }

  private matchingActiveSessions(sessionId: string | null, taskId: string | null, kind: RecordingStreamKind): ActiveRecordingSession[] {
    const sessions = Array.from(this.active.values()).filter(active => active.manifest.status === 'recording' && active.manifest.enabledStreams.includes(kind))
    const matched = sessions.filter(active => (
      (sessionId && active.manifest.sessionId === sessionId) || (taskId && active.manifest.taskId === taskId)
    ))
    if (matched.length > 0) return matched
    return sessionId || taskId ? [] : sessions.length === 1 ? sessions : []
  }

  private async findManifest(input: { recordingId?: string; sessionId?: string }): Promise<RecordingManifest | null> {
    if (input.recordingId && this.active.has(input.recordingId)) return this.active.get(input.recordingId)?.manifest ?? null
    const manifests = await this.readAllManifests()
    return manifests.find(manifest => (
      (input.recordingId && manifest.recordingId === input.recordingId) || (input.sessionId && manifest.sessionId === input.sessionId)
    )) ?? null
  }

  private async requireManifest(input: { recordingId?: string; sessionId?: string }): Promise<RecordingManifest> {
    const manifest = await this.findManifest(input)
    if (!manifest) throw new Error('E_NOT_FOUND:recording')
    return manifest
  }

  private async readAllManifests(): Promise<RecordingManifest[]> {
    const root = this.recordingRoot()
    if (!existsSync(root)) return []
    const manifests: RecordingManifest[] = []
    for (const sessionEntry of await readdir(root, { withFileTypes: true })) {
      if (!sessionEntry.isDirectory()) continue
      const sessionDir = join(root, sessionEntry.name)
      for (const taskEntry of await readdir(sessionDir, { withFileTypes: true })) {
        if (!taskEntry.isDirectory()) continue
        const manifestPath = join(sessionDir, taskEntry.name, 'manifest.json')
        if (!existsSync(manifestPath)) continue
        let rawManifest: unknown
        try {
          rawManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
        } catch {
          continue
        }
        const parsed = recordingManifestSchema.safeParse(rawManifest)
        if (parsed.success) manifests.push(parsed.data)
      }
    }
    return manifests
  }

  private async persistManifest(manifest: RecordingManifest): Promise<void> {
    await mkdir(dirname(manifest.manifestPath), { recursive: true })
    await writeFile(manifest.manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
  }

  private async addManifestError(active: ActiveRecordingSession, code: string, message: string): Promise<void> {
    active.manifest = recordingManifestSchema.parse({
      ...active.manifest,
      errors: [...active.manifest.errors, { code, message, at: this.now() }],
      lastAccessedAt: this.now()
    })
    await this.persistManifest(active.manifest)
  }

  private async collectEventFiles(manifest: RecordingManifest, kind?: RecordingStreamKind): Promise<string[]> {
    const names = kind ? [STREAM_EVENT_FILES[kind]] : Object.values(STREAM_EVENT_FILES)
    const files = await this.collectFiles(manifest.directory)
    return files.filter(filePath => names.includes(filePath.split(/[\\/]/).at(-1) ?? ''))
  }

  private async collectFiles(directory: string): Promise<string[]> {
    if (!existsSync(directory)) return []
    const output: string[] = []
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) output.push(...await this.collectFiles(entryPath))
      else if (entry.isFile()) output.push(entryPath)
    }
    return output
  }

  private eventFilePath(directory: string, kind: RecordingStreamKind): string {
    return join(directory, STREAM_EVENT_FILES[kind])
  }

  private kindToStream(kind: RecordingEvent['kind']): RecordingStreamKind {
    if (kind === 'git-diff') return 'git-diff'
    if (kind === 'fs') return 'fs'
    return kind
  }

  private normalizeStreams(input: RecordingStreamKind[] | undefined): RecordingStreamKind[] {
    const allowed = new Set(recordingStreamKindSchema.options)
    const streams = (input && input.length > 0 ? input : DEFAULT_STREAMS).filter(kind => allowed.has(kind))
    return Array.from(new Set(streams.length > 0 ? streams : DEFAULT_STREAMS))
  }

  private async hashFileIfReadable(filePath: string, statSize: number | null): Promise<{ sha: string | null; size: number | null }> {
    try {
      const fileStat = await stat(filePath)
      if (!fileStat.isFile()) return { sha: null, size: null }
      const data = await readFile(filePath)
      return { sha: createHash('sha256').update(data).digest('hex'), size: statSize ?? data.byteLength }
    } catch {
      return { sha: null, size: null }
    }
  }

  private toFsOp(eventName: string): FsEvent['op'] | null {
    if (eventName === 'add') return 'add'
    if (eventName === 'change') return 'change'
    if (eventName === 'unlink') return 'unlink'
    if (eventName === 'addDir') return 'addDir'
    if (eventName === 'unlinkDir') return 'unlinkDir'
    return null
  }

  private gitClient(cwd: string): SimpleGit {
    return simpleGit({ baseDir: cwd, binary: 'git', maxConcurrentProcesses: 4, trimmed: false })
  }

  private async directoryBytes(directory: string): Promise<number> {
    const files = await this.collectFiles(directory)
    let total = 0
    for (const filePath of files) total += (await stat(filePath)).size
    return total
  }

  private async fileBytes(path: string): Promise<number> {
    try {
      return (await stat(path)).size
    } catch {
      return 0
    }
  }

  private recordingRoot(): string {
    return join(this.options.userDataRoot(), 'recordings')
  }

  private audit(action: string, target: Record<string, unknown>, result: RecordingAuditResult = 'success', reason?: string): void {
    try {
      this.options.audit?.(action, target, result, reason)
    } catch (error) {
      console.warn('Recording audit sink failed:', error instanceof Error ? error.message : String(error))
    }
  }

  private auditTarget(manifest: RecordingManifest, extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      recordingId: manifest.recordingId,
      sessionId: manifest.sessionId,
      taskId: manifest.taskId,
      tool: manifest.tool,
      source: manifest.source,
      status: manifest.status,
      enabledStreams: manifest.enabledStreams,
      directory: manifest.directory,
      bytes: manifest.bytes,
      rotationCount: manifest.rotationCount,
      redactionApplied: manifest.redactionApplied,
      ...extra
    }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now()
  }

  private asStdoutRawSource(value: unknown): 'ndjson' | 'shim' | 'line' | 'sse' | 'heuristic' | 'window-title' {
    return value === 'ndjson' || value === 'shim' || value === 'line' || value === 'sse' || value === 'heuristic' || value === 'window-title' ? value : 'line'
  }

  private stringPayload(payload: Record<string, unknown> | undefined, key: string): string | null {
    const value = payload?.[key]
    return typeof value === 'string' ? value : null
  }

  private redact(text: string): string {
    return text
      .replace(/(OPENAI_API_KEY\s*=\s*)[^\s"'`]+/gi, '$1***')
      .replace(/(ANTHROPIC_API_KEY\s*=\s*)[^\s"'`]+/gi, '$1***')
      .replace(/(password\s*[:=]\s*)[^\s"'`]+/gi, '$1***')
      .replace(/(token\s*[:=]\s*)[^\s"'`]+/gi, '$1***')
      .replace(/\b(sk-[A-Za-z0-9_-]{16,})\b/g, '***')
  }

  private toPortablePath(value: string): string {
    return value.split('\\').join('/')
  }
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
  return value >>> 0
})

function toDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { dosTime, dosDate }
}
