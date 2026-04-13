import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ProcessTopologyNodeData } from '@shared/types-extended'
import { ProcessIcon } from '../../icons'

type ProcessNodeProps = NodeProps<Node<ProcessTopologyNodeData>>

export const ProcessNode = memo(function ProcessNode({ data, selected }: ProcessNodeProps) {
  const proc = data.processInfo
  const cpuDisplay = proc ? `${proc.cpu.toFixed(1)}%` : '--'
  const memDisplay = proc ? `${proc.memory.toFixed(0)}MB` : '--'

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-3 min-w-[160px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-gold hover:bg-surface-700'}
       radius-sm`}
    >
      {/* Diagonal deco */}
      <div className="absolute inset-0 deco-diagonal opacity-5 pointer-events-none" />

      <Handle
        type="target"
        position={Position.Top}
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

      {/* Resource bar */}
      {proc && (
        <div className="flex items-center gap-2 mt-2 text-[10px] text-text-tertiary relative z-10">
          <span className="font-mono">CPU:{cpuDisplay}</span>
          <span className="font-mono">MEM:{memDisplay}</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-gold !border-0 radius-sm"
      />
    </div>
  )
})
