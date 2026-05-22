import type { GraphKind } from '@shared/schemas/r8-runtime'

interface GraphKindSwitcherProps {
  value: GraphKind
  onChange: (value: GraphKind) => void
}

const GRAPH_KIND_OPTIONS: Array<{ value: GraphKind; label: string }> = [
  { value: 'network-topology', label: '网络拓扑' },
  { value: 'neural-relationship', label: '神经关系' },
  { value: 'flow', label: '流程图' }
]

export function GraphKindSwitcher({ value, onChange }: GraphKindSwitcherProps) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="graph kind">
      {GRAPH_KIND_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          data-testid={`graph-kind-${option.value}`}
          aria-pressed={value === option.value}
          className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all radius-sm ${value === option.value ? 'bg-accent text-surface-950' : 'border border-surface-700 bg-surface-900 text-text-secondary hover:border-accent hover:text-text-primary'}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
