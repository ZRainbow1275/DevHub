import { describe, expect, it } from 'vitest'
import { DEFAULT_PORT_POPOUT_SYNC_POLICY } from './types'
import {
  POPOUT_LIMITS,
  PORT_POPOUT_FILTER_VALUES,
  PORT_POPOUT_LIMITS,
  PORT_POPOUT_VIEW_MODE_VALUES,
  PortPopoutSchema,
  PortPopoutViewSyncStateSchema,
  PopoutSyncPolicySchema,
  PopoutTriggerSchema,
  ZIndexTier
} from './types-extended'

describe('R8.B shared port popout contracts', () => {
  it('keeps the z-index tier and popout limits aligned', () => {
    expect(POPOUT_LIMITS).toBe(PORT_POPOUT_LIMITS)
    expect(POPOUT_LIMITS.Z_INDEX_BASE).toBe(ZIndexTier.POPOUT)
    expect(POPOUT_LIMITS.Z_INDEX_RANGE).toBe(999)
    expect(POPOUT_LIMITS.MAX_FLOATING).toBe(5)
  })

  it('parses trigger and sync-policy contracts with the expected real defaults', () => {
    expect(PopoutTriggerSchema.safeParse('cmdk').success).toBe(true)
    expect(PopoutTriggerSchema.safeParse('browserwindow').success).toBe(false)

    expect(PopoutSyncPolicySchema.parse({ direction: 'isolated' })).toMatchObject({
      ...DEFAULT_PORT_POPOUT_SYNC_POLICY,
      direction: 'isolated'
    })
  })

  it('parses a renderer port popout contract without fake fields', () => {
    const parsed = PortPopoutSchema.parse({
      id: 'port:3000:pid:4242',
      port: 3000,
      pid: 4242,
      trigger: 'click',
      mode: 'floating',
      position: { x: 12, y: 24 },
      size: { width: 360, height: 280 },
      zIndex: POPOUT_LIMITS.Z_INDEX_BASE,
      pinned: false,
      minimized: false,
      createdAt: 100,
      lastInteractedAt: 120
    })

    expect(parsed).toMatchObject({
      id: 'port:3000:pid:4242',
      port: 3000,
      pid: 4242,
      trigger: 'click',
      mode: 'floating',
      position: { x: 12, y: 24 },
      size: { width: 360, height: 280 },
      zIndex: POPOUT_LIMITS.Z_INDEX_BASE,
      pinned: false,
      minimized: false,
      alwaysOnTop: false,
      kind: 'port-detail'
    })
    expect(parsed.syncPolicy).toEqual(DEFAULT_PORT_POPOUT_SYNC_POLICY)
  })

  it('parses real port popout view sync state payloads', () => {
    const parsed = PortPopoutViewSyncStateSchema.parse({
      selectedPort: 3000,
      filter: PORT_POPOUT_FILTER_VALUES[1],
      searchPort: '3000',
      viewMode: PORT_POPOUT_VIEW_MODE_VALUES[2]
    })

    expect(parsed).toEqual({
      selectedPort: 3000,
      filter: 'common',
      searchPort: '3000',
      viewMode: 'relationship'
    })
  })
})
