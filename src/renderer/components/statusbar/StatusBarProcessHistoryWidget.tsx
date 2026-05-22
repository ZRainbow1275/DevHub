import { useEffect, useMemo } from 'react'
import type { ProcessInfo } from '@shared/types-extended'
import { useProcessHistory24h } from '../../hooks/useProcessHistory'
import { useProcessStore } from '../../stores/processStore'
import { ProcessIcon } from '../icons'
import { ProcessSparkline } from '../monitor/process/ProcessSparkline'

const HISTORY_REFRESH_MS = 60_000

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function processSortScore(process: ProcessInfo): number {
  return safeNumber(process.cpu) * 10_000 + safeNumber(process.memory)
}

export function selectStatusbarHistoryProcess(processes: readonly ProcessInfo[]): ProcessInfo | null {
  const candidates = processes.filter(process => process.name.trim().length > 0)
  if (candidates.length === 0) return null
  return [...candidates].sort((left, right) => {
    const scoreDelta = processSortScore(right) - processSortScore(left)
    return scoreDelta !== 0 ? scoreDelta : left.pid - right.pid
  })[0] ?? null
}

function dispatchProcessMonitor(process: ProcessInfo | null): void {
  window.dispatchEvent(new CustomEvent('devhub:open-monitor'))
  window.dispatchEvent(new CustomEvent('devhub:monitor-navigate', {
    detail: process
      ? { tab: 'process', scope: { kind: 'process', targetId: process.pid, depth: 2 } }
      : { tab: 'process' }
  }))
}

export function StatusBarProcessHistoryWidget() {
  const processes = useProcessStore(state => state.processes)
  const topProcess = useMemo(() => selectStatusbarHistoryProcess(processes), [processes])
  const topProcessName = topProcess?.name
  const topProcessWorkingDir = topProcess?.workingDir
  const { getHistory, loadHistory } = useProcessHistory24h()

  useEffect(() => {
    if (!topProcessName || !window.devhub?.systemProcess?.getProcessHistory24h) return
    const historyIdentity = { name: topProcessName, workingDir: topProcessWorkingDir }
    const load = () => {
      void loadHistory(historyIdentity).catch(() => undefined)
    }
    load()
    const interval = window.setInterval(load, HISTORY_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [loadHistory, topProcessName, topProcessWorkingDir])

  const history = topProcess ? getHistory(topProcess) : undefined
  const latestCpu = topProcess ? Math.max(0, Math.round(safeNumber(topProcess.cpu))) : null
  const title = topProcess
    ? `进程 24h 趋势：${topProcess.name}，CPU ${latestCpu}%`
    : '进程 24h 趋势暂无可用扫描结果'

  return (
    <button
      type="button"
      className="hidden h-[22px] shrink-0 items-center gap-1.5 border-l-2 border-accent bg-surface-900/70 px-2 text-[10px] text-accent-300 transition-colors hover:bg-accent/10 radius-sm lg:flex"
      title={title}
      data-testid="statusbar-process-history-widget"
      data-process-pid={topProcess?.pid ?? ''}
      data-process-name={topProcess?.name ?? ''}
      disabled={!topProcess}
      onClick={() => dispatchProcessMonitor(topProcess)}
    >
      <ProcessIcon size={12} className="shrink-0" />
      <span className="uppercase tracking-wider text-text-muted">进程24h</span>
      <ProcessSparkline
        history={history}
        metric="cpu"
        width={54}
        height={12}
        color="var(--chart-series-1)"
        className="shrink-0"
        testId="statusbar-process-history-sparkline"
      />
      <span className="font-mono tabular-nums text-text-primary">{latestCpu === null ? '--' : `${latestCpu}%`}</span>
    </button>
  )
}
