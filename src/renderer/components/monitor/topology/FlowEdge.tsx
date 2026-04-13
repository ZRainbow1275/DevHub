/**
 * FlowEdge -- Custom ReactFlow edge for the port-process-window flow chart.
 * Supports labelled edges with different styles per edge type.
 */

import { memo } from 'react'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'

export interface FlowEdgeData extends Record<string, unknown> {
  edgeType: 'port-binds-process' | 'process-owns-window' | 'process-child' | 'port-external'
  label?: string
  connectionCount?: number
}

type FlowEdgeProps = EdgeProps<Edge<FlowEdgeData>>

/**
 * Edge styling by semantic type (aligned with PRD T7.4):
 * - port-binds-process: solid accent colour, smoothstep
 * - process-owns-window: solid success colour, smoothstep
 * - process-child: dashed gold colour, animated
 * - port-external: dotted amber colour, step
 */
const EDGE_STYLES: Record<string, { color: string; strokeDasharray?: string; labelColor: string }> = {
  'port-binds-process': {
    // accent
    color: 'var(--color-accent, #d64545)',
    labelColor: 'var(--color-accent, #d64545)',
  },
  'process-owns-window': {
    // success
    color: 'var(--color-success, #22c55e)',
    labelColor: 'var(--color-success, #22c55e)',
  },
  'process-child': {
    color: 'var(--color-gold, #c9a227)',
    strokeDasharray: '6 3',
    labelColor: 'var(--color-gold, #c9a227)',
  },
  'port-external': {
    color: 'var(--color-warning, #f59e0b)',
    strokeDasharray: '2 4',
    labelColor: 'var(--color-warning, #f59e0b)',
  },
}

export const FlowEdge = memo(function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: FlowEdgeProps) {
  const edgeType = data?.edgeType ?? 'port-binds-process'
  const style = EDGE_STYLES[edgeType] ?? EDGE_STYLES['port-binds-process']
  const label = data?.label

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 2,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.color,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: style.strokeDasharray,
          opacity: selected ? 1 : 0.6,
          transition: 'stroke-width 150ms, opacity 150ms',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="px-1.5 py-0.5 bg-surface-900/90 text-[9px] font-mono"
          >
            <span style={{ color: style.labelColor }}>{label}</span>
            {data?.connectionCount !== undefined && data.connectionCount > 1 && (
              <span className="text-text-muted ml-1">x{data.connectionCount}</span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})
