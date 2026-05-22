import type { GraphSlice } from '@shared/schemas/r8-runtime'

type ScopeValue = GraphSlice['scope']

interface GraphSliceMenuProps {
  scope: ScopeValue
  targetIdsText: string
  depth: number
  onScopeChange: (scope: ScopeValue) => void
  onTargetIdsTextChange: (value: string) => void
  onDepthChange: (depth: number) => void
}

const SCOPES: Array<{ value: ScopeValue; label: string }> = [
  { value: 'global', label: '全部' },
  { value: 'process', label: '进程' },
  { value: 'port', label: '端口' },
  { value: 'window', label: '窗口' },
  { value: 'project', label: '项目' }
]

export function GraphSliceMenu({ scope, targetIdsText, depth, onScopeChange, onTargetIdsTextChange, onDepthChange }: GraphSliceMenuProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
      <label className="flex items-center gap-2">
        切片
        <select
          data-testid="graph-scope-menu"
          className="input-sm min-w-24 bg-surface-900 text-text-primary"
          value={scope}
          onChange={event => onScopeChange(event.target.value as ScopeValue)}
        >
          {SCOPES.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2">
        目标
        <input
          data-testid="graph-target-ids"
          className="input-sm w-44 bg-surface-900 text-text-primary"
          placeholder="PID/port/hwnd/projectId"
          value={targetIdsText}
          onChange={event => onTargetIdsTextChange(event.target.value)}
        />
      </label>
      <label className="flex items-center gap-2">
        深度
        <input
          data-testid="graph-depth-input"
          className="input-sm w-16 bg-surface-900 text-text-primary"
          min={1}
          max={10}
          type="number"
          value={depth}
          onChange={event => onDepthChange(Math.max(1, Math.min(10, Number(event.target.value) || 1)))}
        />
      </label>
    </div>
  )
}
