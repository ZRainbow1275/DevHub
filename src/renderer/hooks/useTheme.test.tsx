import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, APP_SETTINGS_CHANGE_EVENT, type AppSettings } from '@shared/types'
import type { PopoutBridgeMessage } from '@shared/schemas/r8-runtime'
import { useTheme } from './useTheme'

function ThemeProbe() {
  useTheme()
  return <div data-testid="theme-probe" />
}

function ThemeActionProbe() {
  const { setTheme } = useTheme()
  return (
    <button type="button" onClick={() => { void setTheme('modern-light') }}>
      Set modern light
    </button>
  )
}

function DensityActionProbe() {
  const { setDensity } = useTheme()
  return (
    <button type="button" onClick={() => { void setDensity('comfortable') }}>
      Set comfortable density
    </button>
  )
}

function MotionActionProbe() {
  const { setMotionLevel } = useTheme()
  return (
    <button type="button" onClick={() => { void setMotionLevel('expressive') }}>
      Set expressive motion
    </button>
  )
}

function installDevhub(settings: AppSettings = DEFAULT_SETTINGS) {
  const settingsGet = vi.fn(async () => settings)
  const settingsUpdate = vi.fn()
  const onBridgeMessage = vi.fn()
  Object.defineProperty(window, 'devhub', {
    configurable: true,
    value: {
      settings: {
        get: settingsGet,
        update: settingsUpdate
      },
      r8: {
        popout: {
          onBridgeMessage
        }
      }
    }
  })
  return { settingsGet, settingsUpdate, onBridgeMessage }
}

function installSlowFonts() {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: vi.fn(() => new Promise<FontFace[]>(() => {}))
    }
  })
}

function installMatchMedia(options: boolean | { light?: boolean; reducedMotion?: boolean }) {
  const light = typeof options === 'boolean' ? options : options.light ?? false
  const reducedMotion = typeof options === 'boolean' ? false : options.reducedMotion ?? false
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes('prefers-reduced-motion')
        ? reducedMotion
        : query.includes('light')
          ? light
          : query.includes('dark')
            ? !light
            : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  })
}

describe('useTheme popout bridge sync', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-palette')
    document.documentElement.removeAttribute('data-density')
    document.documentElement.removeAttribute('data-radius-family')
    document.documentElement.removeAttribute('data-motion-level')
    document.documentElement.removeAttribute('data-theme-transitioning')
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: undefined
    })
    installMatchMedia(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('applies BrowserWindow popout theme sync messages to the renderer document', async () => {
    let bridgeCallback: ((message: PopoutBridgeMessage) => void) | null = null
    const onBridgeMessage = vi.fn((callback: (message: PopoutBridgeMessage) => void) => {
      bridgeCallback = callback
      return vi.fn()
    })
    const syncedSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        theme: 'cyberpunk',
        informationDensity: 'compact',
        radiusFamily: 'round',
        motionLevel: 'expressive'
      }
    }
    const settingsChange = vi.fn()
    window.addEventListener(APP_SETTINGS_CHANGE_EVENT, settingsChange)

    installDevhub()
    Object.defineProperty(window.devhub.r8.popout, 'onBridgeMessage', {
      configurable: true,
      value: onBridgeMessage
    })

    render(<ThemeProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      bridgeCallback?.({
        windowId: 'popout-theme-1',
        type: 'sync',
        key: 'theme-settings',
        value: {
          emittedAt: 1_000,
          settings: syncedSettings
        }
      })
    })

    expect(onBridgeMessage).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.theme).toBe('cyberpunk')
    expect(document.documentElement.dataset.palette).toBe('cyberpunk')
    expect(document.documentElement.dataset.density).toBe('compact')
    expect(document.documentElement.dataset.radiusFamily).toBe('round')
    expect(document.documentElement.dataset.motionLevel).toBe('expressive')
    expect(settingsChange).toHaveBeenCalledWith(expect.objectContaining({ detail: syncedSettings }))

    window.removeEventListener(APP_SETTINGS_CHANGE_EVENT, settingsChange)
  })

  it('applies follow-system theme settings from the current OS color scheme', async () => {
    installMatchMedia(true)
    const syncedSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        theme: 'constructivism',
        followSystemTheme: true
      }
    }

    installDevhub()

    render(<ThemeProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      window.dispatchEvent(new CustomEvent<AppSettings>(APP_SETTINGS_CHANGE_EVENT, { detail: syncedSettings }))
    })

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.palette).toBe('light')
  })

  it('applies selected theme to the document before slow font preloading finishes', async () => {
    vi.useFakeTimers()
    installSlowFonts()
    const { settingsUpdate } = installDevhub()

    render(<ThemeActionProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Set modern light' }))
    })

    expect(document.documentElement.dataset.theme).toBe('modern-light')
    expect(document.documentElement.dataset.palette).toBe('modern-light')
    expect(document.documentElement.dataset.radiusFamily).toBe('soft')
    expect(settingsUpdate).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500)
    })

    expect(settingsUpdate).toHaveBeenCalledWith({
      appearance: {
        theme: 'modern-light',
        informationDensity: 'standard',
        radiusFamily: 'soft',
        motionLevel: 'balanced'
      }
    })
  })

  it('persists explicit theme choices through settings updates for restart restore', async () => {
    const { settingsUpdate } = installDevhub()

    render(<ThemeActionProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set modern light' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(settingsUpdate).toHaveBeenCalledWith({
      appearance: {
        theme: 'modern-light',
        informationDensity: 'standard',
        radiusFamily: 'soft',
        motionLevel: 'balanced'
      }
    })
  })

  it('applies density changes immediately and persists density through settings updates', async () => {
    const { settingsUpdate } = installDevhub()

    render(<DensityActionProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set comfortable density' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(document.documentElement.dataset.density).toBe('comfortable')
    expect(settingsUpdate).toHaveBeenCalledWith({
      appearance: {
        theme: 'constructivism',
        informationDensity: 'comfortable',
        radiusFamily: 'sharp',
        motionLevel: 'balanced'
      }
    })
  })

  it('applies motion changes immediately and persists motion through settings updates', async () => {
    const { settingsUpdate } = installDevhub()

    render(<MotionActionProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Set expressive motion' }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(document.documentElement.dataset.motionLevel).toBe('expressive')
    expect(settingsUpdate).toHaveBeenCalledWith({
      appearance: {
        theme: 'constructivism',
        informationDensity: 'standard',
        radiusFamily: 'sharp',
        motionLevel: 'expressive'
      }
    })
  })

  it('forces effective reduced motion when the OS prefers reduced motion', async () => {
    installMatchMedia({ light: false, reducedMotion: true })
    const expressiveSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      appearance: {
        ...DEFAULT_SETTINGS.appearance,
        motionLevel: 'expressive'
      }
    }
    installDevhub(expressiveSettings)

    render(<ThemeProbe />)
    await act(async () => {
      await Promise.resolve()
    })

    expect(document.documentElement.dataset.motionLevel).toBe('reduced')
  })
})
