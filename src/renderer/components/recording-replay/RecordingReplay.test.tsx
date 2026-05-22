import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RecordingReplayPanel } from './RecordingReplayPanel'
import type { RecordingEvent, RecordingManifest, RecordingReplayState } from '@shared/schemas/r8-runtime'

const recordingId = '11111111-1111-4111-8111-111111111111'
const startedAt = 1_900_000
const endedAt = startedAt + 60_000

const manifest: RecordingManifest = {
  recordingId,
  sessionId: '22222222-2222-4222-8222-222222222222',
  taskId: 'task-replay-ui',
  label: 'Replay UI Recording',
  source: 'system',
  cwd: 'D:/repo',
  directory: 'D:/userData/recordings/session/task',
  manifestPath: 'D:/userData/recordings/session/task/manifest.json',
  enabledStreams: ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'],
  streams: [],
  screenshotIntervalMs: 10000,
  startedAt,
  stoppedAt: endedAt,
  status: 'stopped',
  bytes: 1024,
  rotated: false,
  rotationCount: 0,
  redactionApplied: false,
  lastAccessedAt: endedAt,
  errors: [],
  events: []
}

const replayState: RecordingReplayState = {
  recordingId,
  manifest,
  cursorTs: endedAt,
  startedAtAbsTs: startedAt,
  endedAtAbsTs: endedAt,
  speed: 1,
  paused: true,
  enabledTracks: ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'],
  anchors: [{ ts: startedAt + 45_000, kind: 'error', label: 'Error: failed', color: 'danger' }]
}

const events: RecordingEvent[] = [
  { ts: startedAt + 1000, kind: 'stdout', stream: 'stdout', rawSource: 'line', type: 'error', payload: { line: 'Error: failed' } },
  {
    ts: startedAt + 2000,
    kind: 'stdin',
    origin: 'inject',
    injectActionId: '33333333-3333-4333-8333-333333333333',
    injectAction: {
      actionId: '33333333-3333-4333-8333-333333333333',
      mode: 'sendinput',
      scenario: 'manual-template',
      targetAlias: 'codex-main'
    },
    text: 'continue'
  },
  { ts: startedAt + 3000, kind: 'screenshot', filePath: 'D:/shots/one.png', hwnd: null, region: 'window', sizeBytes: 67 },
  { ts: startedAt + 4000, kind: 'fs', op: 'add', path: 'a.txt', sha256Before: null, sha256After: 'a'.repeat(64), sizeBytes: 3 },
  { ts: startedAt + 5000, kind: 'git-diff', phase: 'post-task', branch: 'main', headSha: 'b'.repeat(40), diffStat: '1 file changed', diffPath: 'D:/recording/git-diff.txt' }
]

const api = {
  list: vi.fn(async () => [manifest]),
  getReplayState: vi.fn(async () => replayState),
  getEventsWindow: vi.fn(async () => events),
  getCast: vi.fn(async () => ({ cast: { version: 2 as const, width: 120, height: 40, timestamp: 1900, events: [[1, 'o' as const, 'Error: failed']] } })),
  getFsSnapshotAt: vi.fn(async () => ({ recordingId, cursorTs: startedAt, tree: [{ path: 'a.txt', op: 'add' as const, sizeBytes: 3, sha256After: 'a'.repeat(64), lastTs: startedAt + 4000 }] })),
  getScreenshot: vi.fn(async () => ({ filePath: 'D:/shots/one.png', width: 1, height: 1, eventTs: startedAt + 3000, sizeBytes: 67 }))
}

describe('RecordingReplayPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { recording: api } }
    })
  })

  it('loads real recording manifests through preload and syncs all replay tracks from one cursor', async () => {
    render(<RecordingReplayPanel />)

    expect(await screen.findByText('Replay UI Recording')).toBeInTheDocument()
    expect((await screen.findAllByText('Error: failed')).length).toBeGreaterThanOrEqual(1)
    expect(await screen.findByText('continue')).toBeInTheDocument()
    expect(await screen.findByText('codex-main · sendinput · manual-template')).toBeInTheDocument()
    expect(await screen.findByText('a.txt')).toBeInTheDocument()
    expect(await screen.findByText('1 file changed')).toBeInTheDocument()
    expect(screen.getByTestId('asciinema-player')).toHaveTextContent('Error: failed')
    expect(screen.getByTestId('asciinema-player').querySelector('.xterm')).not.toBeNull()

    fireEvent.click(screen.getByLabelText('track screenshot'))
    expect(screen.queryByTestId('screenshot-track')).not.toBeInTheDocument()
    await waitFor(() => expect(api.getReplayState).toHaveBeenLastCalledWith(expect.objectContaining({ enabledTracks: ['stdout', 'stdin', 'fs', 'git-diff'] })))

    fireEvent.change(screen.getByTestId('timeline-cursor'), { target: { value: String(startedAt + 30_000) } })
    await waitFor(() => expect(screen.getByTestId('stdout-cursor-ts')).toHaveTextContent(String(startedAt + 30_000)))
    await waitFor(() => expect(api.getFsSnapshotAt).toHaveBeenCalledWith({ recordingId, ts: startedAt + 30_000 }))
  })
})
