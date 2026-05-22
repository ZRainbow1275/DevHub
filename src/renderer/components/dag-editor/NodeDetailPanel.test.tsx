import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CsvTaskRow18 } from '@shared/schemas/r8-runtime'
import { CSV_TASK_ROW_SCHEMA_VERSION } from '@shared/schemas/csv-task-row'
import { NodeDetailPanel, validateDagEditorRows } from './NodeDetailPanel'

function row(overrides: Partial<CsvTaskRow18> = {}): CsvTaskRow18 {
  return {
    schemaVersion: CSV_TASK_ROW_SCHEMA_VERSION,
    taskId: 'A',
    taskName: 'Task A',
    priority: 'P1',
    status: 'pending',
    tool: 'codex',
    skill: 'code-review',
    inputFile: 'src/app.ts',
    inputArgs: '{}',
    outputDir: 'out',
    outputFormat: 'md',
    tags: '',
    dependsOn: '',
    timeoutMs: 60000,
    retries: 1,
    concurrencyKey: '',
    createdAt: '2026-05-03T08:00:00Z',
    scheduledAt: 'now',
    note: '',
    ...overrides
  }
}

describe('NodeDetailPanel', () => {
  it('renders all 18 CSV columns and emits typed field patches', () => {
    const onPatch = vi.fn()
    render(<NodeDetailPanel row={row()} rowIndex={0} validationErrors={[]} onPatch={onPatch} />)

    expect(screen.getByTestId('node-detail-panel')).toHaveTextContent('18 columns')
    expect(screen.getAllByTestId(/^node-field-/)).toHaveLength(18)

    fireEvent.change(screen.getByLabelText('A detail priority'), { target: { value: 'P0' } })
    expect(onPatch).toHaveBeenCalledWith({ priority: 'P0' })

    fireEvent.change(screen.getByLabelText('A detail timeoutMs'), { target: { value: '7000' } })
    expect(onPatch).toHaveBeenCalledWith({ timeoutMs: 7000 })
  })

  it('surfaces spec-13 Zod validation errors in real time', () => {
    const invalidRow = row({ inputArgs: '{not-json' })
    const validationErrors = validateDagEditorRows([invalidRow])
    render(<NodeDetailPanel row={invalidRow} rowIndex={0} validationErrors={validationErrors} onPatch={vi.fn()} />)

    expect(validationErrors).toEqual([expect.objectContaining({ field: 'inputArgs' })])
    expect(screen.getByText('inputArgs must be valid JSON')).toBeInTheDocument()
  })
})
