import { describe, expect, it } from 'vitest'
import { ICON_FALLBACK_TOKEN, ICON_LIBRARY_VALUES } from '@shared/icon-library'
import { IconRegistryService } from './IconRegistryService'

describe('IconRegistryService', () => {
  it('lists every approved icon library with non-empty manifests', () => {
    const service = new IconRegistryService()
    const response = service.listLibraries()

    expect(response.libraries).toEqual(ICON_LIBRARY_VALUES)
    expect(response.manifests).toHaveLength(ICON_LIBRARY_VALUES.length)
    for (const manifest of response.manifests) {
      expect(manifest.count).toBeGreaterThan(0)
      expect(manifest.usage.length).toBeGreaterThan(10)
    }
  })

  it('resolves known icon tokens without fallback', () => {
    const service = new IconRegistryService()
    const response = service.resolveToken('tabler:Settings')

    expect(response.available).toBe(true)
    expect(response.resolved).toEqual({ library: 'tabler', name: 'Settings' })
    expect(response.fallbackToken).toBeNull()
  })

  it('falls back for unknown names and malformed tokens', () => {
    const service = new IconRegistryService()

    expect(service.resolveToken('lucide:DoesNotExist')).toMatchObject({
      available: false,
      fallbackToken: ICON_FALLBACK_TOKEN,
      resolved: { library: 'lucide', name: 'HelpCircle' },
    })
    expect(service.resolveToken('bad token')).toMatchObject({
      available: false,
      fallbackToken: ICON_FALLBACK_TOKEN,
      resolved: { library: 'lucide', name: 'HelpCircle' },
    })
  })
})
