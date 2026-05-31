import { memo, type ReactNode } from 'react'
import type { FlowNode, FlowRequest } from '@shared/schemas/r8-runtime'
import { LazyMotion, domAnimation, m } from '../../../integrations'
import type { MotionProps, Variants } from '../../../integrations'

interface FlowAnimationLayerProps {
  node: FlowNode
  index: number
  speed: FlowRequest['speed']
  children: ReactNode
}

interface FlowAnimationListProps {
  enabled: boolean
  children: ReactNode
}

const FLOW_ROW_VARIANTS = {
  hidden: { opacity: 0, y: 4 },
  visible: { opacity: 1, y: 0 }
} satisfies Variants

function getFlowRowTransition(index: number, speed: FlowRequest['speed']): MotionProps['transition'] {
  if (speed === 0) return { duration: 0 }
  return {
    duration: Math.max(0.08, 0.18 / speed),
    delay: Math.min(index * 0.035 / speed, 0.4),
    ease: 'easeOut'
  }
}

export const FlowAnimationLayer = memo(function FlowAnimationLayer({ node, index, speed, children }: FlowAnimationLayerProps) {
  const paused = speed === 0
  const rowProps = {
    'data-testid': 'flow-animation-layer',
    'data-flow-node-id': node.id,
    'data-flow-animation-order': String(index + 1),
    'data-flow-animation-paused': paused ? 'true' : 'false',
    className: 'flex items-center gap-2'
  }

  if (paused) {
    return <div {...rowProps}>{children}</div>
  }

  return (
    <m.div
      {...rowProps}
      initial="hidden"
      animate="visible"
      variants={FLOW_ROW_VARIANTS}
      transition={getFlowRowTransition(index, speed)}
    >
      {children}
    </m.div>
  )
})

export function FlowAnimationList({ children, enabled }: FlowAnimationListProps) {
  if (!enabled) return <>{children}</>
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
}
