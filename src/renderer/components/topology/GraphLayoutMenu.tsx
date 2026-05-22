import type { GraphLayout } from '@shared/schemas/r8-runtime'

interface GraphLayoutMenuProps {
  value: GraphLayout
  onChange: (value: GraphLayout) => void
}

const LAYOUTS: Array<{ value: GraphLayout; label: string }> = [
  { value: 'dagre', label: 'Dagre' },
  { value: 'cose-bilkent', label: 'Cose' },
  { value: 'cola', label: 'Cola' },
  { value: 'circle', label: 'Circle' },
  { value: 'preset', label: 'Preset' }
]

export function GraphLayoutMenu({ value, onChange }: GraphLayoutMenuProps) {
  return (
    <label className="flex items-center gap-2 text-xs text-text-muted">
      布局
      <select
        data-testid="graph-layout-menu"
        className="input-sm min-w-28 bg-surface-900 text-text-primary"
        value={value}
        onChange={event => onChange(event.target.value as GraphLayout)}
      >
        {LAYOUTS.map(layout => <option key={layout.value} value={layout.value}>{layout.label}</option>)}
      </select>
    </label>
  )
}
