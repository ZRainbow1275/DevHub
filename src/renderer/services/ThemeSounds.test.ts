import { beforeEach, describe, expect, it, vi } from 'vitest'

const { FakeHowl } = vi.hoisted(() => {
  class HoistedFakeHowl {
    static created: HoistedFakeHowl[] = []
    readonly play = vi.fn()
    readonly unload = vi.fn()

    constructor() {
      HoistedFakeHowl.created.push(this)
    }
  }
  return { FakeHowl: HoistedFakeHowl }
})

vi.mock('howler', () => ({
  Howl: FakeHowl
}))

import { ThemeSoundManager, defaultThemeSoundConfig } from './ThemeSounds'

describe('ThemeSounds', () => {
  beforeEach(() => {
    FakeHowl.created = []
  })

  it('builds theme-specific local tone defaults without enabling playback by default', () => {
    const config = defaultThemeSoundConfig('cyberpunk')

    expect(config.enabled).toBe(false)
    expect(config.events.hover).toMatch(/^data:audio\/wav;base64,/)
    expect(config.events.click).toBe(config.events.hover)
  })

  it('loads and plays configured sounds through Howler when enabled', () => {
    const manager = new ThemeSoundManager()
    manager.load({
      ...defaultThemeSoundConfig('cyberpunk'),
      enabled: true
    })

    expect(FakeHowl.created.length).toBeGreaterThan(0)
    expect(manager.play('cyberpunk', 'hover')).toBe(true)
    expect(FakeHowl.created[0]?.play).toHaveBeenCalledTimes(1)
    manager.dispose()
    expect(FakeHowl.created[0]?.unload).toHaveBeenCalledTimes(1)
  })

  it('fails closed when Howler playback throws', () => {
    const manager = new ThemeSoundManager()
    manager.load({
      ...defaultThemeSoundConfig('cyberpunk'),
      enabled: true
    })
    FakeHowl.created[0]?.play.mockImplementationOnce(() => {
      throw new Error('decode failed')
    })

    expect(manager.play('cyberpunk', 'hover')).toBe(false)
    expect(FakeHowl.created[0]?.unload).toHaveBeenCalledTimes(1)
    expect(manager.play('cyberpunk', 'hover')).toBe(false)
  })
})
