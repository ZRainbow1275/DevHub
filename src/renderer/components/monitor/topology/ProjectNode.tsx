import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { ProcessTopologyNodeData } from '@shared/types-extended'
import { FolderIcon } from '../../icons'

type ProjectNodeProps = NodeProps<Node<ProcessTopologyNodeData>>

export const ProjectNode = memo(function ProjectNode({ data, selected }: ProjectNodeProps) {
  return (
    <div
      className={`
        relative bg-surface-800 border-l-3 p-3 min-w-[160px] transition-all duration-150
        ${selected ? 'border-accent bg-accent/10 shadow-lg' : 'border-accent hover:bg-surface-700'}
      `}
      style={{ borderRadius: '2px' }}
    >
      {/* Diagonal deco */}
      <div className="absolute inset-0 deco-diagonal opacity-10 pointer-events-none" />

      <div className="flex items-center gap-2 relative z-10">
        <div
          className="w-8 h-8 bg-surface-700 flex items-center justify-center border-l-2 border-accent flex-shrink-0"
          style={{ borderRadius: '2px' }}
        >
          <FolderIcon size={16} className="text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-bold text-accent uppercase tracking-wider truncate"
            style={{ fontFamily: 'var(--font-display)' }}
            title={data.projectName ?? data.label}
          >
            {data.projectName ?? data.label}
          </div>
          <div className="text-[10px] text-text-muted uppercase tracking-wider">
            PROJECT
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-accent !border-0"
        style={{ borderRadius: '1px' }}
      />
    </div>
  )
})
