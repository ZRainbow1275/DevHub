import type { ReactNode } from 'react'
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

export function FlowAnimationLayer({ node, index, speed, children }: FlowAnimationLayerProps) {
  const paused = speed === 0

  return (
    <m.div
      data-testid="flow-animation-layer"
      data-flow-node-id={node.id}
      data-flow-animation-order={String(index + 1)}
      data-flow-animation-paused={paused ? 'true' : 'false'}
      initial={paused ? false : 'hidden'}
      animate="visible"
      variants={FLOW_ROW_VARIANTS}
      transition={getFlowRowTransition(index, speed)}
      className="flex items-center gap-2"
    >
      {children}
    </m.div>
  )
}

export function FlowAnimationList({ children }: FlowAnimationListProps) {
  return <LazyMotion features={domAnimation} strict>{children}</LazyMotion>
}
