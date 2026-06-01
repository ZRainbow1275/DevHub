import { describe, expect, it } from 'vitest'
import { resolveRendererIcon } from '../icon/IconResolver'
import { LEGACY_ICON_TOKENS } from './index'

// Guard against the "?" fallback regression: every semantic legacy icon token
// must resolve to a registered renderer icon (available === true), never fall
// back to ICON_FALLBACK_TOKEN (HelpCircle, the "?" circle). Adding a new entry
// to LEGACY_ICON_TOKENS without registering its glyph in registry.tsx will fail
// here instead of silently shipping a help-circle placeholder.
describe('LEGACY_ICON_TOKENS registry coverage', () => {
  const entries = Object.entries(LEGACY_ICON_TOKENS)

  it.each(entries)('resolves %s (%s) without falling back', (_name, token) => {
    const resolution = resolveRendererIcon(token)
    expect(resolution.available, `icon token ${token} is not registered in RENDERER_ICON_REGISTRY`).toBe(true)
    expect(resolution.fallbackToken).toBeNull()
    expect(resolution.token).toBe(token)
  })
})
