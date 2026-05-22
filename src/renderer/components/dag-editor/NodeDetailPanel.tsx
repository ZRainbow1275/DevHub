import { useMemo } from 'react'
import { CSV_COLUMN_INFO, csvTaskRow18Schema, type CsvColumnName } from '@shared/schemas/csv-task-row'
import type { CsvTaskRow18, DagEditorValidationError } from '@shared/schemas/r8-runtime'

interface NodeDetailPanelProps {
  onPatch: (patch: Partial<CsvTaskRow18>) => void
  row: CsvTaskRow18 | null
  rowIndex: number
  validationErrors: DagEditorValidationError[]
}

const PRIORITY_OPTIONS: CsvTaskRow18['priority'][] = ['P0', 'P1', 'P2', 'P3']
const STATUS_OPTIONS: CsvTaskRow18['status'][] = ['pending', 'running', 'done', 'failed', 'skipped']
const TOOL_OPTIONS: CsvTaskRow18['tool'][] = ['codex', 'claude', 'gemini', 'cursor', 'copilot']
const OUTPUT_FORMAT_OPTIONS: CsvTaskRow18['outputFormat'][] = ['json', 'md', 'txt', 'file']

export function validateDagEditorRows(rows: readonly CsvTaskRow18[]): DagEditorValidationError[] {
  return rows.flatMap((row, rowIndex) => {
    const parsed = csvTaskRow18Schema.safeParse(row)
    if (parsed.success) return []
    return parsed.error.issues.map(issue => ({
      rowIndex,
      field: typeof issue.path[0] === 'string' ? issue.path[0] : '__row__',
      code: issue.code,
      message: issue.message
    }))
  })
}

function errorsByField(errors: readonly DagEditorValidationError[]): Map<string, DagEditorValidationError[]> {
  const grouped = new Map<string, DagEditorValidationError[]>()
  for (const error of errors) {
    const current = grouped.get(error.field) ?? []
    grouped.set(error.field, [...current, error])
  }
  return grouped
}

function readField(row: CsvTaskRow18, field: CsvColumnName): string {
  return String(row[field])
}

function patchForField(field: CsvColumnName, value: string): Partial<CsvTaskRow18> {
  if (field === 'taskId') return { taskId: value }
  if (field === 'taskName') return { taskName: value }
  if (field === 'priority') return { priority: value as CsvTaskRow18['priority'] }
  if (field === 'status') return { status: value as CsvTaskRow18['status'] }
  if (field === 'tool') return { tool: value as CsvTaskRow18['tool'] }
  if (field === 'skill') return { skill: value }
  if (field === 'inputFile') return { inputFile: value }
  if (field === 'inputArgs') return { inputArgs: value }
  if (field === 'outputDir') return { outputDir: value }
  if (field === 'outputFormat') return { outputFormat: value as CsvTaskRow18['outputFormat'] }
  if (field === 'tags') return { tags: value }
  if (field === 'dependsOn') return { dependsOn: value }
  if (field === 'timeoutMs') return { timeoutMs: Number(value) }
  if (field === 'retries') return { retries: Number(value) }
  if (field === 'concurrencyKey') return { concurrencyKey: value }
  if (field === 'createdAt') return { createdAt: value }
  if (field === 'scheduledAt') return { scheduledAt: value }
  return { note: value }
}

function selectOptionsFor(field: CsvColumnName): readonly string[] | null {
  if (field === 'priority') return PRIORITY_OPTIONS
  if (field === 'status') return STATUS_OPTIONS
  if (field === 'tool') return TOOL_OPTIONS
  if (field === 'outputFormat') return OUTPUT_FORMAT_OPTIONS
  return null
}

function inputTypeFor(field: CsvColumnName): 'number' | 'text' {
  return field === 'timeoutMs' || field === 'retries' ? 'number' : 'text'
}

export function NodeDetailPanel({ onPatch, row, rowIndex, validationErrors }: NodeDetailPanelProps) {
  const groupedErrors = useMemo(() => errorsByField(validationErrors), [validationErrors])

  if (!row || rowIndex < 0) {
    return (
      <section aria-label="Node detail panel" className="border border-surface-800 bg-surface-950 p-3 text-xs text-text-muted radius-md" data-testid="node-detail-panel">
        选择一个节点以编辑 18 列字段
      </section>
    )
  }

  return (
    <section aria-label="Node detail panel" className="space-y-3 border border-surface-800 bg-surface-950 p-3 radius-md" data-testid="node-detail-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase text-text-muted">NodeDetailPanel</div>
          <div className="text-xs text-text-muted">18 columns / row {rowIndex + 1} / {row.taskId}</div>
        </div>
        <div className={validationErrors.length > 0 ? 'text-xs text-danger' : 'text-xs text-success'}>
          {validationErrors.length > 0 ? `${validationErrors.length} validation errors` : 'zod valid'}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {CSV_COLUMN_INFO.map(column => {
          const fieldErrors = groupedErrors.get(column.name) ?? []
          const options = selectOptionsFor(column.name)
          const fieldId = `node-detail-${column.name}`
          return (
            <label key={column.name} className="space-y-1 text-xs text-text-muted" htmlFor={fieldId}>
              <span className="flex items-center justify-between gap-2">
                <span>{column.index}. {column.name}</span>
                {column.required && <span className="text-warning">required</span>}
              </span>
              {options ? (
                <select
                  aria-label={`${row.taskId} detail ${column.name}`}
                  className="w-full border border-surface-700 bg-surface-950 px-2 py-1 text-text-primary radius-sm"
                  data-testid={`node-field-${column.name}`}
                  id={fieldId}
                  value={readField(row, column.name)}
                  onChange={event => onPatch(patchForField(column.name, event.currentTarget.value))}
                >
                  {options.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : (
                <input
                  aria-label={`${row.taskId} detail ${column.name}`}
                  className="w-full border border-surface-700 bg-surface-950 px-2 py-1 font-mono text-text-primary radius-sm"
                  data-testid={`node-field-${column.name}`}
                  id={fieldId}
                  type={inputTypeFor(column.name)}
                  value={readField(row, column.name)}
                  onChange={event => onPatch(patchForField(column.name, event.currentTarget.value))}
                />
              )}
              <span className="block min-h-4 text-[11px] text-text-muted">{column.description}</span>
              {fieldErrors.map(error => <span key={`${error.code}:${error.message}`} className="block text-[11px] text-danger">{error.message}</span>)}
            </label>
          )
        })}
      </div>
    </section>
  )
}
