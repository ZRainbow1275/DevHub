import type { BackgroundScannerManager } from '../BackgroundScannerManager'
import type { AITaskTracker } from '../AITaskTracker'
import type { PortScanner } from '../PortScanner'
import type { ScannerCache } from '../ScannerCache'
import type { SystemProcessScanner } from '../SystemProcessScanner'
import type { ToolMonitor } from '../ToolMonitor'
import type { WindowManager } from '../WindowManager'

export type ScannerRegistryKind =
  | 'aiTask'
  | 'backgroundScannerManager'
  | 'port'
  | 'process'
  | 'scannerCache'
  | 'toolMonitor'
  | 'window'

export interface ScannerRegistryEntries {
  aiTask: AITaskTracker
  backgroundScannerManager: BackgroundScannerManager
  port: PortScanner
  process: SystemProcessScanner
  scannerCache: ScannerCache
  toolMonitor: ToolMonitor
  window: WindowManager
}

export interface ScannerRegistrySnapshotRow {
  kind: ScannerRegistryKind
  instanceType: string
}

export class ScannerRegistry {
  private static sharedInstance: ScannerRegistry | null = null

  private readonly entries = new Map<ScannerRegistryKind, ScannerRegistryEntries[ScannerRegistryKind]>()

  static getInstance(): ScannerRegistry
  static getInstance<K extends ScannerRegistryKind>(kind: K): ScannerRegistryEntries[K] | null
  static getInstance<K extends ScannerRegistryKind>(kind?: K): ScannerRegistry | ScannerRegistryEntries[K] | null {
    const registry = this.sharedInstance ?? (this.sharedInstance = new ScannerRegistry())
    if (kind) {
      return registry.get(kind)
    }
    return registry
  }

  register<K extends ScannerRegistryKind>(kind: K, instance: ScannerRegistryEntries[K]): ScannerRegistryEntries[K] {
    const existing = this.entries.get(kind)
    if (existing && existing !== instance) {
      console.warn(`ScannerRegistry: replacing existing "${kind}" instance`)
    }

    this.entries.set(kind, instance)
    return instance
  }

  get<K extends ScannerRegistryKind>(kind: K): ScannerRegistryEntries[K] | null {
    return (this.entries.get(kind) as ScannerRegistryEntries[K] | undefined) ?? null
  }

  has(kind: ScannerRegistryKind): boolean {
    return this.entries.has(kind)
  }

  clear(): void {
    this.entries.clear()
  }

  snapshot(): ScannerRegistrySnapshotRow[] {
    return Array.from(this.entries.entries()).map(([kind, instance]) => ({
      kind,
      instanceType: instance.constructor?.name ?? 'UnknownInstance'
    }))
  }
}

export function getScannerRegistry(): ScannerRegistry {
  return ScannerRegistry.getInstance()
}

export function resetScannerRegistryForTests(): void {
  ScannerRegistry.getInstance().clear()
}
