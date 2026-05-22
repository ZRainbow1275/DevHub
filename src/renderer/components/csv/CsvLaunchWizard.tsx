import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CsvLaunchSession, CsvSessionEvent } from '@shared/schemas/r8-runtime'

type RunnerKind = 'devhub' | 'python' | 'cli'

interface RunnerInfo {
  available: boolean
  version: string | null
  details: Record<string, unknown>
}

interface CommandResult {
  command?: string
  copyToClipboard?: boolean
  commandFilePath?: string
}

interface LaunchResult {
  success?: boolean
  session?: CsvLaunchSession
  command?: string | null
}

const RUNNERS: Array<{ kind: RunnerKind; label: string; description: string }> = [
  { kind: 'devhub', label: 'DevHub Runner', description: 'In-process queue launch for local batches.' },
  { kind: 'python', label: 'Python Bridge', description: 'Local Python child process bridge with script integrity checks.' },
  { kind: 'cli', label: 'CLI Command', description: 'Generate a copyable devhub run-csv command without spawning.' }
]

function isRunnerInfo(value: unknown): value is RunnerInfo {
  return typeof value === 'object' && value !== null && typeof (value as RunnerInfo).available === 'boolean'
}

function isCommandResult(value: unknown): value is CommandResult {
  return typeof value === 'object' && value !== null
}

function isLaunchResult(value: unknown): value is LaunchResult {
  return typeof value === 'object' && value !== null
}

export function CsvLaunchWizard() {
  const [csvPath, setCsvPath] = useState('')
  const [runner, setRunner] = useState<RunnerKind>('devhub')
  const [concurrent, setConcurrent] = useState(3)
  const [dryRun, setDryRun] = useState(true)
  const [runnerInfo, setRunnerInfo] = useState<Partial<Record<RunnerKind, RunnerInfo>>>({})
  const [command, setCommand] = useState<CommandResult | null>(null)
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null)
  const [events, setEvents] = useState<CsvSessionEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const canSubmit = csvPath.trim().length > 0 && concurrent >= 1 && concurrent <= 16
  const activeInfo = runnerInfo[runner]
  const eventSummary = useMemo(() => events.slice(-4).reverse(), [events])

  const refreshRunnerInfo = useCallback(async () => {
    const entries = await Promise.all(RUNNERS.map(async item => {
      const info = await window.devhub.r8.csv.getRunnerInfo(item.kind)
      return [item.kind, isRunnerInfo(info) ? info : { available: false, version: null, details: { reason: 'invalid response' } }] as const
    }))
    setRunnerInfo(Object.fromEntries(entries) as Partial<Record<RunnerKind, RunnerInfo>>)
  }, [])

  useEffect(() => {
    void refreshRunnerInfo().catch(reason => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [refreshRunnerInfo])

  useEffect(() => {
    return window.devhub.r8.csv.onSessionEvent(event => {
      setEvents(current => [...current, event].slice(-20))
    })
  }, [])

  const generateCommand = useCallback(async () => {
    if (!canSubmit) return
    try {
      const result = await window.devhub.r8.csv.generateCommand({ csvPath: csvPath.trim(), runner, concurrent, dryRun })
      const parsed = isCommandResult(result) ? result : {}
      setCommand(parsed)
      if (parsed.command && typeof navigator.clipboard?.writeText === 'function') {
        await navigator.clipboard.writeText(parsed.command)
      }
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [canSubmit, concurrent, csvPath, dryRun, runner])

  const launch = useCallback(async () => {
    if (!canSubmit) return
    try {
      const result = await window.devhub.r8.csv.launch({ csvPath: csvPath.trim(), runner, concurrent, dryRun }, 'csv-launch-wizard')
      setLaunchResult(isLaunchResult(result) ? result : null)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    }
  }, [canSubmit, concurrent, csvPath, dryRun, runner])

  return (
    <section className="space-y-4" data-testid="csv-launch-wizard">
      <div>
        <h4 className="text-sm font-bold uppercase tracking-[0.18em] text-text-primary">CSV Launch Wizard</h4>
        <p className="text-xs text-text-muted">三路入口：DevHub 队列、Python 子进程桥、CLI 命令生成。</p>
      </div>

      <label className="block text-xs text-text-muted">
        CSV Path
        <input
          className="mt-1 w-full border border-surface-700 bg-surface-950 px-3 py-2 text-sm text-text-primary radius-sm"
          data-testid="csv-launch-path"
          value={csvPath}
          onChange={event => setCsvPath(event.currentTarget.value)}
          placeholder="C:/Users/HP/AppData/Roaming/devhub/tasks/batch.csv"
        />
      </label>

      <div className="grid gap-2 md:grid-cols-3">
        {RUNNERS.map(item => {
          const info = runnerInfo[item.kind]
          const selected = runner === item.kind
          return (
            <button
              className={`border p-3 text-left radius-sm ${selected ? 'border-accent bg-accent/10' : 'border-surface-700 bg-surface-900'}`}
              data-testid={`csv-runner-${item.kind}`}
              key={item.kind}
              type="button"
              onClick={() => setRunner(item.kind)}
            >
              <div className="text-sm font-semibold text-text-primary">{item.label}</div>
              <div className="mt-1 text-xs text-text-muted">{item.description}</div>
              <div className="mt-2 font-mono text-[11px] text-text-muted">{info?.available ? `available ${info.version ?? ''}` : `unavailable ${String(info?.details.reason ?? 'checking')}`}</div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-text-muted">
          Concurrent
          <input
            className="ml-2 w-20 border border-surface-700 bg-surface-950 px-2 py-1 font-mono text-text-primary radius-sm"
            max={16}
            min={1}
            type="number"
            value={concurrent}
            onChange={event => setConcurrent(Number(event.currentTarget.value))}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <input checked={dryRun} type="checkbox" onChange={event => setDryRun(event.currentTarget.checked)} />
          Dry run
        </label>
        <span className="text-xs text-text-muted">Active runner: {runner}; {activeInfo?.available ? 'ready' : 'guarded'}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" data-testid="csv-generate-command" disabled={!canSubmit} type="button" onClick={() => { void generateCommand() }}>Generate CLI command</button>
        <button className="btn-primary" data-testid="csv-launch-confirm" disabled={!canSubmit} type="button" onClick={() => { void launch() }}>Launch</button>
      </div>

      {command?.command && (
        <pre className="overflow-auto border border-surface-700 bg-surface-950 p-3 text-xs text-text-primary radius-sm" data-testid="csv-cli-command-output">{command.command}</pre>
      )}
      {launchResult?.session && (
        <div className="border border-surface-700 bg-surface-900 p-3 text-xs text-text-muted radius-sm" data-testid="csv-launch-session">
          Session {launchResult.session.sessionId}: {launchResult.session.status} via {launchResult.session.runner}
        </div>
      )}
      {eventSummary.length > 0 && (
        <div className="space-y-1 text-xs text-text-muted" data-testid="csv-session-events">
          {eventSummary.map(event => <div key={`${event.sessionId}-${event.emittedAt}-${event.type}`}>{event.type}</div>)}
        </div>
      )}
      {error && <div className="border border-warning/50 bg-warning/10 p-2 text-xs text-warning radius-sm">{error}</div>}
    </section>
  )
}
