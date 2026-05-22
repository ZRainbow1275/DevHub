import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { R8CommandPalette } from './R8CommandPalette'
import i18n from '../../i18n'
import { PORT_POPOUT_REQUEST_EVENT, type PortPopoutRequestDetail } from '../popout/port-popout-events'

describe('R8CommandPalette', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('zh-CN')
    Object.assign(window.devhub, {
      r8: {
        command: {
          list: vi.fn(async () => [
            { id: 'drawer.notifications', title: '打开通知 Drawer', category: 'navigation', description: 'Open notifications', requiresConfirmation: false },
            { id: 'monitor.ai-log', title: 'Open AI log', category: 'monitor', description: 'Inspect AI event log', requiresConfirmation: false },
            { id: 'monitor.ai-task', title: 'Open AI tasks', category: 'monitor', description: 'Review AI tasks', requiresConfirmation: false },
            { id: 'ai.tasks.open', title: 'Open AI task actions', category: 'ai-action', description: 'Jump to the live AI task monitor', keywords: ['ai', 'codex'], requiresConfirmation: false },
            { id: 'diagnostics.export', title: 'Export diagnostics', category: 'diagnostics', description: 'Create local diagnostic bundle', requiresConfirmation: false },
            { id: 'topology.flow', title: '打开全局流程图', category: 'navigation', description: 'Open the fullscreen topology view directly in flow graph mode', keywords: ['topology', 'flow', '流程图', '关系', 'liucheng'], requiresConfirmation: false },
            { id: 'port.blocklist.add', title: 'Block public port', category: 'port', description: 'Add a suspicious public port to the blocklist', keywords: ['security'], requiresConfirmation: true },
            { id: 'process.view.tree', title: 'View process tree', category: 'process', description: 'Inspect process hierarchy', requiresConfirmation: false },
            { id: 'window.focus', title: 'Focus active window', category: 'window', description: 'Bring a native window to front', requiresConfirmation: false },
            { id: 'theme.apply.constructivism', title: '切换主题：Constructivism Command', category: 'settings', description: 'Apply the constructivism theme', keywords: ['theme', '主题'], requiresConfirmation: false },
            { id: 'settings.open', title: 'Open settings', category: 'settings', description: 'Configure DevHub preferences', requiresConfirmation: false }
          ]),
          invoke: vi.fn(async (commandId: string) => ({ success: true, commandId })),
          resolveUri: vi.fn(async () => ({
            kind: 'port',
            id: '3000',
            uri: { scheme: 'devhub', scope: 'port', id: '3000', host: 'local', fallback: {} },
            monitor: 'monitor',
            panel: 'port',
            exists: true,
            fallbackUsed: false,
            candidateCount: 1
          })),
          history: vi.fn(async () => []),
          clearHistory: vi.fn(),
          onEvent: vi.fn()
        }
      }
    })
  })

  function renderPalette(onClose: () => void, returnFocusTo?: HTMLElement | null) {
    return render(
      <I18nextProvider i18n={i18n}>
        <R8CommandPalette open onClose={onClose} returnFocusTo={returnFocusTo} />
      </I18nextProvider>
    )
  }

  it('renders cmdk groups and resolves devhub URI input through IPC', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)

    expect(await screen.findByTestId('command-palette')).toBeInTheDocument()
    expect(await screen.findByTestId('cmdk-group-navigation')).toBeInTheDocument()
    expect(await screen.findByRole('listbox', { name: '跳转 commands' })).toBeInTheDocument()
    expect(document.querySelector('[data-icon-token="lucide:Search"]')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'devhub://port/3000' }
    })

    fireEvent.click(await screen.findByText('解析并跳转 URI'))

    await waitFor(() => expect(window.devhub.r8.command.resolveUri).toHaveBeenCalledWith('devhub://port/3000'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('restores focus to the previously active element when Escape closes the palette', async () => {
    const returnFocusButton = document.createElement('button')
    returnFocusButton.type = 'button'
    returnFocusButton.textContent = 'Return focus target'
    document.body.appendChild(returnFocusButton)
    returnFocusButton.focus()

    const onClose = vi.fn()
    renderPalette(onClose, returnFocusButton)
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(returnFocusButton).toHaveFocus())
    returnFocusButton.remove()
  })

  it('invokes the backend BrowserWindow popout command for `popout <port>` queries', async () => {
    const onClose = vi.fn()
    const received: PortPopoutRequestDetail[] = []
    const listener = (event: Event) => {
      received.push((event as CustomEvent<PortPopoutRequestDetail>).detail)
    }
    window.addEventListener(PORT_POPOUT_REQUEST_EVENT, listener)

    renderPalette(onClose)

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'popout 3000' }
    })

    fireEvent.click(await screen.findByTestId('cmdk-port-popout-trigger'))

    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('popout.port', { port: 3000 }))
    expect(received).toEqual([])
    expect(onClose).toHaveBeenCalledTimes(1)

    window.removeEventListener(PORT_POPOUT_REQUEST_EVENT, listener)
  })

  it('keeps the renderer port popout fallback when the backend command rejects', async () => {
    vi.mocked(window.devhub.r8.command.invoke).mockImplementation(async (commandId: string) => {
      if (commandId === 'popout.port') throw new Error('backend popout unavailable')
      return { success: true, commandId }
    })
    const onClose = vi.fn()
    const received: PortPopoutRequestDetail[] = []
    const listener = (event: Event) => {
      received.push((event as CustomEvent<PortPopoutRequestDetail>).detail)
    }
    window.addEventListener(PORT_POPOUT_REQUEST_EVENT, listener)

    renderPalette(onClose)

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'popout 3001' }
    })

    fireEvent.click(await screen.findByTestId('cmdk-port-popout-trigger'))

    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('popout.port', { port: 3001 }))
    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('monitor.port'))
    await waitFor(() => expect(received).toEqual([{ port: 3001, trigger: 'cmdk' }]))
    expect(onClose).toHaveBeenCalledTimes(1)

    window.removeEventListener(PORT_POPOUT_REQUEST_EVENT, listener)
  })

  it('shows persisted recent command history and invokes the selected command', async () => {
    vi.mocked(window.devhub.r8.command.history).mockResolvedValue([
      { commandId: 'monitor.ai-task', invokedAt: 1_700_000_000_000, confirmedBy: null, useCount: 3 }
    ])
    const onClose = vi.fn()
    renderPalette(onClose)

    const historyGroup = await screen.findByTestId('cmdk-group-history')
    expect(within(historyGroup).getByText('Open AI tasks')).toBeInTheDocument()
    expect(within(historyGroup).getByText(/最近使用 3 次/)).toBeInTheDocument()

    fireEvent.click(within(historyGroup).getByText('Open AI tasks'))

    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('monitor.ai-task'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('satisfies ASSERT_COMMAND_PALETTE_5_SCOPES with visible history, command, jump, AI action, and settings groups', async () => {
    vi.mocked(window.devhub.r8.command.history).mockResolvedValue([
      { commandId: 'monitor.ai-task', invokedAt: 1_700_000_000_000, confirmedBy: null, useCount: 3 }
    ])
    const onClose = vi.fn()
    renderPalette(onClose)

    const requiredGroups = [
      { category: 'history', label: '最近', icon: 'lucide:List' },
      { category: 'monitor', label: '命令', icon: 'lucide:Terminal' },
      { category: 'navigation', label: '跳转', icon: 'lucide:ExternalLink' },
      { category: 'ai-action', label: 'AI 动作', icon: 'lucide:Bot' },
      { category: 'settings', label: '设置', icon: 'lucide:Settings' }
    ] as const

    for (const groupSpec of requiredGroups) {
      const group = await screen.findByTestId(`cmdk-group-${groupSpec.category}`)
      const heading = within(group).getByTestId(`cmdk-group-${groupSpec.category}-heading`)
      expect(heading).toHaveTextContent(groupSpec.label)
      expect(within(group).getByTestId(`cmdk-group-${groupSpec.category}-count`)).toHaveTextContent(/^[1-9]\d*$/)
      expect(group.querySelector(`[data-icon-token="${groupSpec.icon}"]`)).toBeInTheDocument()
      expect(within(group).getAllByRole('option').length).toBeGreaterThan(0)
    }
  })

  it('exposes process, port, window, AI, theme, settings, and command source groups', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)

    const sourceGroups = [
      { category: 'monitor', title: 'Open AI tasks' },
      { category: 'ai-action', title: 'Open AI task actions' },
      { category: 'port', title: 'Block public port' },
      { category: 'process', title: 'View process tree' },
      { category: 'window', title: 'Focus active window' },
      { category: 'settings', title: '切换主题：Constructivism Command' }
    ] as const

    for (const sourceGroup of sourceGroups) {
      const group = await screen.findByTestId(`cmdk-group-${sourceGroup.category}`)
      expect(within(group).getByText(sourceGroup.title)).toBeInTheDocument()
    }
  })

  it.each([
    {
      prefix: '>',
      label: '动作范围',
      visible: ['打开通知 Drawer', 'Open AI log', 'Open AI tasks', 'Export diagnostics'],
      hidden: ['Open AI task actions', 'Block public port', 'View process tree', 'Focus active window', '切换主题：Constructivism Command', 'Open settings']
    },
    {
      prefix: '@',
      label: 'AI 范围',
      visible: ['Open AI log', 'Open AI tasks', 'Open AI task actions'],
      hidden: ['打开通知 Drawer', 'Export diagnostics', 'Block public port', 'View process tree', 'Focus active window', '切换主题：Constructivism Command', 'Open settings']
    },
    {
      prefix: '#',
      label: '对象范围',
      visible: ['Block public port', 'View process tree', 'Focus active window'],
      hidden: ['打开通知 Drawer', 'Open AI log', 'Open AI tasks', 'Open AI task actions', 'Export diagnostics', '切换主题：Constructivism Command', 'Open settings']
    },
    {
      prefix: '!',
      label: '确认范围',
      visible: ['Block public port'],
      hidden: ['打开通知 Drawer', 'Open AI log', 'Open AI tasks', 'Open AI task actions', 'Export diagnostics', 'View process tree', 'Focus active window', '切换主题：Constructivism Command', 'Open settings']
    }
  ])('filters command categories with the $prefix scope prefix', async ({ prefix, label, visible, hidden }) => {
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: prefix }
    })

    expect(await screen.findByTestId('cmdk-scope-filter')).toHaveTextContent(label)
    for (const title of visible) {
      expect(screen.getByText(title)).toBeInTheDocument()
    }
    for (const title of hidden) {
      expect(screen.queryByText(title)).not.toBeInTheDocument()
    }
  })

  it('uses Fuse search for typo-tolerant command filtering', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'notificaton' }
    })

    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()
    expect(screen.queryByText('Open settings')).not.toBeInTheDocument()
  })

  it('finds the global flow graph command by pinyin keyword', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'liucheng' }
    })

    fireEvent.click(await screen.findByText('打开全局流程图'))

    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('topology.flow'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it.each(['图', 'topology', '关系'])('finds topology commands by %s keyword', async (keyword) => {
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: keyword }
    })

    const options = await screen.findAllByRole('option')
    expect(options.some(option => option.textContent?.includes('打开全局流程图'))).toBe(true)
  })

  it('finds theme switching commands by Chinese and English keywords', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    const findThemeOption = async () => {
      const options = await screen.findAllByRole('option')
      const option = options.find(item => item.textContent?.includes('切换主题：Constructivism Command'))
      expect(option).toBeDefined()
      return option as HTMLElement
    }
    expect(await screen.findByText('打开通知 Drawer')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: '主题' }
    })
    expect(await findThemeOption()).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'theme' }
    })
    fireEvent.click(await findThemeOption())

    await waitFor(() => expect(window.devhub.r8.command.invoke).toHaveBeenCalledWith('theme.apply.constructivism'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders Fuse title match ranges without replacing the command text', async () => {
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('Open AI log')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'open ai' }
    })

    const monitorGroup = await screen.findByTestId('cmdk-group-monitor')
    const option = within(monitorGroup).getAllByRole('option').find(item => item.textContent?.includes('Open AI log'))
    expect(option).toBeDefined()
    expect(within(option as HTMLElement).getAllByTestId('cmdk-match-highlight').map(node => node.textContent)).toEqual(expect.arrayContaining(['Open AI ']))
  })

  it('boosts matching commands that have stronger persisted history', async () => {
    vi.mocked(window.devhub.r8.command.history).mockResolvedValue([
      { commandId: 'monitor.ai-task', invokedAt: 1_700_000_000_000, confirmedBy: null, useCount: 10 }
    ])
    const onClose = vi.fn()
    renderPalette(onClose)
    expect(await screen.findByText('Open AI log')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText(/命令|command/i), {
      target: { value: 'open ai' }
    })

    const monitorGroup = await screen.findByTestId('cmdk-group-monitor')
    const aiTitles = within(monitorGroup).getAllByRole('option')
      .map(option => option.textContent?.replace(/\s+/g, ' ').trim() ?? '')
      .filter(text => text.startsWith('Open AI'))
      .map(text => text.startsWith('Open AI tasks') ? 'Open AI tasks' : text.startsWith('Open AI log') ? 'Open AI log' : text)
    expect(aiTitles).toEqual(['Open AI tasks', 'Open AI log'])
  })
})
