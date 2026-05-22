import type { GraphExportFormat } from '@shared/schemas/r8-runtime'

interface GraphExportMenuProps {
  disabled: boolean
  onExport: (format: GraphExportFormat) => void
}

const FORMATS: GraphExportFormat[] = ['mermaid', 'dot', 'svg', 'png']

export function GraphExportMenu({ disabled, onExport }: GraphExportMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="graph export menu">
      {FORMATS.map(format => (
        <button
          key={format}
          type="button"
          data-testid={`graph-export-${format}`}
          className="btn-secondary px-2 py-1 text-[10px] uppercase"
          disabled={disabled}
          onClick={() => onExport(format)}
        >
          {format}
        </button>
      ))}
    </div>
  )
}
