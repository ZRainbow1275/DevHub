/**
 * FlowPortNode -- Custom ReactFlow node for port display in the flow chart.
 * Shows port number, protocol, state with color coding.
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { PortIcon } from '../../icons'

export interface FlowPortNodeData extends Record<string, unknown> {
  label: string
  port: number
  protocol: string
  state: string
  pid: number
  processName: string
  localAddress?: string
  foreignAddress?: string
}

type FlowPortNodeProps = NodeProps<Node<FlowPortNodeData>>

function stateColor(state: string): { border: string; text: string; bg: string } {
  switch (state) {
    case 'LISTENING':
      return { border: 'border-gold', text: 'text-gold', bg: 'bg-gold/10' }
    case 'ESTABLISHED':
      return { border: 'border-info', text: 'text-info', bg: 'bg-info/10' }
    case 'TIME_WAIT':
      return { border: 'border-surface-500', text: 'text-text-muted', bg: 'bg-surface-800' }
    default:
      return { border: 'border-surface-600', text: 'text-text-muted', bg: 'bg-surface-800' }
  }
}

export const FlowPortNode = memo(function FlowPortNode({ data, selected }: FlowPortNodeProps) {
  const colors = stateColor(data.state)

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-2.5 min-w-[130px] transition-all duration-150 radius-sm
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : `${colors.border} hover:bg-surface-700`}
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-info !border-0 radius-sm"
      />

      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 ${colors.bg} flex items-center justify-center border-l-2 ${colors.border} flex-shrink-0 radius-sm`}
        >
          <PortIcon size={12} className={colors.text} />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-text-primary font-mono"
            title={`端口 ${data.port}`}
          >
            :{data.port}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-text-muted">{data.protocol}</span>
            <span className={`text-[10px] ${colors.text}`}>{data.state}</span>
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-info !border-0 radius-sm"
      />
    </div>
  )
})
