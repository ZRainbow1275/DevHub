import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ScannerRegistryEntries } from './ScannerRegistry'
import { ScannerRegistry, resetScannerRegistryForTests } from './ScannerRegistry'

class FakeProcessScanner {}
class FakePortScanner {}

describe('ScannerRegistry', () => {
  beforeEach(() => {
    resetScannerRegistryForTests()
  })

  afterEach(() => {
    resetScannerRegistryForTests()
  })

  it('returns the same registered instance for a given kind', () => {
    const processScanner = new FakeProcessScanner() as unknown as ScannerRegistryEntries['process']
    const portScanner = new FakePortScanner() as unknown as ScannerRegistryEntries['port']

    const registry = ScannerRegistry.getInstance()
    registry.register('process', processScanner)
    registry.register('port', portScanner)

    expect(ScannerRegistry.getInstance()).toBe(registry)
    expect(ScannerRegistry.getInstance('process')).toBe(processScanner)
    expect(ScannerRegistry.getInstance('port')).toBe(portScanner)
    expect(registry.get('process')).toBe(processScanner)
    expect(registry.get('port')).toBe(portScanner)
  })

  it('captures a simple runtime snapshot for diagnostics', () => {
    const processScanner = new FakeProcessScanner() as unknown as ScannerRegistryEntries['process']

    const registry = ScannerRegistry.getInstance()
    registry.register('process', processScanner)

    expect(registry.snapshot()).toEqual([
      {
        kind: 'process',
        instanceType: 'FakeProcessScanner'
      }
    ])
  })
})
