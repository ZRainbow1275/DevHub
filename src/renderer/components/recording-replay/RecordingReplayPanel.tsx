import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AsciinemaCast,
  RecordingEvent,
  RecordingFsSnapshotResult,
  RecordingManifest,
  RecordingReplayState,
  RecordingScreenshotResult,
  RecordingStreamKind
} from '@shared/schemas/r8-runtime'
import { useT } from '../../hooks/useT'
import { AnchorList } from './AnchorList'
import { AsciinemaPlayer } from './AsciinemaPlayer'
import { FsTrack } from './FsTrack'
import { GitDiffTrack } from './GitDiffTrack'
import { ReplayClock } from './ReplayClock'
import { ScreenshotTrack } from './ScreenshotTrack'
import { SpeedControl } from './SpeedControl'
import { StdinTrack } from './StdinTrack'
import { StdoutTrack } from './StdoutTrack'
import { Timeline } from './Timeline'

const DEFAULT_TRACKS: RecordingStreamKind[] = ['stdout', 'stdin', 'screenshot', 'fs', 'git-diff']
const TRACK_LABELS: Record<RecordingStreamKind, string> = {
  'git-diff': 'git-diff',
  fs: 'fs',
  screenshot: 'screenshot',
  stdin: 'stdin',
  stdout: 'stdout'
}

export function RecordingReplayPanel() {
  const { t } = useT()
  const [manifests, setManifests] = useState<RecordingManifest[]>([])
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>('')
  const [state, setState] = useState<RecordingReplayState | null>(null)
  const [events, setEvents] = useState<RecordingEvent[]>([])
  const [cast, setCast] = useState<AsciinemaCast | null>(null)
  const [screenshot, setScreenshot] = useState<RecordingScreenshotResult | null>(null)
  const [fsSnapshot, setFsSnapshot] = useState<RecordingFsSnapshotResult | null>(null)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(true)
  const [enabledTracks, setEnabledTracks] = useState<RecordingStreamKind[]>(DEFAULT_TRACKS)
  const [error, setError] = useState<string | null>(null)
  const clockRef = useRef<ReplayClock | null>(null)
  const playbackRef = useRef({ paused: true, speed: 1 })
  const cursorRef = useRef(0)

  const replayRecordingId = state?.recordingId ?? ''
  const replayStartedAtAbsTs = state?.startedAtAbsTs ?? 0
  const replayEndedAtAbsTs = state?.endedAtAbsTs ?? 0
  const replayCursorTs = state?.cursorTs

  const loadManifests = useCallback(async () => {
    const loaded = await window.devhub.r8.recording.list({})
    const next = loaded.filter(isRecordingManifest)
    setManifests(next)
    setSelectedRecordingId(current => current || (next[0]?.recordingId ?? ''))
  }, [])

  const loadReplay = useCallback(async (recordingId: string, cursorTs?: number) => {
    if (!recordingId) return
    const nextState = await window.devhub.r8.recording.getReplayState({
      recordingId,
      cursorTs,
      speed,
      paused,
      enabledTracks
    })
    const nextEvents = await window.devhub.r8.recording.getEventsWindow({
      recordingId,
      sinceTs: nextState.startedAtAbsTs,
      untilTs: nextState.endedAtAbsTs,
      kinds: enabledTracks
    })
    const [nextCast, nextFsSnapshot, nextScreenshot] = await Promise.all([
      window.devhub.r8.recording.getCast(recordingId).then(result => result.cast),
      window.devhub.r8.recording.getFsSnapshotAt({ recordingId, ts: nextState.cursorTs }),
      window.devhub.r8.recording.getScreenshot({ recordingId, ts: nextState.cursorTs }).catch(() => null)
    ])
    setState(nextState)
    setEvents(nextEvents)
    setCast(nextCast)
    setFsSnapshot(nextFsSnapshot)
    setScreenshot(nextScreenshot)
    setError(null)
  }, [enabledTracks, paused, speed])

  useEffect(() => {
    void loadManifests().catch(reason => setError(errorMessage(reason)))
  }, [loadManifests])

  useEffect(() => {
    if (!selectedRecordingId) return
    void loadReplay(selectedRecordingId).catch(reason => setError(errorMessage(reason)))
  }, [loadReplay, selectedRecordingId])

  useEffect(() => {
    playbackRef.current = { paused, speed }
  }, [paused, speed])

  useEffect(() => {
    if (replayCursorTs !== undefined) cursorRef.current = replayCursorTs
  }, [replayCursorTs])

  useEffect(() => {
    if (!replayRecordingId) return undefined
    clockRef.current?.dispose()
    const playback = playbackRef.current
    const clock = new ReplayClock(
      { startedAtAbsTs: replayStartedAtAbsTs, endedAtAbsTs: replayEndedAtAbsTs },
      { cursorTs: cursorRef.current, paused: playback.paused, speed: playback.speed }
    )
    clockRef.current = clock
    const unsubscribe = clock.subscribe(snapshot => {
      setState(current => current ? { ...current, cursorTs: snapshot.cursorTs, paused: snapshot.paused } : current)
      setPaused(snapshot.paused)
      setSpeed(snapshot.speed)
    })
    return () => {
      unsubscribe()
      clock.dispose()
    }
  }, [replayEndedAtAbsTs, replayRecordingId, replayStartedAtAbsTs])

  useEffect(() => {
    if (replayCursorTs === undefined || !selectedRecordingId) return
    const handle = window.setTimeout(() => {
      void Promise.all([
        window.devhub.r8.recording.getFsSnapshotAt({ recordingId: selectedRecordingId, ts: replayCursorTs }).then(setFsSnapshot),
        window.devhub.r8.recording.getScreenshot({ recordingId: selectedRecordingId, ts: replayCursorTs }).then(setScreenshot).catch(() => setScreenshot(null))
      ]).catch(reason => setError(errorMessage(reason)))
    }, 120)
    return () => window.clearTimeout(handle)
  }, [replayCursorTs, selectedRecordingId])

  const selectedManifest = useMemo(
    () => manifests.find(manifest => manifest.recordingId === selectedRecordingId) ?? null,
    [manifests, selectedRecordingId]
  )

  const toggleTrack = useCallback((track: RecordingStreamKind) => {
    setEnabledTracks(current => {
      if (current.includes(track)) {
        if (current.length === 1) return current
        return current.filter(candidate => candidate !== track)
      }
      return DEFAULT_TRACKS.filter(candidate => candidate === track || current.includes(candidate))
    })
  }, [])

  const seek = useCallback((cursorTs: number) => {
    clockRef.current?.seek(cursorTs)
    setPaused(true)
  }, [])

  const setReplaySpeed = useCallback((nextSpeed: number) => {
    setSpeed(nextSpeed)
    clockRef.current?.setSpeed(nextSpeed)
  }, [])

  const play = useCallback(() => {
    setPaused(false)
    clockRef.current?.play()
  }, [])

  const pause = useCallback(() => {
    setPaused(true)
    clockRef.current?.pause()
  }, [])

  useEffect(() => {
    const pauseForHiddenWindow = () => {
      if (document.hidden) pause()
    }
    const pauseForBlur = () => pause()
    document.addEventListener('visibilitychange', pauseForHiddenWindow)
    window.addEventListener('blur', pauseForBlur)
    return () => {
      document.removeEventListener('visibilitychange', pauseForHiddenWindow)
      window.removeEventListener('blur', pauseForBlur)
    }
  }, [pause])

  const cursorOffsetMs = state ? Math.max(0, state.cursorTs - state.startedAtAbsTs) : 0

  return (
    <section className="space-y-3" data-testid="recording-replay-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.22em] text-accent">任务回放</div>
          <p className="text-xs text-text-muted">本地读取 spec-22 录制产物，stdout / stdin / screenshot / fs / git-diff 同一游标同步。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="border border-surface-700 bg-surface-950 px-2 py-1 text-xs text-text-primary radius-sm"
            onChange={event => setSelectedRecordingId(event.currentTarget.value)}
            value={selectedRecordingId}
          >
            <option value="">选择真实录制</option>
            {manifests.map(manifest => <option key={manifest.recordingId} value={manifest.recordingId}>{manifest.label}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => { void loadManifests().catch(reason => setError(errorMessage(reason))) }} type="button">刷新</button>
        </div>
      </div>

      {error ? <div className="border border-danger/50 bg-danger/10 px-3 py-2 text-xs text-danger radius-sm">{error}</div> : null}
      {!selectedManifest ? <div className="border border-dashed border-surface-700 px-3 py-8 text-center text-sm text-text-muted radius-md">暂无可回放的真实录制。请先通过 R8.C spec-22 录制任务。</div> : null}

      {state ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border border-surface-800 bg-surface-950 p-3 radius-md">
            <div className="text-xs text-text-muted">
              <span className="font-mono text-text-primary">{state.recordingId}</span>
              <span className="mx-2">·</span>
              <span>{state.manifest.cwd}</span>
            </div>
            <div className="flex flex-col items-end gap-2">
              <SpeedControl onPause={pause} onPlay={play} onSpeedChange={setReplaySpeed} paused={paused} speed={speed} />
              <div aria-label={t('replay.tracks', 'Replay tracks')} className="flex flex-wrap justify-end gap-1 text-[10px] uppercase tracking-wider text-text-muted">
                {DEFAULT_TRACKS.map(track => (
                  <label className="flex items-center gap-1 border border-surface-800 bg-surface-900 px-2 py-1 radius-sm" key={track}>
                    <input aria-label={t('replay.track', 'track {{track}}').replace('{{track}}', String(track))} checked={enabledTracks.includes(track)} onChange={() => toggleTrack(track)} type="checkbox" />
                    <span>{TRACK_LABELS[track]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <Timeline onSeek={seek} state={state} />
          <div className="grid gap-3 lg:grid-cols-2">
            {enabledTracks.includes('stdout') ? <StdoutTrack cursorTs={state.cursorTs} events={events} startedAtAbsTs={state.startedAtAbsTs} /> : null}
            {enabledTracks.includes('stdout') ? <AsciinemaPlayer cast={cast} cursorOffsetMs={cursorOffsetMs} /> : null}
            {enabledTracks.includes('stdin') ? <StdinTrack cursorTs={state.cursorTs} events={events} startedAtAbsTs={state.startedAtAbsTs} /> : null}
            {enabledTracks.includes('screenshot') ? <ScreenshotTrack cursorTs={state.cursorTs} events={events} onSeek={seek} screenshot={screenshot} startedAtAbsTs={state.startedAtAbsTs} /> : null}
            {enabledTracks.includes('fs') ? <FsTrack snapshot={fsSnapshot} /> : null}
            <AnchorList anchors={state.anchors} onSeek={seek} startedAtAbsTs={state.startedAtAbsTs} />
            {enabledTracks.includes('git-diff') ? <GitDiffTrack cursorTs={state.cursorTs} events={events} startedAtAbsTs={state.startedAtAbsTs} /> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function isRecordingManifest(value: unknown): value is RecordingManifest {
  return typeof value === 'object' && value !== null && 'recordingId' in value && 'manifestPath' in value
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason)
}
