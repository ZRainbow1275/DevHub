import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MisreportButton } from './MisreportButton'

describe('MisreportButton', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('requires a 3 second confirmation countdown before reporting real feedback', async () => {
    vi.useFakeTimers()
    const reportMisreport = vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000003' }))
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { ai: { reportMisreport } } }
    })
    const onReported = vi.fn()

    render(<MisreportButton instanceId="ai-window-1" onReported={onReported} />)

    fireEvent.click(screen.getByRole('button', { name: '标记误报' }))
    expect(screen.getByText('确认 3s')).toBeInTheDocument()
    expect(reportMisreport).not.toHaveBeenCalled()

    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
    }
    expect(screen.getByText('确认误报')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '标记误报' }))
      await Promise.resolve()
    })

    expect(reportMisreport).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'ai-window-1',
      kind: 'false-idle',
      expectedTaskState: 'running',
      confirmedBy: 'misreport-button'
    }))
    expect(onReported).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000003')
  })

  it('records correct-detection feedback with custom labels through the same local bridge', async () => {
    vi.useFakeTimers()
    const reportMisreport = vi.fn(async () => ({ id: '00000000-0000-4000-8000-000000000004' }))
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { ai: { reportMisreport } } }
    })

    render(
      <MisreportButton
        ariaLabel="标记检测正确"
        armedLabel="确认正确"
        idleLabel="正确"
        instanceId="ai-window-2"
        kind="correct-detection"
        expectedTaskState="thinking"
        successMessage="正确反馈已记录"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '标记检测正确' }))
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
    }
    expect(screen.getByText('确认正确')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '标记检测正确' }))
      await Promise.resolve()
    })

    expect(reportMisreport).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'ai-window-2',
      kind: 'correct-detection',
      expectedTaskState: 'thinking',
      confirmedBy: 'misreport-button'
    }))
    expect(screen.getByText('正确反馈已记录')).toBeInTheDocument()
  })
})
