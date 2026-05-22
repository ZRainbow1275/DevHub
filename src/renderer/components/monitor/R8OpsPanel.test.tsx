import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { R8OpsPanel } from './R8OpsPanel'
import type { WatchdogSupervisorEventStreamPayload } from '@shared/schemas/r8-runtime'

vi.mock('../../stores/scannerStore', () => ({
  useScannerStore: (selector: (state: { ports: Array<{ state: string; port: number; localAddress: string }> }) => unknown) => selector({
    ports: [{ state: 'LISTENING', port: 3000, localAddress: '127.0.0.1' }]
  })
}))

vi.mock('../../views/skills/SkillEditorPanel', () => ({ SkillEditorPanel: () => <div>skill-editor</div> }))
vi.mock('../../views/recovery/RecoveryDialog', () => ({ RecoveryDialog: () => <div>recovery-dialog</div> }))
vi.mock('../dag-editor/DagEditorPanel', () => ({ DagEditorPanel: () => <div>dag-editor</div> }))
vi.mock('../recording-replay/RecordingReplayPanel', () => ({ RecordingReplayPanel: () => <div>recording-replay</div> }))
vi.mock('../csv/CsvLaunchWizard', () => ({ CsvLaunchWizard: () => <div>csv-launch</div> }))
vi.mock('./MonitorWindowCards', () => ({ MonitorWindowCards: () => <div>monitor-window-cards</div> }))
vi.mock('../permission/CountdownBadge', () => ({ CountdownBadge: () => <span>ttl-countdown</span> }))

const backupBundle = {
  bundleId: 'bundle-1',
  backupId: 'backup-1',
  scope: ['settings', 'csv', 'skills', 'audit'],
  categories: [
    { category: 'settings', fileCount: 1, sizeBytes: 10, sha256: 'a'.repeat(64), relativePath: 'settings/store.json' },
    { category: 'csv-tasks', fileCount: 1, sizeBytes: 10, sha256: 'b'.repeat(64), relativePath: 'csv-tasks/tasks.json' },
    { category: 'skills', fileCount: 1, sizeBytes: 10, sha256: 'c'.repeat(64), relativePath: 'skills/skills.json' },
    { category: 'audit-log', fileCount: 1, sizeBytes: 10, sha256: 'd'.repeat(64), relativePath: 'audit-log/audit-log.json' }
  ],
  path: 'C:/devhub/backups/bundle-1',
  artifactPath: 'C:/devhub/backups/bundle-1',
  zipPath: 'C:/devhub/backups/bundle-1',
  bytes: 40,
  totalSizeBytes: 40,
  createdAt: 1_700_000_000_000,
  schemaVersion: '1.0.0',
  createdBy: 'user',
  redactedFields: ['apiKey'],
  warnings: []
}

const restoreResult = {
  startedAt: 1_700_000_000_001,
  finishedAt: 1_700_000_000_010,
  restored: [
    { category: 'settings', fileCount: 1, success: true, errors: [] },
    { category: 'skills', fileCount: 1, success: true, errors: [] }
  ],
  preRestoreSnapshotId: '00000000-0000-4000-8000-000000000001'
}

type SupervisorStatusValue = WatchdogSupervisorEventStreamPayload['events'][number]['status']['status']

function supervisorStreamPayload(status: SupervisorStatusValue): WatchdogSupervisorEventStreamPayload {
  const emittedAt = Date.now()
  return {
    emittedAt,
    events: [{
      eventId: `watchdog-supervisor-status-${emittedAt}`,
      emittedAt,
      type: 'status',
      result: 'info',
      code: null,
      message: null,
      reason: 'vitest',
      channel: null,
      evidence: null,
      status: {
        status,
        checkedAt: emittedAt,
        innerWatchdogPid: 1234,
        startedAt: emittedAt - 1000,
        lastInnerHeartbeatAt: emittedAt,
        innerHealthy: status === 'healthy',
        channelStates: {
          'named-pipe': true,
          'tcp-localhost': false,
          'marker-file': true
        },
        spawnAttempts: 1,
        lastSpawnError: null,
        windowsServiceInstalled: false,
        serviceName: null,
        note: 'vitest supervisor stream',
        sessionTokenPrefix: 'a1b2c3d4',
        markerFilePath: 'C:/devhub/watchdog/marker.json',
        namedPipePath: '\\\\.\\pipe\\devhub-watchdog-a1b2c3d4',
        eventPipePath: '\\\\.\\pipe\\devhub-watchdog-event-a1b2c3d4',
        tcpPort: null,
        protocolVersion: '1.0',
        respawnAllowed: true,
        nextRespawnDelayMs: 0,
        channelDiagnostics: [],
        evidence: []
      }
    }]
  }
}

function installDevhubMock() {
  const backupCreate = vi.fn(async () => backupBundle)
  const backupRestore = vi.fn(async () => restoreResult)
  const backupList = vi.fn(async () => [backupBundle])
  const taskExportResults = vi.fn(async () => ({
    success: true,
    scope: 'all',
    sessionId: null,
    runIds: ['task-run-1'],
    taskCount: 1,
    exportedAt: 1_700_000_000_020,
    artifactDir: 'C:/devhub/task-results-exports/all-1700000000020',
    files: [
      {
        format: 'json',
        path: 'C:/devhub/task-results-exports/all-1700000000020/task-results.json',
        bytes: 512,
        sha256: 'a'.repeat(64),
        mimeType: 'application/json'
      },
      {
        format: 'csv',
        path: 'C:/devhub/task-results-exports/all-1700000000020/task-results.csv',
        bytes: 128,
        sha256: 'b'.repeat(64),
        mimeType: 'text/csv'
      }
    ]
  }))
  const cleanup = () => undefined
  const supervisorEventHandlers: Array<(payload: WatchdogSupervisorEventStreamPayload) => void> = []

  ;(window as unknown as { devhub: unknown }).devhub = {
    r8: {
      integrations: { healthCheck: vi.fn(async () => ({ checkedAt: Date.now(), featureFlags: 1, ipcChannels: 1, schemas: 1, popouts: 0, stores: [] })) },
      ipc: { listChannels: vi.fn(async () => []) },
      zod: { listSchemas: vi.fn(async () => ({ schemas: [] })) },
      status: { aggregate: vi.fn(async () => ({ tiles: [] })) },
      watchdog: {
        status: vi.fn(async () => ({ state: 'healthy', heartbeatTimeoutMs: 30_000 })),
        supervisorStatus: vi.fn(async () => ({ status: 'idle' })),
        onSupervisorEventStream: vi.fn((callback: (payload: WatchdogSupervisorEventStreamPayload) => void) => {
          supervisorEventHandlers.push(callback)
          return () => {
            const index = supervisorEventHandlers.indexOf(callback)
            if (index >= 0) supervisorEventHandlers.splice(index, 1)
          }
        })
      },
      ocr: { recognize: vi.fn(async () => ({ code: 'E_OCR_DISABLED' })) },
      skill: {
        cloudSyncDisabled: vi.fn(async () => ({ code: 'E_FEATURE_DEFERRED' })),
        reload: vi.fn(async () => ({ success: true }))
      },
      task: {
        stats: vi.fn(async () => ({ total: 1, queued: 0, running: 0, failed: 0 })),
        exportResults: taskExportResults
      },
      cli: {
        getProgress: vi.fn(async () => ({ latest: null })),
        onDetectionEvent: vi.fn(() => cleanup),
        detectAll: vi.fn(async () => ({ scanDurationMs: 1, results: [] }))
      },
      monitor: {
        snapshot: vi.fn(async () => ({ windowState: { alwaysOnTop: false, opacity: 1 }, cards: [] })),
        listPopouts: vi.fn(async () => []),
        onSnapshotStream: vi.fn(() => cleanup),
        onPopoutSnapshotStream: vi.fn(() => cleanup),
        focusInstance: vi.fn(async () => ({ success: true })),
        setWindowPrefs: vi.fn(async () => ({ windowState: { alwaysOnTop: false, opacity: 1 } })),
        openPopout: vi.fn(async () => ({ success: true })),
        returnPopoutToMain: vi.fn(async () => ({ success: true })),
        setPopoutLayout: vi.fn(async () => ({ success: true }))
      },
      csv: {
        listSessions: vi.fn(async () => []),
        listTemplates: vi.fn(async () => [])
      },
      recording: {
        list: vi.fn(async () => []),
        start: vi.fn(async () => ({ sessionId: 'session-1' }))
      },
      recovery: {
        report: vi.fn(async () => []),
        scan: vi.fn(async () => ({ findings: [] }))
      },
      inject: {
        history: vi.fn(async () => []),
        dryRun: vi.fn(async () => ({ characters: 10 }))
      },
      permission: {
        expiryStream: vi.fn(async () => ({ grants: [], emittedAt: Date.now() }))
      },
      portSecurity: {
        classify: vi.fn(async () => ({ ip: '127.0.0.1', port: 3000, tier: 'local', score: 10, reasons: ['loopback'] }))
      },
      diagnostic: {
        preview: vi.fn(async () => ({ sections: [], totalEstimatedSize: 0, redactionCounts: {}, warnings: [] })),
        export: vi.fn(async () => ({ artifactPath: 'C:/devhub/diagnostics/pack-1', sectionsIncluded: [], noTelemetry: true }))
      },
      backup: {
        create: backupCreate,
        list: backupList,
        restore: backupRestore,
        delete: vi.fn(async () => ({ success: true })),
        configureSchedule: vi.fn(async () => ({ success: true })),
        scheduleConfig: vi.fn(async () => ({ enabled: false, cron: '0 3 * * *', retentionDays: 30, categoriesIncluded: ['settings', 'csv-tasks', 'skills', 'audit-log'] })),
        exportClassified: vi.fn(async () => backupBundle)
      },
      command: { invoke: vi.fn(async () => ({ success: true })) }
    }
  }

  return {
    backupCreate,
    backupList,
    backupRestore,
    taskExportResults,
    emitSupervisorEvent: (status: SupervisorStatusValue) => {
      const payload = supervisorStreamPayload(status)
      for (const handler of supervisorEventHandlers) handler(payload)
    }
  }
}

describe('R8OpsPanel backup RestoreWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders four restore category checkboxes and requires explicit confirmation before restore', async () => {
    const { backupRestore } = installDevhubMock()
    render(<R8OpsPanel />)

    await waitFor(() => expect(screen.getByTestId('backup-count')).toHaveTextContent('1'))

    expect(screen.getByTestId('backup-category-settings')).toBeChecked()
    expect(screen.getByTestId('backup-category-csv-tasks')).toBeChecked()
    expect(screen.getByTestId('backup-category-skills')).toBeChecked()
    expect(screen.getByTestId('backup-category-audit-log')).toBeChecked()
    expect(screen.getByTestId('backup-restore-button')).toBeDisabled()

    fireEvent.click(screen.getByTestId('backup-category-csv-tasks'))
    fireEvent.click(screen.getByTestId('backup-category-audit-log'))
    fireEvent.click(screen.getByTestId('backup-restore-confirm'))
    fireEvent.click(screen.getByTestId('backup-restore-button'))

    await waitFor(() => expect(backupRestore).toHaveBeenCalledWith({
      backupId: 'backup-1',
      categoriesToRestore: ['settings', 'skills'],
      conflictPolicy: 'overwrite',
      preRestoreSnapshot: true,
      confirmedBy: 'r8-ops-restore-wizard'
    }))
    await waitFor(() => expect(screen.getByTestId('backup-restore-status')).toHaveTextContent('2/2'))
    expect(screen.getByTestId('backup-restore-button')).toBeDisabled()
  })

  it('creates a real selected-category backup through the preload bridge', async () => {
    const { backupCreate } = installDevhubMock()
    render(<R8OpsPanel />)

    await waitFor(() => expect(screen.getByTestId('backup-count')).toHaveTextContent('1'))

    fireEvent.click(screen.getByTestId('backup-category-audit-log'))
    fireEvent.click(screen.getByTestId('backup-create-selected-button'))

    await waitFor(() => expect(backupCreate).toHaveBeenCalledWith({
      categories: ['settings', 'csv-tasks', 'skills'],
      confirmedBy: 'r8-ops-restore-wizard'
    }))
  })

  it('exports task results through the real R8 task bridge contract', async () => {
    const { taskExportResults } = installDevhubMock()
    render(<R8OpsPanel />)

    await waitFor(() => expect(screen.getByTestId('task-result-export-count')).toHaveTextContent('N/A'))

    fireEvent.click(screen.getByTestId('task-result-export-button'))

    await waitFor(() => expect(taskExportResults).toHaveBeenCalledWith({
      format: 'both',
      confirmedBy: 'r8-ops-task-export'
    }))
    await waitFor(() => expect(screen.getByTestId('task-result-export-count')).toHaveTextContent('1'))
    expect(screen.getByTestId('task-result-export-path')).toHaveTextContent('task-results-exports')
    expect(screen.getByTestId('task-result-export-files')).toHaveTextContent('json:512')
    expect(screen.getByTestId('task-result-export-files')).toHaveTextContent('csv:128')
  })

  it('updates watchdog supervisor status from renderer event stream', async () => {
    const { emitSupervisorEvent } = installDevhubMock()
    render(<R8OpsPanel />)

    await waitFor(() => expect(screen.getByText('idle')).toBeInTheDocument())
    act(() => {
      emitSupervisorEvent('healthy')
    })

    await waitFor(() => expect(screen.getByText('healthy')).toBeInTheDocument())
  })
})
