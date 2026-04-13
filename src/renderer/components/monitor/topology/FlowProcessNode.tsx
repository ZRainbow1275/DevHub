/**
 * FlowProcessNode -- Custom ReactFlow node for process display in the flow chart.
 * Shows process name, PID, CPU/memory mini bar.
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { ProcessIcon } from '../../icons'

export interface FlowProcessNodeData extends Record<string, unknown> {
  label: string
  pid: number
  cpu: number
  memory: number
  type: string
  status: string
  command?: string
}

type FlowProcessNodeProps = NodeProps<Node<FlowProcessNodeData>>

function cpuBarColor(cpu: number): string {
  if (cpu < 30) return '#22c55e'
  if (cpu < 70) return '#c9a227'
  return '#d64545'
}

export const FlowProcessNode = memo(function FlowProcessNode({ data, selected }: FlowProcessNodeProps) {
  const cpuPct = Math.min(data.cpu, 100)
  const memPct = Math.min(data.memory / 20, 100) // Assume 2000MB max, show as % of 20MB units

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-3 min-w-[170px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-gold hover:bg-surface-700'}
       radius-sm`}
    >
      {/* Diagonal deco */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-gold !border-0 radius-sm"
      />

      <div className="flex items-center gap-2 relative z-10">
        <div
          className="w-7 h-7 bg-surface-700 flex items-center justify-center border-l-2 border-gold flex-shrink-0 radius-sm"
        >
          <ProcessIcon size={14} className="text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-text-primary uppercase tracking-wider truncate"
            style={{ fontFamily: 'var(--font-display)' }}
            title={data.label}
          >
            {data.label}
          </div>
          <div className="text-[10px] text-text-muted font-mono">
            PID:{data.pid}
          </div>
        </div>
      </div>

      {/* Resource mini bars */}
      <div className="mt-2 space-y-1 relative z-10">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-text-muted w-8">CPU</span>
          <div className="flex-1 h-1.5 bg-surface-700 radius-sm">
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${cpuPct}%`,
                backgroundColor: cpuBarColor(data.cpu),
                borderRadius: '1px'
              }}
            />
          </div>
          <span className="text-[9px] text-text-muted font-mono w-10 text-right">
            {data.cpu.toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-text-muted w-8">内存</span>
          <div className="flex-1 h-1.5 bg-surface-700 radius-sm">
            <div
              className="h-full bg-info transition-all duration-300"
              style={{
                width: `${Math.min(memPct, 100)}%`,
                borderRadius: '1px'
              }}
            />
          </div>
          <span className="text-[9px] text-text-muted font-mono w-10 text-right">
            {data.memory.toFixed(0)}MB
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-gold !border-0 radius-sm"
      />
    </div>
  )
})
