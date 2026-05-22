import { useCallback, useEffect, useMemo, useRef } from 'react'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY, type PortPopoutSyncPolicy } from '@shared/types'
import {
  PortPopoutViewSyncStateSchema,
  type PortPopoutViewSyncState
} from '@shared/types-extended'

const PORT_POPOUT_SYNC_MESSAGE_KEY = 'port-view-state'
const PORT_POPOUT_SYNC_DEBOUNCE_MS = 120
const MAIN_WINDOW_ID = 'main:port-view'

function resolveWindowId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('r8Popout')?.trim() || MAIN_WINDOW_ID
}

function getResolvedPolicy(policy?: PortPopoutSyncPolicy | null): PortPopoutSyncPolicy {
  return {
    ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
    ...policy,
  }
}

function isMainWindowId(windowId: string): boolean {
  return windowId.startsWith('main:')
}

function canSend(policy: PortPopoutSyncPolicy, localWindowId: string): boolean {
  if (policy.direction === 'isolated') return false
  if (policy.direction === 'both') return true
  const localIsMain = isMainWindowId(localWindowId)
  if (policy.direction === 'main-to-popout') return localIsMain
  return !localIsMain
}

function canReceive(policy: PortPopoutSyncPolicy, localWindowId: string, sourceWindowId: string): boolean {
  if (policy.direction === 'isolated') return false
  if (policy.direction === 'both') return true
  const localIsMain = isMainWindowId(localWindowId)
  const sourceIsMain = isMainWindowId(sourceWindowId)
  if (policy.direction === 'main-to-popout') return !localIsMain && sourceIsMain
  return localIsMain && !sourceIsMain
}

function applyPolicyToState(
  current: PortPopoutViewSyncState,
  incoming: PortPopoutViewSyncState,
  policy: PortPopoutSyncPolicy
): PortPopoutViewSyncState {
  if (policy.direction === 'isolated') return current

  return {
    selectedPort: policy.selection ? incoming.selectedPort : current.selectedPort,
    filter: policy.filters ? incoming.filter : current.filter,
    searchPort: policy.search ? incoming.searchPort : current.searchPort,
    viewMode: policy.sort ? incoming.viewMode : current.viewMode
  }
}

interface UsePopoutSyncArgs {
  state: PortPopoutViewSyncState
  onStateChange: (state: PortPopoutViewSyncState) => void
  policy?: PortPopoutSyncPolicy | null
  debounceMs?: number
}

export function usePopoutSync({
  state,
  onStateChange,
  policy,
  debounceMs = PORT_POPOUT_SYNC_DEBOUNCE_MS
}: UsePopoutSyncArgs): void {
  const windowId = useMemo(() => resolveWindowId(), [])
  const resolvedPolicy = useMemo(() => getResolvedPolicy(policy), [policy])
  const latestStateRef = useRef(state)
  const latestPolicyRef = useRef(resolvedPolicy)
  const lastAppliedSnapshotRef = useRef<string | null>(null)
  const lastSentSnapshotRef = useRef<string | null>(null)
  const sendTimerRef = useRef<number | null>(null)
  const isFirstRenderRef = useRef(true)

  useEffect(() => {
    latestStateRef.current = state
  }, [state])

  useEffect(() => {
    latestPolicyRef.current = resolvedPolicy
  }, [resolvedPolicy])

  const clearPendingSend = useCallback(() => {
    if (!sendTimerRef.current) return
    window.clearTimeout(sendTimerRef.current)
    sendTimerRef.current = null
  }, [])

  useEffect(() => {
    const bridge = window.devhub?.r8?.popout
    if (!bridge?.onBridgeMessage) return

    return bridge.onBridgeMessage((message) => {
      if (message.type !== 'sync' || message.key !== PORT_POPOUT_SYNC_MESSAGE_KEY) return
      if (message.windowId === windowId) return

      const parsed = PortPopoutViewSyncStateSchema.safeParse(message.value)
      if (!parsed.success) return
      if (!canReceive(latestPolicyRef.current, windowId, message.windowId)) return

      const next = applyPolicyToState(latestStateRef.current, parsed.data, latestPolicyRef.current)
      const nextSnapshot = JSON.stringify(next)
      if (nextSnapshot === JSON.stringify(latestStateRef.current)) return

      lastAppliedSnapshotRef.current = nextSnapshot
      lastSentSnapshotRef.current = nextSnapshot
      onStateChange(next)
    })
  }, [onStateChange, windowId])

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      lastSentSnapshotRef.current = JSON.stringify(state)
      return
    }

    const snapshot = JSON.stringify(state)
    if (snapshot === lastAppliedSnapshotRef.current || snapshot === lastSentSnapshotRef.current) return
    if (!canSend(resolvedPolicy, windowId)) return

    clearPendingSend()
    sendTimerRef.current = window.setTimeout(() => {
      const bridge = window.devhub?.r8?.popout
      if (!bridge?.bridgeMessage) return

      lastSentSnapshotRef.current = snapshot
      void bridge.bridgeMessage({
        windowId,
        type: 'sync',
        key: PORT_POPOUT_SYNC_MESSAGE_KEY,
        value: PortPopoutViewSyncStateSchema.parse(state)
      }).catch(() => undefined)
    }, debounceMs)

    return clearPendingSend
  }, [clearPendingSend, debounceMs, resolvedPolicy, state, windowId])
}
