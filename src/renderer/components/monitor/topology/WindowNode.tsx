import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ProcessTopologyNodeData } from '@shared/types-extended'
import { WindowIcon } from '../../icons'

type WindowNodeProps = NodeProps<Node<ProcessTopologyNodeData>>

export const WindowNode = memo(function WindowNode({ data, selected }: WindowNodeProps) {
  const win = data.windowInfo
  const visibilityText = win
    ? win.isMinimized ? 'MIN' : win.isVisible ? 'VIS' : 'HID'
    : '--'
  const visibilityColor = win
    ? win.isMinimized ? 'text-warning' : win.isVisible ? 'text-success' : 'text-text-muted'
    : 'text-text-muted'

  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-2.5 min-w-[140px] max-w-[200px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-steel hover:bg-surface-700'}
      `}
      style={{ borderRadius: '2px' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-steel !border-0"
        style={{ borderRadius: '1px' }}
      />

      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 bg-surface-700 flex items-center justify-center border-l-2 border-steel flex-shrink-0"
          style={{ borderRadius: '2px' }}
        >
          <WindowIcon size={12} className="text-steel" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[11px] font-medium text-text-primary truncate"
            title={data.label}
          >
            {data.label || 'Untitled'}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-[10px] font-mono ${visibilityColor}`}>{visibilityText}</span>
            {win && (
              <span className="text-[10px] text-text-muted font-mono">
                {win.rect.width}x{win.rect.height}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
