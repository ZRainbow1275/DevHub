import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { StatusbarConfig } from '@shared/schemas/r8-runtime'
import { AnnouncementProvider } from '../a11y/AnnouncementProvider'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { createEmptyStatusAggregate } from '../statusbar/statusbar-model'
import { SettingsDialog } from './SettingsDialog'

function buildStatusbarConfig(): StatusbarConfig {
  const aggregate = createEmptyStatusAggregate(1000)
  return {
    updatedAt: 1000,
    tiles: aggregate.tiles
  }
}

function installThemeEditorMock() {
  const settingsUpdate = vi.fn(async () => DEFAULT_SETTINGS)
  Object.defineProperty(window, 'devhub', {
    value: {
      settings: {
        get: vi.fn(async () => DEFAULT_SETTINGS),
        update: settingsUpdate
      },
      system: {
        getDrives: vi.fn(async () => ['C'])
      },
      i18n: {
        getLocale: vi.fn(async () => ({ locale: 'zh-CN' })),
        setLocale: vi.fn(async (locale: 'zh-CN' | 'en-US') => ({ success: true, locale })),
        listLocales: vi.fn(async () => ({ manifest: [] }))
      },
      r8: {
        statusbar: {
          getConfig: vi.fn(async () => buildStatusbarConfig()),
          setConfig: vi.fn(async (config: StatusbarConfig) => config),
          reset: vi.fn(async () => buildStatusbarConfig())
        },
        themeDecoration: {
          listCustomSvg: vi.fn(async () => ({ items: [] })),
          getSoundConfig: vi.fn(async () => null),
          setSoundConfig: vi.fn(async () => undefined),
          set: vi.fn(async () => undefined)
        }
      }
    } as unknown as Window['devhub'],
    writable: true,
    configurable: true
  })
  return { settingsUpdate }
}

describe('SettingsDialog theme preview and editor', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders real preview examples and exports a .devhub-theme.json theme pack', async () => {
    installThemeEditorMock()
    const clickAnchor = vi.fn()
    let exportedAnchor: HTMLAnchorElement | undefined
    const createObjectURL = vi.fn(() => 'blob:theme-pack')
    const revokeObjectURL = vi.fn()
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL)
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = realCreateElement(tagName, options)
      if (tagName === 'a') {
        exportedAnchor = element as HTMLAnchorElement
        Object.defineProperty(element, 'click', { configurable: true, value: clickAnchor })
      }
      return element
    }) as typeof document.createElement)

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    await screen.findByTestId('theme-preview-editor')
    expect(screen.getByTestId('theme-preview-card')).toBeTruthy()
    expect(screen.getByTestId('theme-preview-button')).toBeTruthy()
    expect(screen.getByTestId('theme-preview-table')).toBeTruthy()
    expect(screen.getByTestId('theme-preview-chart')).toBeTruthy()
    expect(screen.getByTestId('holiday-theme-settings')).toBeTruthy()
    expect(screen.getByTestId('holiday-theme-list')).toHaveTextContent('spring-festival')
    expect(screen.getByTestId('holiday-theme-list')).toHaveTextContent('christmas')
    expect(screen.getByTestId('holiday-theme-list')).toHaveTextContent('halloween')

    fireEvent.change(screen.getByTestId('theme-editor-accent'), { target: { value: '#112233' } })
    expect(screen.getByTestId('theme-live-preview').getAttribute('data-accent-color')).toBe('#112233')

    fireEvent.click(screen.getByTestId('theme-pack-export'))

    await waitFor(() => expect(clickAnchor).toHaveBeenCalledTimes(1))
    expect(exportedAnchor).toBeDefined()
    expect((exportedAnchor as HTMLAnchorElement).download.endsWith('.devhub-theme.json')).toBe(true)
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:theme-pack')
  })
})
