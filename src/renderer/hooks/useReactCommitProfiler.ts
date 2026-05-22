import { useCallback, useRef } from 'react'
import type { ProfilerOnRenderCallback } from 'react'
import type {
  ReactCommitEntry,
  ReactCommitPhase,
  ReactCommitReport
} from '@shared/observability'
import { DEFAULT_DEV_OBS_WINDOW_MS } from '@shared/observability'

interface CommitSample {
  actualDuration: number
  baseDuration: number
  phase: ReactCommitPhase
  ts: number
}

interface CommitAccumulator {
  lastCommitTime: number | null
  lastPhase: ReactCommitPhase | null
  samples: CommitSample[]
}

export interface ReactCommitProfilerController {
  getReport: () => ReactCommitReport
  onRender: ProfilerOnRenderCallback
  recordCommit: (id: string, phase?: ReactCommitPhase) => void
  reset: () => void
}

export function useReactCommitProfiler(
  windowMs = DEFAULT_DEV_OBS_WINDOW_MS
): ReactCommitProfilerController {
  const commitsRef = useRef<Map<string, CommitAccumulator>>(new Map())
  const hasProfilerSignalRef = useRef(false)

  const prune = useCallback((now: number) => {
    for (const [id, accumulator] of commitsRef.current) {
      accumulator.samples = accumulator.samples.filter((sample) => now - sample.ts <= windowMs)
      if (accumulator.samples.length === 0) {
        commitsRef.current.delete(id)
      }
    }
  }, [windowMs])

  const appendSample = useCallback((
    id: string,
    phase: ReactCommitPhase,
    actualDuration: number,
    baseDuration: number,
    ts: number
  ) => {
    prune(ts)

    const accumulator = commitsRef.current.get(id) ?? {
      lastCommitTime: null,
      lastPhase: null,
      samples: []
    }

    accumulator.samples.push({
      actualDuration,
      baseDuration,
      phase,
      ts
    })
    accumulator.lastCommitTime = ts
    accumulator.lastPhase = phase
    commitsRef.current.set(id, accumulator)
  }, [prune])

  const onRender = useCallback<ProfilerOnRenderCallback>((
    id,
    phase,
    actualDuration,
    baseDuration,
    _startTime,
    commitTime
  ) => {
    const ts = Number.isFinite(commitTime) ? commitTime : Date.now()
    const normalizedPhase = phase as ReactCommitPhase
    hasProfilerSignalRef.current = true
    appendSample(id, normalizedPhase, actualDuration, baseDuration, ts)
  }, [appendSample])

  const recordCommit = useCallback((id: string, phase: ReactCommitPhase = 'update') => {
    // React 官方文档明确说明标准 production build 默认禁用 profiling。
    // 当 <Profiler> 没有产出 onRender 信号时，退回到 commit 级计数，至少保证
    // DevObservabilityPanel 的 React commit 指标在 unpackaged / non-profiling build 中可观测。
    if (hasProfilerSignalRef.current) {
      return
    }

    appendSample(id, phase, 0, 0, Date.now())
  }, [appendSample])

  const getReport = useCallback((): ReactCommitReport => {
    const now = Date.now()
    prune(now)

    const top = Array.from(commitsRef.current.entries())
      .map<ReactCommitEntry>(([id, accumulator]) => {
        const commits = accumulator.samples.length
        const totalActualMs = accumulator.samples.reduce((sum, sample) => sum + sample.actualDuration, 0)
        const totalBaseMs = accumulator.samples.reduce((sum, sample) => sum + sample.baseDuration, 0)

        return {
          id,
          commits,
          avgActualMs: commits > 0 ? totalActualMs / commits : 0,
          avgBaseMs: commits > 0 ? totalBaseMs / commits : 0,
          lastCommitTime: accumulator.lastCommitTime,
          lastPhase: accumulator.lastPhase
        }
      })
      .sort((left, right) => {
        if (right.commits !== left.commits) {
          return right.commits - left.commits
        }
        return right.avgActualMs - left.avgActualMs
      })
      .slice(0, 5)

    return {
      generatedAt: now,
      windowMs,
      top
    }
  }, [prune, windowMs])

  const reset = useCallback(() => {
    commitsRef.current.clear()
    hasProfilerSignalRef.current = false
  }, [])

  return {
    getReport,
    onRender,
    recordCommit,
    reset
  }
}
