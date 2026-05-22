import fs from 'fs'
import os from 'os'
import path from 'path'
import Store from 'electron-store'
import { describe, expect, it } from 'vitest'
import { a11yPrefsSchema, type A11yPrefs } from '@shared/schemas/r8-runtime'
import { A11ySelfCheck } from './A11ySelfCheck'

function createStore() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'devhub-a11y-'))
  return new Store<{ prefs: A11yPrefs }>({
    cwd,
    name: 'a11y-test',
    defaults: { prefs: a11yPrefsSchema.parse({}) },
  })
}

describe('A11ySelfCheck', () => {
  it('defaults to safe persisted prefs and saves explicit user prefs', () => {
    const service = new A11ySelfCheck(createStore(), () => ({
      reducedMotion: false,
      highContrast: false,
      forcedColors: false,
    }))

    expect(service.getPrefs()).toEqual(a11yPrefsSchema.parse({}))

    const saved = service.setPrefs({
      ...service.getPrefs(),
      reducedMotion: true,
      largeText: true,
      focusRingThickness: 'thick',
    })

    expect(saved.reducedMotion).toBe(true)
    expect(saved.largeText).toBe(true)
    expect(service.getPrefs().focusRingThickness).toBe('thick')
  })

  it('reads OS preferences through the injected reader', () => {
    const service = new A11ySelfCheck(createStore(), () => ({
      reducedMotion: true,
      highContrast: true,
      forcedColors: true,
    }))

    expect(service.getOsPrefs()).toEqual({
      reducedMotion: true,
      highContrast: true,
      forcedColors: true,
    })
  })

  it('does not fake an axe pass during the main-process self-check', () => {
    const service = new A11ySelfCheck(
      createStore(),
      () => ({ reducedMotion: false, highContrast: false, forcedColors: false }),
      () => 123
    )

    const result = service.runSelfCheck()

    expect(result.ts).toBe(123)
    expect(result.axeExecuted).toBe(false)
    expect(result.axeViolations).toEqual([])
    expect(result.passed).toBe(false)
    expect(result.warnings.some((warning) => warning.includes('pnpm a11y:audit'))).toBe(true)
  })
})
