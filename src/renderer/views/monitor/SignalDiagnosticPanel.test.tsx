import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignalDiagnosticPanel } from './SignalDiagnosticPanel'

describe('SignalDiagnosticPanel', () => {
  it('loads diagnostic explanations from the typed preload bridge only after expansion', async () => {
    const diagnosticExplain = vi.fn(async () => ({
      instanceId: 'ai-window-1',
      currentTaskState: 'idle' as const,
      suggestedAction: 'report-misreport',
      topReasons: [
        { reasonText: 'CLI parser signal contributed 70.0% with confidence 90.0%.', sourceCitation: 'cli_parse', contributionPct: 0.7 }
      ],
      recentTransitions: []
    }))
    const reportMisreport = vi.fn()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { ai: { diagnosticExplain, reportMisreport } } }
    })

    render(<SignalDiagnosticPanel instanceId="ai-window-1" />)
    expect(diagnosticExplain).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /信号诊断/ }))

    await waitFor(() => expect(diagnosticExplain).toHaveBeenCalledWith('ai-window-1'))
    expect(await screen.findByText(/CLI parser signal/)).toBeInTheDocument()
    expect(screen.getByText(/source=cli_parse/)).toBeInTheDocument()
    expect(screen.getByText(/contribution=70.0%/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标记检测正确' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '标记检测错误' })).toBeInTheDocument()
    expect(reportMisreport).not.toHaveBeenCalled()
  })
})
