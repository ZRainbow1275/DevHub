/**
 * FlowWindowNode -- Custom ReactFlow node for window display in the flow chart.
 * Shows window title (truncated), process name.
 */

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { WindowIcon } from '../../icons'

export interface FlowWindowNodeData extends Record<string, unknown> {
  label: string
  title: string
  processName: string
  pid: number
  hwnd: number
  isVisible: boolean
  isMinimized: boolean
}

type FlowWindowNodeProps = NodeProps<Node<FlowWindowNodeData>>

export const FlowWindowNode = memo(function FlowWindowNode({ data, selected }: FlowWindowNodeProps) {
  const stateText = data.isMinimized ? 'MIN' : data.isVisible ? 'VIS' : 'HID'
  const stateColor = data.isMinimized ? 'text-warning' : data.isVisible ? 'text-success' : 'text-text-muted'

  const displayTitle = data.title
    ? (data.title.length > 24 ? data.title.slice(0, 24) + '...' : data.title)
    : data.processName

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-2.5 min-w-[150px] max-w-[220px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-steel hover:bg-surface-700'}
       radius-sm`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-steel !border-0 radius-sm"
      />

      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 bg-surface-700 flex items-center justify-center border-l-2 border-steel flex-shrink-0 radius-sm"
        >
          <WindowIcon size={12} className="text-steel" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-medium text-text-primary truncate"
            title={data.title || data.processName}
          >
            {displayTitle}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[10px] font-mono ${stateColor}`}>{stateText}</span>
            <span className="text-[10px] text-text-muted font-mono">{data.processName}</span>
          </div>
        </div>
      </div>
    </div>
  )
})
