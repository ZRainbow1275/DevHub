import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CsvLaunchWizard } from './CsvLaunchWizard'

describe('CsvLaunchWizard', () => {
  const csvApi = {
    getRunnerInfo: vi.fn(async (kind: 'devhub' | 'python' | 'cli') => ({
      available: kind !== 'python',
      version: kind === 'python' ? null : '1.0.0',
      details: kind === 'python' ? { reason: 'E_FEATURE_DISABLED' } : {}
    })),
    generateCommand: vi.fn(async () => ({
      command: 'devhub run-csv C:/tasks/batch.csv --runner cli --concurrent 3 --dry-run',
      copyToClipboard: true,
      commandFilePath: 'C:/Users/HP/AppData/Roaming/devhub/last-csv-command.txt'
    })),
    launch: vi.fn(async () => ({
      success: true,
      session: {
        sessionId: '11111111-1111-4111-8111-111111111111',
        csvPath: 'C:/tasks/batch.csv',
        runner: 'devhub',
        metadata: { devhubCsvVersion: '1.0', runner: 'devhub', concurrentMax: 3 },
        rowCount: 1,
        enqueued: 1,
        skipped: 0,
        startedAt: 1,
        pid: null,
        status: 'running',
        command: null,
        error: null
      }
    })),
    onSessionEvent: vi.fn(() => () => undefined)
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'devhub', {
      configurable: true,
      value: { r8: { csv: csvApi } }
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) }
    })
  })

  it('generates CLI commands and launches through the preload CSV API', async () => {
    render(<CsvLaunchWizard />)

    await waitFor(() => expect(csvApi.getRunnerInfo).toHaveBeenCalledTimes(3))
    fireEvent.change(screen.getByTestId('csv-launch-path'), { target: { value: 'C:/tasks/batch.csv' } })
    fireEvent.click(screen.getByTestId('csv-runner-cli'))
    fireEvent.click(screen.getByTestId('csv-generate-command'))

    expect(await screen.findByTestId('csv-cli-command-output')).toHaveTextContent('devhub run-csv')
    expect(csvApi.generateCommand).toHaveBeenCalledWith({ csvPath: 'C:/tasks/batch.csv', runner: 'cli', concurrent: 3, dryRun: true })

    fireEvent.click(screen.getByTestId('csv-runner-devhub'))
    fireEvent.click(screen.getByTestId('csv-launch-confirm'))

    expect(await screen.findByTestId('csv-launch-session')).toHaveTextContent('running via devhub')
    expect(csvApi.launch).toHaveBeenCalledWith({ csvPath: 'C:/tasks/batch.csv', runner: 'devhub', concurrent: 3, dryRun: true }, 'csv-launch-wizard')
  })
})
