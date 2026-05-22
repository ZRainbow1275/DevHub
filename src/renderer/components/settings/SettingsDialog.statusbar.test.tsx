import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/types'
import type { CustomCommand, StatusbarConfig } from '@shared/schemas/r8-runtime'
import { createEmptyStatusAggregate, STATUSBAR_CONFIG_CHANGE_EVENT } from '../statusbar/statusbar-model'
import { AnnouncementProvider } from '../a11y/AnnouncementProvider'
import { LocaleProvider } from '../i18n/LocaleProvider'
import { DEFAULT_A11Y_OS_PREFS, DEFAULT_A11Y_PREFS } from '../../utils/a11y-checks'
import { SettingsDialog } from './SettingsDialog'

function buildStatusbarConfig(): StatusbarConfig {
  const aggregate = createEmptyStatusAggregate(1000)
  return {
    updatedAt: 1000,
    tiles: aggregate.tiles
  }
}

function installDevhubMock(config: StatusbarConfig) {
  const setConfig = vi.fn(async (nextConfig: StatusbarConfig) => nextConfig)
  const reset = vi.fn(async () => config)
  const getConfig = vi.fn(async () => config)
  const getSettings = vi.fn(async () => DEFAULT_SETTINGS)
  const updateSettings = vi.fn(async () => DEFAULT_SETTINGS)
  const getDrives = vi.fn(async () => ['C', 'D'])
  const getFlag = vi.fn(async () => true)
  const setFlag = vi.fn(async (flag: string, value: boolean, confirmedBy?: string) => ({ flag, value, confirmedBy: confirmedBy ?? null }))
  const checkedAt = Date.now()
  const toolResults = (['codex', 'claude', 'gemini', 'cursor', 'copilot'] as const).map(tool => ({
    tool,
    found: false,
    version: null,
    path: null,
    detectStrategy: 'not-found' as const,
    recommendedParser: null,
    capabilities: [],
    errors: [],
    error: null,
    checkedAt,
    detectedAt: checkedAt
  }))

  Object.defineProperty(window, 'devhub', {
    value: {
      settings: { get: getSettings, update: updateSettings },
      system: { getDrives },
      i18n: {
        getLocale: vi.fn(async () => ({ locale: 'zh-CN' })),
        setLocale: vi.fn(async (locale: 'zh-CN' | 'en-US') => ({ success: true, locale })),
        listLocales: vi.fn(async () => ({ manifest: [] }))
      },
      r8: {
        integrations: { getFlag, setFlag, listLibraries: vi.fn(async () => []), healthCheck: vi.fn(async () => ({ checkedAt, featureFlags: 1, ipcChannels: 1, schemas: 1, popouts: 0, stores: [] })) },
        statusbar: { getConfig, setConfig, reset },
        cli: {
          detectAll: vi.fn(async () => ({ results: toolResults, lastFullScanAt: checkedAt, scanDurationMs: 0, errors: [] })),
          setToolOverride: vi.fn(async (tool: string, path: string) => ({ tool, path, version: null })),
          clearToolOverride: vi.fn(async (tool: string) => ({ tool, cleared: false, previousPath: null })),
          onDetectionEvent: vi.fn(() => () => undefined)
        },
        a11y: {
          getPrefs: vi.fn(async () => DEFAULT_A11Y_PREFS),
          setPrefs: vi.fn(async () => DEFAULT_A11Y_PREFS),
          osPrefs: vi.fn(async () => DEFAULT_A11Y_OS_PREFS),
          runSelfCheck: vi.fn(async () => ({
            axeExecuted: false,
            passed: true,
            axeViolations: [],
            contrastFailures: [],
            keyboardUnreachable: [],
            warnings: []
          }))
        }
      }
    } as unknown as Window['devhub'],
    writable: true,
    configurable: true
  })

  return { getConfig, getFlag, reset, setConfig, setFlag }
}

describe('R8.B SettingsDialog statusbar controls', () => {
  it('persists tile visibility through the statusbar config bridge and dispatches a local update event', async () => {
    const config = buildStatusbarConfig()
    const bridge = installDevhubMock(config)
    const listener = vi.fn()
    window.addEventListener(STATUSBAR_CONFIG_CHANGE_EVENT, listener)

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    await screen.findByTestId('statusbar-tile-settings')
    const cpuTile = screen.getByTestId('statusbar-setting-tile-cpu').firstElementChild
    expect(cpuTile).toBeInstanceOf(HTMLElement)
    fireEvent.click(cpuTile as HTMLElement)

    await waitFor(() => expect(bridge.setConfig).toHaveBeenCalledTimes(1))
    expect(bridge.setConfig.mock.calls[0][0].tiles.find(tile => tile.id === 'cpu')).toMatchObject({ visible: false })
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener(STATUSBAR_CONFIG_CHANGE_EVENT, listener)
  })

  it('resets statusbar config with an explicit SettingsDialog confirmation token', async () => {
    const config = buildStatusbarConfig()
    const bridge = installDevhubMock(config)

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    await screen.findByTestId('statusbar-config-reset')
    fireEvent.click(screen.getByTestId('statusbar-config-reset'))

    await waitFor(() => expect(bridge.reset).toHaveBeenCalledWith('settings-dialog'))
  })

  it('persists drag-and-drop tile order through the same statusbar config bridge', async () => {
    const config = buildStatusbarConfig()
    const bridge = installDevhubMock(config)

    render(<SettingsDialog isOpen onClose={vi.fn()} />)

    const cmdkTile = await screen.findByTestId('statusbar-setting-tile-cmdk')
    const cpuTile = screen.getByTestId('statusbar-setting-tile-cpu')
    fireEvent.dragStart(cmdkTile)
    fireEvent.dragOver(cpuTile)
    fireEvent.drop(cpuTile)

    await waitFor(() => expect(bridge.setConfig).toHaveBeenCalledTimes(1))
    const savedConfig = bridge.setConfig.mock.calls[0][0]
    expect([...savedConfig.tiles].sort((left, right) => left.order - right.order).map(tile => tile.id).slice(0, 2)).toEqual(['cmdk', 'cpu'])
  })

  it('saves custom command entries through the real command bridge contract from Advanced settings', async () => {
    const config = buildStatusbarConfig()
    installDevhubMock(config)
    let commands: CustomCommand[] = []
    const listCustom = vi.fn(async () => ({ commands }))
    const saveCustom = vi.fn(async (command: Pick<CustomCommand, 'id' | 'label' | 'handlerScript'> & Partial<Pick<CustomCommand, 'enabled' | 'shortcut' | 'confirmedBy'>>) => {
      const saved: CustomCommand = {
        id: command.id,
        label: command.label,
        handlerScript: command.handlerScript,
        shortcut: command.shortcut ?? [],
        enabled: command.enabled ?? true,
        confirmedBy: command.confirmedBy ?? null,
        savedAt: 1234
      }
      commands = [saved]
      return { success: true, command: saved }
    })
    const devhub = window.devhub as unknown as {
      r8: {
        command?: {
          listCustom: typeof listCustom
          saveCustom: typeof saveCustom
        }
      }
    }
    devhub.r8.command = { listCustom, saveCustom }

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /高级/ }))
    await screen.findByTestId('custom-command-manager')
    fireEvent.change(screen.getByTestId('custom-command-id'), { target: { value: 'custom.open-dashboard' } })
    fireEvent.change(screen.getByTestId('custom-command-label'), { target: { value: 'Open Dashboard' } })
    fireEvent.change(screen.getByTestId('custom-command-handler'), { target: { value: 'command:dashboard.open' } })
    fireEvent.change(screen.getByTestId('custom-command-shortcut'), { target: { value: 'Ctrl+Shift+D' } })
    fireEvent.click(screen.getByTestId('custom-command-save'))

    await waitFor(() => expect(saveCustom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'custom.open-dashboard',
      label: 'Open Dashboard',
      handlerScript: 'command:dashboard.open',
      shortcut: ['Ctrl', 'Shift', 'D'],
      enabled: true,
      confirmedBy: 'settings-dialog'
    })))
    await screen.findByTestId('custom-command-row-custom.open-dashboard')
    expect(listCustom).toHaveBeenCalled()
  })

  it('persists the dashboard grid feature flag from Advanced settings', async () => {
    const config = buildStatusbarConfig()
    const bridge = installDevhubMock(config)

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /高级/ }))
    await screen.findByTestId('settings-dashboard-grid-flag')
    await waitFor(() => expect(bridge.getFlag).toHaveBeenCalledWith('R8.B.dashboard.grid'))
    fireEvent.click(screen.getByTestId('settings-dashboard-grid-flag'))

    await waitFor(() => expect(bridge.setFlag).toHaveBeenCalledWith('R8.B.dashboard.grid', false, 'settings-dialog'))
  })

  it('renders the in-app About fair-use notice from Advanced settings', async () => {
    installDevhubMock(buildStatusbarConfig())

    render(
      <LocaleProvider>
        <AnnouncementProvider>
          <SettingsDialog isOpen onClose={vi.fn()} />
        </AnnouncementProvider>
      </LocaleProvider>
    )

    fireEvent.click(await screen.findByRole('button', { name: /高级/ }))
    const notice = await screen.findByTestId('settings-about-fair-use')

    expect(notice).toHaveTextContent('厂商名称与 logo')
    expect(notice).toHaveTextContent('OpenAI')
    expect(notice).toHaveTextContent('不表示赞助、背书、授权代理或商业从属关系')
    expect(notice).toHaveTextContent('AGPL-3.0')
    expect(notice).toHaveTextContent('trademark and fair-use notice')
  })
})
