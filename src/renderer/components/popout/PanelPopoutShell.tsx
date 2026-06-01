import { Suspense, useEffect } from 'react'
import type { PanelPopoutSurface } from '@shared/schemas/r8-runtime'
import { ErrorBoundary } from '../ErrorBoundary'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { usePopoutThemeBridge } from '../../hooks/usePopoutThemeBridge'
import {
  DETACHABLE_REGISTRY,
  isPanelPopoutSurface,
  parseDetachTarget,
  type DetachTarget
} from './detachable-registry'

export function readPanelPopoutSurface(): PanelPopoutSurface | null {
  const value = new URLSearchParams(window.location.search).get('r8PanelPopout')
  return isPanelPopoutSurface(value) ? value : null
}

export function readPanelPopoutTarget(): DetachTarget | null {
  return parseDetachTarget(new URLSearchParams(window.location.search).get('target'))
}

export function PanelPopoutShell({
  surface,
  initialTarget
}: {
  surface: PanelPopoutSurface
  initialTarget?: DetachTarget | null
}): React.JSX.Element {
  const definition = DETACHABLE_REGISTRY[surface]

  // Detached panel popouts are full index.html instances that boot theme on load
  // but otherwise miss live theme switches in the main window. Subscribe to the
  // theme bridge so the open popout re-skins in real time (R3.4).
  usePopoutThemeBridge()

  useEffect(() => {
    document.title = `DevHub - ${definition.title}`
  }, [definition.title])

  const Content = definition.component

  return (
    <ErrorBoundary
      fallback={
        <div className="flex h-screen items-center justify-center p-8">
          <div className="max-w-sm border-l-2 border-error bg-surface-950 p-4 radius-sm">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">独立窗</div>
            <div className="mt-1 text-sm font-bold text-text-primary">面板加载失败</div>
            <p className="mt-2 text-xs leading-5 text-text-secondary">无法在此独立窗中渲染该面板,可关闭此窗重新从主窗摘出。</p>
          </div>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center gap-3 text-sm text-text-muted">
            <LoadingSpinner size="sm" />
            <span>正在加载面板…</span>
          </div>
        }
      >
        <div className="h-screen w-screen overflow-hidden bg-surface-900" data-r8c-panel-popout={surface}>
          <Content initialTarget={definition.needsTarget ? initialTarget ?? readPanelPopoutTarget() : null} />
        </div>
      </Suspense>
    </ErrorBoundary>
  )
}
