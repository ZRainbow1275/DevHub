import { memo } from 'react'
import { BaseEdge, getSmoothStepPath } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import type { ProcessTopologyEdgeData } from '@shared/types-extended'

type TopologyEdgeProps = EdgeProps<Edge<ProcessTopologyEdgeData>>

const EDGE_COLORS: Record<string, string> = {
  'project-owns-process': 'var(--color-accent, #dc2626)',
  'process-binds-port': 'var(--color-info, #3b82f6)',
  'process-owns-window': 'var(--color-steel, #64748b)'
}

export const TopologyEdge = memo(function TopologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}: TopologyEdgeProps) {
  const edgeType = data?.edgeType ?? 'process-binds-port'
  const color = EDGE_COLORS[edgeType] ?? '#64748b'

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 2
  })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        stroke: color,
        strokeWidth: selected ? 2.5 : 1.5,
        opacity: selected ? 1 : 0.6,
        transition: 'stroke-width 150ms, opacity 150ms'
      }}
    />
  )
})
