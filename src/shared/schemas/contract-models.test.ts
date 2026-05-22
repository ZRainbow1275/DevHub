import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  contractSchemaRegistry,
  iScannerSchema,
  partialDeepDetailSchema,
  themeStateSchema,
  windowLayoutSnapshotSchema
} from './contract-models'

const CONTRACT_22_TYPE_NAMES = [
  'IScanner',
  'ScannerId',
  'ScannerMetrics',
  'ProcessInfo',
  'PartialDeepDetail',
  'AccessReport',
  'ModuleInfo',
  'ConnectionInfo',
  'PortInfo',
  'PortDetail',
  'WindowInfo',
  'WindowFingerprint',
  'WindowGroup',
  'WindowLayoutSnapshot',
  'TilePreset',
  'AIAlias',
  'RenameIntent',
  'RenameResult',
  'AIMonitorState',
  'AITaskKey',
  'DerivedProgress',
  'AITaskPhase',
  'DetectionSignalName',
  'SignalResult',
  'SignalContribution',
  'CalibrationSample',
  'ToolProfile',
  'AITaskHistory',
  'TopologyScope',
  'TopologyRootKind',
  'TopologyGraph',
  'TopologyNode',
  'TopologyEdge',
  'ThemeState',
  'PaletteName',
  'DensityLevel',
  'RadiusFamily',
  'MotionLevel',
  'ThemePreset',
  'AppNotification',
  'IPCEnvelope'
] as const

describe('contract model schema registry', () => {
  it('has a Zod schema for every contracts/22 listed data model', () => {
    for (const name of CONTRACT_22_TYPE_NAMES) {
      expect(contractSchemaRegistry[name]).toBeInstanceOf(z.ZodType)
    }
  })

  it('keeps the documented fixed list in sync with the runtime registry', () => {
    expect(Object.keys(contractSchemaRegistry).sort()).toEqual([...CONTRACT_22_TYPE_NAMES].sort())
  })

  it('validates scanner lifecycle contracts by id and lifecycle methods', () => {
    const scanner = {
      id: 'process',
      start: async () => undefined,
      stop: async () => undefined,
      getSnapshot: () => ({ processes: [] }),
      subscribe: () => () => undefined,
      getMetrics: () => ({
        lastRunAt: 1,
        lastDurationMs: 10,
        lastResultSize: 2,
        errorCount: 0,
        p95DurationMs: 12
      })
    }

    expect(iScannerSchema.safeParse(scanner).success).toBe(true)
    expect(iScannerSchema.safeParse({ ...scanner, stop: undefined }).success).toBe(false)
  })

  it('rejects partial deep process details without access report evidence', () => {
    expect(partialDeepDetailSchema.safeParse({ pid: 12, name: 'node' }).success).toBe(false)
  })

  it('defaults theme schema version to v2 for migrated palette-only settings', () => {
    const parsed = themeStateSchema.parse({
      palette: 'modern-light',
      density: 'standard',
      radiusFamily: 'soft',
      motionLevel: 'balanced'
    })

    expect(parsed.schemaVersion).toBe(2)
  })

  it('validates persisted layout snapshots by stable fingerprints instead of hwnd-only state', () => {
    const parsed = windowLayoutSnapshotSchema.parse({
      id: 'snap-1',
      name: 'grid',
      scope: 'selected',
      presetKind: 'four-grid',
      windows: [
        {
          fingerprint: {
            processExe: 'C:/Program Files/App/app.exe',
            windowClass: 'Chrome_WidgetWin_1',
            titleRoot: 'DevHub',
            userId: 'user'
          },
          rect: { x: 0, y: 0, width: 800, height: 600 },
          monitorId: 'primary'
        }
      ],
      createdAt: 1
    })

    expect(parsed.windows[0].fingerprint.processExe).toContain('app.exe')
  })
})
