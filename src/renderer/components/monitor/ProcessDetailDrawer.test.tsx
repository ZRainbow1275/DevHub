import type { ComponentProps } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AccessReport, ProcessInfo } from '@shared/types-extended'
import type { ProcessHistory } from '@shared/schemas/r8-runtime'
import { ProcessDetailDrawer } from './ProcessDetailDrawer'

const showToast = vi.fn()

vi.mock('../ui/Toast', () => ({
  useToast: () => ({ showToast })
}))

const baseProcessInfo: ProcessInfo = {
  pid: 9148,
  name: 'svchost.exe',
  command: 'C:/Windows/System32/svchost.exe -k netsvcs',
  cpu: 1.2,
  memory: 128,
  status: 'running',
  startTime: 1713830400000,
  type: 'other',
  workingDir: 'C:/Windows/System32'
}

const accessDeniedReport: AccessReport = {
  pid: 9148,
  elevationRequired: true,
  scanAttempted: true,
  scanResult: 'access-denied',
  currentUser: 'HP/User',
  targetProcessUser: 'NT AUTHORITY/SYSTEM',
  suggestion: 'relaunch-as-admin',
  triedAt: 1713830400000
}

const processHistory24h: ProcessHistory = {
  key: 'history-key',
  exe: 'svchost.exe',
  cwd: 'C:/Windows/System32',
  windowMs: 86_400_000,
  points: [
    { ts: 1713830400000, cpu: 1.5, rssMb: 128, handles: 50, threads: 8, missing: false },
    { ts: 1713830460000, cpu: 2.5, rssMb: 144, handles: 52, threads: 9, missing: false },
  ],
}

function renderDrawer(overrides: Partial<ComponentProps<typeof ProcessDetailDrawer>> = {}) {
  const props: ComponentProps<typeof ProcessDetailDrawer> = {
    pid: baseProcessInfo.pid,
    basicProcessInfo: baseProcessInfo,
    onClose: vi.fn(),
    fetchDeepDetail: vi.fn().mockResolvedValue(null),
    probeAccess: vi.fn().mockResolvedValue(accessDeniedReport),
    fetchConnections: vi.fn().mockResolvedValue([]),
    fetchEnvironment: vi.fn().mockResolvedValue({ variables: {}, requiresElevation: false }),
    fetchHistory: vi.fn().mockResolvedValue({ cpuHistory: [], memoryHistory: [] }),
    fetchHistory24h: vi.fn().mockResolvedValue(processHistory24h),
    fetchModules: vi.fn().mockResolvedValue({ modules: [], requiresElevation: false }),
    onRelaunchAsAdmin: vi.fn().mockResolvedValue({ ok: true }),
    onKillProcess: vi.fn().mockResolvedValue(false),
    onKillTree: vi.fn().mockResolvedValue(false),
    onSetPriority: vi.fn().mockResolvedValue(false),
    onOpenFileLocation: vi.fn().mockResolvedValue(undefined),
    ...overrides
  }

  render(<ProcessDetailDrawer {...props} />)
  return props
}

describe('ProcessDetailDrawer', () => {
  beforeEach(() => {
    showToast.mockReset()
  })

  it('在 deep detail 不可用时仍渲染基础信息与权限提示', async () => {
    const props = renderDrawer()

    expect(await screen.findByTestId('process-detail-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('detail-error-only')).not.toBeInTheDocument()
    expect(screen.getByTestId('detail-field-name')).toHaveTextContent('svchost.exe')
    expect(screen.getByTestId('detail-field-pid')).toHaveTextContent('9148')
    expect(screen.getByTestId('permission-notice')).toBeInTheDocument()

    expect(props.fetchDeepDetail).toHaveBeenCalledTimes(1)
    expect(props.probeAccess).toHaveBeenCalledTimes(1)
  })

  it('支持从权限提示中重试和请求管理员重启', async () => {
    const props = renderDrawer()

    await screen.findByTestId('permission-notice')

    fireEvent.click(screen.getByRole('button', { name: '重试' }))

    await waitFor(() => {
      expect(props.fetchDeepDetail).toHaveBeenCalledTimes(2)
      expect(props.probeAccess).toHaveBeenCalledTimes(2)
    })

    fireEvent.click(screen.getByRole('button', { name: '以管理员身份重启' }))

    await waitFor(() => {
      expect(props.onRelaunchAsAdmin).toHaveBeenCalledTimes(1)
    })
  })

  it('在资源页加载真实 24h 历史并支持指标切换', async () => {
    const fetchHistory24h = vi.fn().mockResolvedValue(processHistory24h)
    const props = renderDrawer({ fetchHistory24h })

    expect(await screen.findByTestId('process-detail-panel')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '资源' }))

    await waitFor(() => {
      expect(props.fetchHistory24h).toHaveBeenCalledWith({
        name: 'svchost.exe',
        workingDir: 'C:/Windows/System32',
      })
    })

    const panel = await screen.findByTestId('process-detail-history-24h')
    expect(within(panel).getByText('24h 趋势')).toBeInTheDocument()
    expect(within(panel).getByText('采样点 2')).toBeInTheDocument()
    expect(within(panel).getByTestId('process-detail-history-24h-chart')).toHaveAttribute('data-latest', '2.5')

    fireEvent.click(within(panel).getByRole('button', { name: 'RSS' }))
    expect(within(panel).getByTestId('process-detail-history-24h-chart')).toHaveAttribute('data-latest', '144')

    fireEvent.click(within(panel).getByRole('button', { name: '句柄' }))
    expect(within(panel).getByTestId('process-detail-history-24h-chart')).toHaveAttribute('data-latest', '52')
  })
})
