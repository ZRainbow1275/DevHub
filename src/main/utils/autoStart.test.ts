import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'
import { applyAutoStartSetting, readAutoStartSetting, reconcileAutoStartOnBoot } from './autoStart'

const mockedApp = app as unknown as {
  setLoginItemSettings?: ((settings: { openAtLogin: boolean }) => void) | undefined
  getLoginItemSettings?: (() => { openAtLogin: boolean }) | undefined
}

describe('autoStart helpers', () => {
  let originalSet: typeof mockedApp.setLoginItemSettings
  let originalGet: typeof mockedApp.getLoginItemSettings

  beforeEach(() => {
    originalSet = mockedApp.setLoginItemSettings
    originalGet = mockedApp.getLoginItemSettings
  })

  afterEach(() => {
    mockedApp.setLoginItemSettings = originalSet
    mockedApp.getLoginItemSettings = originalGet
    vi.restoreAllMocks()
  })

  it('applies the login item setting when enabling auto-start', () => {
    const setLoginItemSettings = vi.fn()
    mockedApp.setLoginItemSettings = setLoginItemSettings

    expect(applyAutoStartSetting(true)).toBe(true)
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  })

  it('applies the login item setting when disabling auto-start', () => {
    const setLoginItemSettings = vi.fn()
    mockedApp.setLoginItemSettings = setLoginItemSettings

    expect(applyAutoStartSetting(false)).toBe(true)
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false })
  })

  it('degrades to false (no crash) when setLoginItemSettings is unavailable (e.g. Linux)', () => {
    mockedApp.setLoginItemSettings = undefined
    expect(applyAutoStartSetting(true)).toBe(false)
  })

  it('degrades to false (no crash) when setLoginItemSettings throws', () => {
    mockedApp.setLoginItemSettings = vi.fn(() => {
      throw new Error('not supported on this platform')
    })
    expect(() => applyAutoStartSetting(true)).not.toThrow()
    expect(applyAutoStartSetting(true)).toBe(false)
  })

  it('reads back the current login item state', () => {
    mockedApp.getLoginItemSettings = vi.fn(() => ({ openAtLogin: true }))
    expect(readAutoStartSetting()).toBe(true)
  })

  it('returns null when getLoginItemSettings is unavailable', () => {
    mockedApp.getLoginItemSettings = undefined
    expect(readAutoStartSetting()).toBeNull()
  })

  it('returns null when getLoginItemSettings throws', () => {
    mockedApp.getLoginItemSettings = vi.fn(() => {
      throw new Error('boom')
    })
    expect(readAutoStartSetting()).toBeNull()
  })

  it('reconciles boot state by writing only when the OS state differs', () => {
    const setLoginItemSettings = vi.fn()
    mockedApp.getLoginItemSettings = vi.fn(() => ({ openAtLogin: false }))
    mockedApp.setLoginItemSettings = setLoginItemSettings

    reconcileAutoStartOnBoot(true)
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  })

  it('reconcile is a no-op when the OS state already matches', () => {
    const setLoginItemSettings = vi.fn()
    mockedApp.getLoginItemSettings = vi.fn(() => ({ openAtLogin: true }))
    mockedApp.setLoginItemSettings = setLoginItemSettings

    reconcileAutoStartOnBoot(true)
    expect(setLoginItemSettings).not.toHaveBeenCalled()
  })

  it('reconcile still writes when the OS state cannot be read', () => {
    const setLoginItemSettings = vi.fn()
    mockedApp.getLoginItemSettings = undefined
    mockedApp.setLoginItemSettings = setLoginItemSettings

    reconcileAutoStartOnBoot(true)
    expect(setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  })
})
