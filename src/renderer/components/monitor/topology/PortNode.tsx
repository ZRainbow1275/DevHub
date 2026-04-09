import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ProcessTopologyNodeData } from '@shared/types-extended'
import { PortIcon } from '../../icons'

type PortNodeProps = NodeProps<Node<ProcessTopologyNodeData>>

export const PortNode = memo(function PortNode({ data, selected }: PortNodeProps) {
  const port = data.portInfo
  const stateColor = port?.state === 'LISTENING'
    ? 'text-success'
    : port?.state === 'ESTABLISHED'
      ? 'text-info'
      : 'text-text-muted'

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-2.5 min-w-[120px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-info hover:bg-surface-700'}
      `}
      style={{ borderRadius: '2px' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-info !border-0"
        style={{ borderRadius: '1px' }}
      />

      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 bg-surface-700 flex items-center justify-center border-l-2 border-info flex-shrink-0"
          style={{ borderRadius: '2px' }}
        >
          <PortIcon size={12} className="text-info" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-text-primary font-mono"
            title={`Port ${port?.port}`}
          >
            {data.label}
          </div>
          {port && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-text-muted">{port.protocol}</span>
              <span className={`text-[10px] ${stateColor}`}>{port.state}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
